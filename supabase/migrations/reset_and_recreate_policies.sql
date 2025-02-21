-- Drop all existing policies on the users table
DROP POLICY IF EXISTS "users_activation_policy" ON public.users;
DROP POLICY IF EXISTS "users_update_metadata_policy" ON public.users;

-- Create a new activation policy
CREATE POLICY "users_activation_policy" ON public.users
FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1 
    FROM public.admins 
    WHERE public.admins.user_id = auth.uid()
  )
);

-- Create a new metadata update policy
CREATE POLICY "users_update_metadata_policy" ON public.users
FOR UPDATE TO authenticated
USING (
    auth.uid() = id
    OR 
    EXISTS (
      SELECT 1 
      FROM public.admins 
      WHERE public.admins.user_id = auth.uid()
    )
);

-- Ensure RLS is enabled
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Grant necessary permissions
GRANT SELECT, UPDATE ON public.users TO authenticated;
