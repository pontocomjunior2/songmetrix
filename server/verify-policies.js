import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: path.join(dirname(__dirname), '.env') });

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

async function verifyPolicies() {
  try {
    console.log('Testing admin access...');
    
    // Sign in as admin
    const { data: { user: adminUser }, error: signInError } = await supabase.auth.signInWithPassword({
      email: 'admin@songmetrix.com',
      password: 'Admin@@2024'
    });

    if (signInError) {
      console.error('Error signing in as admin:', signInError);
      return;
    }

    console.log('Admin signed in successfully:', adminUser.email);

    // Test reading users
    const { data: users, error: readError } = await supabase
      .from('users')
      .select('*');

    if (readError) {
      console.error('Error reading users:', readError);
    } else {
      console.log('Successfully read users:', users);
    }

    // Test updating admin user
    const { error: updateError } = await supabase
      .from('users')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', adminUser.id);

    if (updateError) {
      console.error('Error updating user:', updateError);
    } else {
      console.log('Successfully updated admin user');
    }

    console.log('Policy verification complete!');
  } catch (error) {
    console.error('Error:', error);
  } finally {
    process.exit();
  }
}

verifyPolicies();
