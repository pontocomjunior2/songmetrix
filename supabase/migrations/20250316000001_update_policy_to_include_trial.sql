-- Drop existing policies
DROP POLICY IF EXISTS "users_update_status_policy" ON public.users;

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
  OR
  -- Or it is the user themselves during registration
  (id = auth.uid() AND (auth.email() = email))
)
WITH CHECK (
  -- User must be an admin
  (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() 
      AND status = 'ADMIN'
    )
    AND
    -- New status must be valid for admin updates
    NEW.status IN ('ADMIN', 'ATIVO', 'INATIVO', 'TRIAL')
  )
  OR
  -- Or it is the user themselves during registration setting to TRIAL
  (id = auth.uid() AND (auth.email() = email) AND NEW.status = 'TRIAL')
);

-- Ensure RLS is enabled
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Add a safety check policy for the trigger
DROP POLICY IF EXISTS "users_insert_policy" ON public.users;
CREATE POLICY "users_insert_policy" ON public.users
FOR INSERT TO authenticated
WITH CHECK (
  -- Must be the user's own record
  id = auth.uid() AND email = auth.email()
);

-- Create or update the trigger function to ensure new users are TRIAL
CREATE OR REPLACE FUNCTION ensure_new_user_is_trial()
RETURNS TRIGGER AS $$
BEGIN
  -- Set the status to TRIAL for new users during registration
  IF NEW.status IS NULL OR NEW.status = 'INATIVO' THEN
    NEW.status := 'TRIAL';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create the trigger
DROP TRIGGER IF EXISTS ensure_new_user_is_trial_trigger ON public.users;
CREATE TRIGGER ensure_new_user_is_trial_trigger
BEFORE INSERT OR UPDATE ON public.users
FOR EACH ROW
EXECUTE FUNCTION ensure_new_user_is_trial(); 