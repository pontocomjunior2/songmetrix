import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF5bHhjcWFkZGVsd3hmdWtlcmhyIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0MDAxNzY1OSwiZXhwIjoyMDU1NTkzNjU5fQ.9mDw6OI19hfyY4wS9nnTUEDRV9YjLgtzfnoNNpTOKik; // Chave de serviço de administrador

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Missing Supabase environment variables');
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true
  }
});

async function applyPermissions() {
  try {
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

    console.log('Permissions granted successfully');
  } catch (error) {
    console.error('Error applying permissions:', error);
  }
}

applyPermissions();
