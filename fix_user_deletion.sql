-- Execute this SQL in the Supabase dashboard SQL editor

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

-- Create delete policy for admin users
CREATE POLICY "users_delete_policy" ON public.users
FOR DELETE TO authenticated
USING (
  EXISTS (
    SELECT 1 
    FROM auth.users 
    WHERE auth.users.id = auth.uid() 
    AND auth.users.raw_user_meta_data->>'status' = 'ADMIN'
  )
);

-- Grant necessary permissions
GRANT DELETE ON public.users TO authenticated;
