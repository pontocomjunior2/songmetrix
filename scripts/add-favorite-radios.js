import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://aylxcqaddelwxfukerhr.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF5bHhjcWFkZGVsd3hmdWtlcmhyIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0MDAxNzY1OSwiZXhwIjoyMDU1NTkzNjU5fQ.9mDw6OI19hfyY4wS9nnTUEDRV9YjLgtzfnoNNpTOKik';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function addFavoriteRadiosColumn() {
  try {
    console.log('Adding favorite_radios column...');
    
    const { error } = await supabase
      .from('users')
      .select('id')
      .limit(1);

    if (error?.message?.includes('column "favorite_radios" does not exist')) {
      const { error: alterError } = await supabase.rpc('execute_sql', {
        sql: `
          ALTER TABLE users 
          ADD COLUMN IF NOT EXISTS favorite_radios text[] DEFAULT '{}'::text[];
        `
      });

      if (alterError) {
        throw alterError;
      }
      console.log('Successfully added favorite_radios column');
    } else {
      console.log('favorite_radios column already exists');
    }

  } catch (error) {
    console.error('Error:', error);
  }
}

addFavoriteRadiosColumn();
