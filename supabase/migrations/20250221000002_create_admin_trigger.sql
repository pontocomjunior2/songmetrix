-- Create a trigger function to update the admins table
CREATE OR REPLACE FUNCTION public.update_admins_table()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status = 'ADMIN' THEN
        -- Insert the user into the admins table if they are set as admin
        INSERT INTO public.admins (user_id) VALUES (NEW.id)
        ON CONFLICT (user_id) DO NOTHING;
    ELSIF OLD.status = 'ADMIN' AND NEW.status != 'ADMIN' THEN
        -- Remove the user from the admins table if they are no longer admin
        DELETE FROM public.admins WHERE user_id = OLD.id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create a trigger to call the function on status updates
CREATE TRIGGER update_admins_trigger
AFTER UPDATE OF status ON public.users
FOR EACH ROW
EXECUTE FUNCTION public.update_admins_table();
