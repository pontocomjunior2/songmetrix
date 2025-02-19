/*
  # Remove old abbreviation field from radios table if it exists
*/

DO $$ 
BEGIN
    IF EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'radios' 
        AND column_name = 'abbreviation'
    ) THEN
        ALTER TABLE radios DROP COLUMN abbreviation;
    END IF;
END $$;
