import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import fs from 'fs';

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

async function verifySchema() {
  try {
    console.log('Verifying database schema...');

    // Check if users table exists
    const { data: tableExists, error: tableError } = await supabase
      .from('users')
      .select('id')
      .limit(1);

    if (tableError && tableError.code === 'PGRST204') {
      console.log('Creating users table...');
      await supabase.rpc('create_users_table');
    }

    // Apply migrations
    console.log('Applying migrations...');
    
    // Read migration files
    const migrationsDir = path.join(dirname(__dirname), 'supabase', 'migrations');
    const migrationFiles = fs.readdirSync(migrationsDir)
      .filter(file => file.endsWith('.sql'))
      .sort();

    for (const file of migrationFiles) {
      console.log(`Applying migration: ${file}`);
      const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
      
      // Split SQL into individual statements
      const statements = sql
        .split(';')
        .map(s => s.trim())
        .filter(s => s.length > 0);

      // Execute each statement
      for (const statement of statements) {
        const { error } = await supabase.rpc('exec_sql', { sql: statement });
        if (error) {
          console.warn(`Warning executing statement from ${file}:`, error);
          // Continue with next statement even if there's an error
        }
      }
    }

    console.log('Verifying admin user...');
    const { data: adminUser, error: adminError } = await supabase
      .from('users')
      .select('*')
      .eq('email', 'admin@songmetrix.com')
      .single();

    if (adminError) {
      console.log('Admin user not found in users table');
      
      // Get admin user from auth.users
      const { data: { users }, error: authError } = await supabase.auth.admin.listUsers();
      if (authError) throw authError;

      const authAdmin = users.find(u => u.email === 'admin@songmetrix.com');
      if (!authAdmin) throw new Error('Admin user not found in auth.users');

      // Create admin user in users table
      const { error: insertError } = await supabase
        .from('users')
        .insert({
          id: authAdmin.id,
          email: authAdmin.email,
          status: 'ADMIN',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });

      if (insertError) throw insertError;
      console.log('Created admin user in users table');
    } else {
      console.log('Admin user exists:', adminUser);
    }

    console.log('Schema verification complete!');
  } catch (error) {
    console.error('Error verifying schema:', error);
  } finally {
    process.exit();
  }
}

verifySchema();
