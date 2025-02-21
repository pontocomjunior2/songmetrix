# Steps to Fix User Deletion

1. First, execute this SQL in your Supabase dashboard SQL editor:

```sql
-- Drop existing policies and functions
DROP POLICY IF EXISTS "users_delete_policy" ON public.users;
DROP POLICY IF EXISTS "users_delete_policy_admin" ON public.users;
DROP FUNCTION IF EXISTS delete_user(UUID);
DROP FUNCTION IF EXISTS delete_user_admin(UUID);

-- Create a function to handle user deletion with proper cascade
CREATE OR REPLACE FUNCTION delete_user_admin(user_id UUID)
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
GRANT EXECUTE ON FUNCTION delete_user_admin TO authenticated;

-- Add CASCADE to foreign key reference
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 
    FROM information_schema.table_constraints 
    WHERE constraint_name = 'users_id_fkey'
  ) THEN
    ALTER TABLE public.users
    DROP CONSTRAINT users_id_fkey;
  END IF;

  ALTER TABLE public.users
  ADD CONSTRAINT users_id_fkey
  FOREIGN KEY (id)
  REFERENCES auth.users(id)
  ON DELETE CASCADE;
END $$;

-- Drop all policies on users table and recreate them
DO $$
BEGIN
  -- Drop all policies
  DROP POLICY IF EXISTS "users_delete_policy" ON public.users;
  DROP POLICY IF EXISTS "users_delete_policy_admin" ON public.users;
  DROP POLICY IF EXISTS "Enable delete for authenticated users only" ON public.users;
  
  -- Create new policy
  IF NOT EXISTS (
    SELECT 1 
    FROM pg_policies 
    WHERE tablename = 'users' 
    AND policyname = 'users_delete_policy_admin'
  ) THEN
    CREATE POLICY "users_delete_policy_admin" ON public.users
    FOR DELETE TO authenticated
    USING (
      EXISTS (
        SELECT 1 
        FROM auth.users 
        WHERE auth.users.id = auth.uid() 
        AND auth.users.raw_user_meta_data->>'status' = 'ADMIN'
      )
    );
  END IF;
END $$;

-- Grant necessary permissions
GRANT DELETE ON public.users TO authenticated;
```

2. Then, in AuthContext.tsx, find the `removeUser` function and replace it with:

```typescript
const removeUser = async (userId: string) => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Usuário não autenticado');

    const isAdmin = user.user_metadata?.status === 'ADMIN';
    if (!isAdmin) {
      throw new Error('Usuário não tem permissão de administrador');
    }

    // Call the stored procedure to delete the user
    const { error } = await supabase.rpc('delete_user_admin', {
      user_id: userId
    });

    if (error) {
      console.error('Error deleting user:', error);
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

Please execute these steps in order:
1. Run the SQL in Supabase SQL editor
2. Replace the removeUser function in AuthContext.tsx
3. Test deleting a user to verify it works

The changes:
1. Added checks to drop all possible existing policies
2. Added condition to create policy only if it doesn't exist
3. Simplified the removeUser function to use the stored procedure
4. Added UI refresh after deletion
