-- Drop existing policies on the users table
DROP POLICY IF EXISTS "users_activation_policy" ON public.users;

-- Create a new policy for user activation
CREATE POLICY "users_activation_policy" ON public.users
FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1 
    FROM auth.users 
    WHERE auth.users.id = auth.uid() 
    AND auth.users.raw_user_meta_data->>'status' = 'ADMIN'
  )
  AND (status IN ('ATIVO', 'INATIVO', 'ADMIN')) -- Ensure valid status values
);
