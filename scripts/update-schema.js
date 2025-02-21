const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://aylxcqaddelwxfukerhr.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF5bHhjcWFkZGVsd3hmdWtlcmhyIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0MDAxNzY1OSwiZXhwIjoyMDU1NTkzNjU5fQ.9mDw6OI19hfyY4wS9nnTUEDRV9YjLgtzfnoNNpTOKik';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function updateSchema() {
  try {
    console.log('Starting schema update...');

    // Add favorite_radios column
    const { data: columnData, error: columnError } = await supabase
      .from('users')
      .select('id')
      .limit(1);

    if (columnError) {
      console.error('Error checking users table:', columnError);
      return;
    }

    const { error: alterError } = await supabase.rpc('exec_sql', {
      sql: `
        ALTER TABLE users 
        ADD COLUMN IF NOT EXISTS favorite_radios text[] DEFAULT '{}'::text[];
      `
    });

    if (alterError) {
      console.error('Error adding column:', alterError);
      return;
    }
    console.log('Added favorite_radios column');

    // Create policy
    const { error: policyError } = await supabase.rpc('exec_sql', {
      sql: `
        DO $$
        BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM pg_policies 
            WHERE tablename = 'users' 
            AND policyname = 'Users can update their favorite radios'
          ) THEN
            CREATE POLICY "Users can update their favorite radios" ON users
            FOR UPDATE 
            USING (auth.uid() = id)
            WITH CHECK (auth.uid() = id);
          END IF;
        END
        $$;
      `
    });

    if (policyError) {
      console.error('Error creating policy:', policyError);
      return;
    }
    console.log('Created policy');

    // Grant permissions
    const { error: grantError } = await supabase.rpc('exec_sql', {
      sql: `GRANT ALL ON users TO authenticated;`
    });

    if (grantError) {
      console.error('Error granting permissions:', grantError);
      return;
    }
    console.log('Granted permissions');

    console.log('Schema update completed successfully');
  } catch (error) {
    console.error('Unexpected error:', error);
  }
}

updateSchema();
