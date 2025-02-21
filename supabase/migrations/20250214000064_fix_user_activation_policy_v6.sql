-- Drop existing policies on the users table
DROP POLICY IF EXISTS "users_activation_policy" ON public.users;

-- Create a new policy for user activation
CREATE POLICY "users_activation_policy" ON public.users
FOR UPDATE TO authenticated
USING (
  (auth.uid() IN (
    SELECT id FROM auth.users WHERE raw_user_meta_data->>'status' = 'ADMIN'
  ))
);
