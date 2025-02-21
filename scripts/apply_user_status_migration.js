import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

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

async function applyMigration() {
  try {
    console.log('Applying user status update migration...');
    
    // Read migration file
    const migrationPath = path.join(__dirname, '../supabase/migrations/20250214000070_create_update_user_status_function.sql');
    const migration = fs.readFileSync(migrationPath, 'utf8');

    // Execute migration
    const { error } = await supabase.rpc('exec_sql', { sql: migration });
    
    if (error) {
      throw error;
    }

    console.log('Migration applied successfully');
  } catch (error) {
    console.error('Error applying migration:', error);
    process.exit(1);
  }
}

applyMigration();
