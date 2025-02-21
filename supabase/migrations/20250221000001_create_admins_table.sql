-- Create the admins table to store admin user IDs
CREATE TABLE public.admins (
    user_id UUID PRIMARY KEY
);

-- Insert existing admin user IDs into the admins table
INSERT INTO public.admins (user_id) VALUES
('962a2ae3-ebf1-4dcd-9f12-c9b41fda2d43');
