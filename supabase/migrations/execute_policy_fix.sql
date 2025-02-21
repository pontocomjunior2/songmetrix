-- Drop existing activation policy
DROP POLICY IF EXISTS "users_activation_policy" ON public.users;

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

-- Ensure RLS is enabled
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Grant necessary permissions
GRANT SELECT, UPDATE ON public.users TO authenticated;
