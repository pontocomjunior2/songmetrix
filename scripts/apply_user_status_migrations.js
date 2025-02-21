import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config();

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

const migrations = [
  '20250214000071_update_user_status_policy.sql',
  '20250214000072_create_update_user_status_transaction.sql'
];

async function applyMigrations() {
  try {
    console.log('Applying user status migrations...');
    
    for (const migration of migrations) {
      console.log(`Applying migration: ${migration}`);
      
      // Read migration file
      const migrationPath = path.join(__dirname, '../supabase/migrations', migration);
      const sql = fs.readFileSync(migrationPath, 'utf8');

      // Execute migration
      const { error } = await supabase.rpc('exec_sql', { sql });
      
      if (error) {
        throw error;
      }

      console.log(`Successfully applied migration: ${migration}`);
    }

    console.log('All migrations applied successfully');
  } catch (error) {
    console.error('Error applying migrations:', error);
    process.exit(1);
  }
}

applyMigrations();
