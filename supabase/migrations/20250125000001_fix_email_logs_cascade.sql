-- Migration: Fix email_logs foreign key constraints with CASCADE delete
-- This ensures that when a user is deleted, all related email logs are also deleted

-- Add CASCADE to email_logs.user_id foreign key
ALTER TABLE public.email_logs 
DROP CONSTRAINT IF EXISTS email_logs_user_id_fkey;

ALTER TABLE public.email_logs 
ADD CONSTRAINT email_logs_user_id_fkey 
    FOREIGN KEY (user_id) 
    REFERENCES auth.users(id) 
    ON DELETE CASCADE;

-- Ensure users table has CASCADE for auth.users
ALTER TABLE public.users 
DROP CONSTRAINT IF EXISTS users_id_fkey;

ALTER TABLE public.users 
ADD CONSTRAINT users_id_fkey 
    FOREIGN KEY (id) 
    REFERENCES auth.users(id) 
    ON DELETE CASCADE;

-- Apply CASCADE to all other tables with user_id foreign keys
DO $$
DECLARE
  tbl RECORD;
BEGIN
  FOR tbl IN 
    SELECT tc.table_name, kcu.column_name
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_catalog = kcu.constraint_catalog
      AND tc.constraint_schema = kcu.constraint_schema
      AND tc.constraint_name = kcu.constraint_name
    WHERE tc.constraint_type = 'FOREIGN KEY'
      AND kcu.column_name = 'user_id'
      AND tc.table_schema = 'public'
      AND tc.table_name NOT IN ('email_logs', 'users')  -- Already handled above
  LOOP
    EXECUTE format('
      ALTER TABLE public.%I
      DROP CONSTRAINT IF EXISTS %I_user_id_fkey;
      
      ALTER TABLE public.%I
      ADD CONSTRAINT %I_user_id_fkey
      FOREIGN KEY (user_id)
      REFERENCES auth.users(id)
      ON DELETE CASCADE;
    ', tbl.table_name, tbl.table_name, tbl.table_name, tbl.table_name);
  END LOOP;
END
$$;

-- Add comment for documentation
COMMENT ON CONSTRAINT email_logs_user_id_fkey ON public.email_logs IS 
'Foreign key with CASCADE delete to ensure email logs are removed when user is deleted';

COMMENT ON CONSTRAINT users_id_fkey ON public.users IS 
'Foreign key with CASCADE delete to sync with auth.users table';