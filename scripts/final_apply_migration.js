import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Missing Supabase environment variables');
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true
  }
});

async function applyMigration() {
  try {
    // Add favorite_radios column directly
    const { error: columnError } = await supabase
      .from('users')
      .update({ favorite_radios: [] })
      .eq('id', 'some_user_id'); // This line is just a placeholder

    if (columnError) {
      throw columnError;
    }

    // Update policies
    const { error: policyError } = await supabase
      .rpc('create_users_policy', {
        sql: `
          CREATE POLICY IF NOT EXISTS "Users can update their favorite radios" ON users
          FOR UPDATE 
          USING (auth.uid() = id)
          WITH CHECK (auth.uid() = id);
        `
      });

    if (policyError) {
      throw policyError;
    }

    // Grant permissions
    const { error: grantError } = await supabase
      .rpc('grant_users_permissions', {
        sql: `
          GRANT ALL ON users TO authenticated;
        `
      });

    if (grantError) {
      throw grantError;
    }

    console.log('Migration applied successfully');
  } catch (error) {
    console.error('Error applying migration:', error);
  }
}

applyMigration();
