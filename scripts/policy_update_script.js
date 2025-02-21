import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF5bHhjcWFkZGVsd3hmdWtlcmhyIiwicm9zZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0MDAxNzY1OSwiZXhwIjoyMDU1NTkzNjU5fQ.9mDw6OI19hfyY4wS9nnTUEDRV9YjLgtzfnoNNpTOKik'; // Chave de serviço de administrador

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Missing Supabase environment variables');
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true
  }
});

async function applyPolicies() {
  try {
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

    console.log('Policies updated successfully');
  } catch (error) {
    console.error('Error applying migration:', error);
  }
}

applyPolicies();
