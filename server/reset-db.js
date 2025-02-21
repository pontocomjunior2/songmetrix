import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
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

async function resetDatabase() {
  try {
    console.log('Starting database reset...');

    // Delete all existing users from auth.users
    const { data: { users }, error: usersError } = await supabase.auth.admin.listUsers();
    if (usersError) throw usersError;

    for (const user of users) {
      const { error: deleteError } = await supabase.auth.admin.deleteUser(user.id);
      if (deleteError) throw deleteError;
    }
    console.log('Deleted existing users');

    // Delete all data from public.users
    const { error: truncateError } = await supabase
      .from('users')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all rows
    if (truncateError) throw truncateError;
    console.log('Truncated users table');

    // Wait a moment for deletions to complete
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Create new admin user
    const { data: { user }, error: signUpError } = await supabase.auth.signUp({
      email: 'admin@songmetrix.com',
      password: 'Admin@@2024',
      options: {
        data: {
          status: 'ADMIN'
        }
      }
    });
    if (signUpError) throw signUpError;
    console.log('Created new admin user:', user);

    // Confirm the user's email immediately
    const { error: updateError } = await supabase.auth.admin.updateUserById(
      user.id,
      { email_confirm: true }
    );
    if (updateError) throw updateError;
    console.log('Confirmed admin user email');

    // Set user as admin in public.users
    const { error: insertError } = await supabase
      .from('users')
      .upsert({
        id: user.id,
        email: user.email,
        status: 'ADMIN',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });
    if (insertError) throw insertError;
    console.log('Set user as admin');

    console.log('Database reset complete!');
    console.log('Admin credentials:');
    console.log('Email: admin@songmetrix.com');
    console.log('Password: Admin@@2024');
  } catch (error) {
    console.error('Error resetting database:', error);
  } finally {
    process.exit();
  }
}

resetDatabase();
