BEGIN;

-- Drop existing policies and functions
DROP POLICY IF EXISTS "users_update_status_policy" ON public.users;
DROP FUNCTION IF EXISTS update_user_status_transaction(uuid, text, uuid);

-- Create policy for updating user status
CREATE POLICY "users_update_status_policy" ON public.users
FOR UPDATE TO authenticated
USING (
  -- User must be an admin
  EXISTS (
    SELECT 1 FROM users 
    WHERE id = auth.uid() 
    AND status = 'ADMIN'
  )
)
WITH CHECK (
  -- User must be an admin
  EXISTS (
    SELECT 1 FROM users 
    WHERE id = auth.uid() 
    AND status = 'ADMIN'
  )
  AND
  -- New status must be valid
  NEW.status IN ('ADMIN', 'ATIVO', 'INATIVO')
);

-- Ensure RLS is enabled
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

COMMIT;
