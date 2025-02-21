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

// Create Supabase admin client
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

async function executeMigration() {
  try {
    // Read migration file
    const migrationPath = path.join(__dirname, '../scripts/apply_migrations.sql');
    const migration = fs.readFileSync(migrationPath, 'utf8');

    console.log('Executing migration...');

    // Execute migration using Supabase's raw SQL query
    const { data, error } = await supabase.rpc('exec_sql', { sql: migration });

    if (error) {
      console.error('Error executing migration:', error);
      process.exit(1);
    }

    console.log('Migration completed successfully');
  } catch (error) {
    console.error('Error executing migration:', error);
    process.exit(1);
  }
}

executeMigration();
