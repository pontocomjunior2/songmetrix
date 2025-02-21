-- Drop any existing policies for user metadata
DROP POLICY IF EXISTS "users_update_metadata_policy" ON public.users;

-- Create a function to validate status updates
CREATE OR REPLACE FUNCTION public.validate_status_update()
RETURNS TRIGGER AS $$ 
BEGIN
    -- Only allow valid status values
    IF NEW.status NOT IN ('ADMIN', 'ATIVO', 'INATIVO') THEN
        RAISE EXCEPTION 'Invalid status value';
    END IF;

    -- Only admins can set ADMIN status
    IF NEW.status = 'ADMIN' AND NOT public.check_admin_status() THEN
        RAISE EXCEPTION 'Only admins can set admin status';
    END IF;

    -- Keep admin status for existing admins unless changed by another admin
    IF OLD.status = 'ADMIN' AND NEW.status != 'ADMIN' AND NOT public.check_admin_status() THEN
        RAISE EXCEPTION 'Cannot remove admin status';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for status validation
DROP TRIGGER IF EXISTS validate_status_update ON public.users;

CREATE TRIGGER validate_status_update
    BEFORE UPDATE OF status ON public.users
    FOR EACH ROW
    EXECUTE FUNCTION public.validate_status_update();

-- Update policies for user metadata
CREATE POLICY "users_update_metadata_policy" ON public.users
FOR UPDATE TO authenticated
USING (
    -- Users can update their own metadata
    auth.uid() = id
    OR 
    -- Admins can update any user's metadata
    public.check_admin_status()
)
WITH CHECK (
    -- Users can update their own metadata
    auth.uid() = id
    OR 
    -- Admins can update any user's metadata
    public.check_admin_status()
);

-- Ensure RLS is enabled
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Grant necessary permissions
GRANT SELECT, UPDATE ON public.users TO authenticated;
