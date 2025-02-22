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

async function verifyAdmin() {
  try {
    console.log('Verifying admin user...');

    // Check if admin exists in auth.users
    const { data: { users }, error: usersError } = await supabase.auth.admin.listUsers();
    if (usersError) throw usersError;

    console.log('Current users:', users);

    const adminEmail = 'admin@songmetrix.com';
    let adminUser = users.find(u => u.email === adminEmail);
    console.log('Found admin user:', adminUser);

    if (!adminUser) {
      console.log('Admin user not found, creating...');
      
      // Create admin in auth.users
      const { data: { user }, error: createError } = await supabase.auth.admin.createUser({
        email: adminEmail,
        password: 'Admin@@2024',
        email_confirm: true,
        app_metadata: {
          role: 'admin'
        },
        user_metadata: {
          status: 'ADMIN'
        }
      });

      if (createError) throw createError;
      adminUser = user;
      console.log('Created admin user');
    }

    // Ensure admin exists in public.users table
    console.log('Checking public.users table...');
    const { data: existingUser, error: checkError } = await supabase
      .from('users')
      .select('*')
      .eq('email', adminEmail)
      .single();

    console.log('Existing user in public.users:', existingUser);
    console.log('Check error:', checkError);

    if (checkError && checkError.code !== 'PGRST116') throw checkError;

    if (!existingUser) {
      console.log('Creating admin in public.users...');
      const { error: insertError } = await supabase
        .from('users')
        .insert({
          id: adminUser.id,
          email: adminUser.email,
          status: 'ADMIN',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });
      if (insertError) throw insertError;
    } else {
      console.log('Updating admin in public.users...');
      const { error: updateError } = await supabase
        .from('users')
        .update({
          status: 'ADMIN',
          updated_at: new Date().toISOString()
        })
        .eq('id', adminUser.id);
      if (updateError) throw updateError;
    }

    // Update admin user's metadata and role
    console.log('Updating admin metadata and role...');
    const { error: updateError } = await supabase.auth.admin.updateUserById(
      adminUser.id,
      {
        app_metadata: {
          role: 'admin'
        },
        user_metadata: {
          status: 'ADMIN'
        },
        email_confirm: true
      }
    );
    if (updateError) throw updateError;

    // Execute the simplified RLS policies
    console.log('Applying simplified RLS policies...');
    const policiesSQL = `
      -- Disable RLS temporarily
      ALTER TABLE users DISABLE ROW LEVEL SECURITY;

      -- Drop all existing policies
      DROP POLICY IF EXISTS "users_select_policy" ON users;
      DROP POLICY IF EXISTS "users_update_policy" ON users;
      DROP POLICY IF EXISTS "users_insert_policy" ON users;
      DROP POLICY IF EXISTS "users_delete_policy" ON users;
      DROP POLICY IF EXISTS "basic_users_policy" ON users;
      DROP POLICY IF EXISTS "users_policy" ON users;

      -- Enable RLS
      ALTER TABLE users ENABLE ROW LEVEL SECURITY;

      -- Create a single, simple policy for all operations
      CREATE POLICY "users_policy"
      ON users
      FOR ALL
      TO authenticated
      USING (
        -- Users can access their own data
        auth.uid() = id
        OR
        -- Users with ADMIN status in their JWT claims can access all data
        (auth.jwt() ->> 'user_metadata')::jsonb ->> 'status' = 'ADMIN'
      );
    `;
    
    await supabase.rpc('exec_sql', { sql: policiesSQL });

    console.log('Admin verification complete!');
    console.log('Admin credentials:');
    console.log('Email: admin@songmetrix.com');
    console.log('Password: Admin@@2024');
  } catch (error) {
    console.error('Error:', error);
  } finally {
    process.exit();
  }
}

verifyAdmin();
