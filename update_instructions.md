# Instructions to Fix User Deletion

1. First, execute this SQL in the Supabase dashboard SQL editor:

```sql
-- Drop existing function if exists
DROP FUNCTION IF EXISTS delete_user(UUID);

-- Create a function to handle user deletion with proper cascade
CREATE OR REPLACE FUNCTION delete_user(user_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_role text;
BEGIN
  -- Check if the executing user is an admin
  SELECT raw_user_meta_data->>'status'
  INTO v_user_role
  FROM auth.users
  WHERE id = auth.uid();

  IF v_user_role != 'ADMIN' THEN
    RAISE EXCEPTION 'Only admin users can delete users';
  END IF;

  -- Delete from auth.users (this will cascade to public.users)
  DELETE FROM auth.users WHERE id = user_id;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION delete_user TO authenticated;

-- Add CASCADE to foreign key reference
ALTER TABLE public.users
DROP CONSTRAINT IF EXISTS users_id_fkey;

ALTER TABLE public.users
ADD CONSTRAINT users_id_fkey
FOREIGN KEY (id)
REFERENCES auth.users(id)
ON DELETE CASCADE;
```

2. Then, replace the removeUser function in AuthContext.tsx with this code:

```typescript
const removeUser = async (userId: string) => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Usuário não autenticado');

    const isAdmin = user.user_metadata?.status === 'ADMIN';
    if (!isAdmin) {
      throw new Error('Usuário não tem permissão de administrador');
    }

    // Delete user using admin API endpoint
    const { data: { session } } = await supabase.auth.getSession();
    const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/auth/v1/admin/users/${userId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${session?.access_token}`,
        'apikey': import.meta.env.VITE_SUPABASE_SERVICE_KEY
      }
    });

    if (!response.ok) {
      throw new Error('Erro ao remover usuário');
    }

    // Refresh the users list to update the UI
    await supabase
      .from('users')
      .select()
      .limit(1)
      .single();

  } catch (error) {
    console.error('Error in removeUser:', error);
    throw error;
  }
};
```

3. Make sure these environment variables are set in your .env file:
```
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_SERVICE_KEY=your_service_role_key
```

The changes:
1. Use the admin API endpoint to delete users
2. Use the service role key for admin operations
3. Automatically handle cascade deletion through database constraints
4. Refresh the UI after deletion
