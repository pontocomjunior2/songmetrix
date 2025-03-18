import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Get the current file's directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

async function applyMigration() {
  try {
    // Read the SQL file
    const sqlFilePath = 'migrate_user_metadata.sql';
    const fullPath = path.resolve(__dirname, sqlFilePath);
    console.log(`Reading SQL file: ${fullPath}`);
    
    if (!fs.existsSync(fullPath)) {
      console.error(`SQL file not found: ${fullPath}`);
      process.exit(1);
    }
    
    const sqlContent = fs.readFileSync(fullPath, 'utf8');
    console.log('SQL content loaded successfully');
    
    // Execute the SQL directly using RPC
    console.log('Executing SQL migration...');
    const { data, error } = await supabase.rpc('exec_sql', { sql: sqlContent });
    
    if (error) {
      console.error('Error executing migration:', error);
      process.exit(1);
    }
    
    console.log('Migration completed successfully');
  } catch (error) {
    console.error('Error applying migration:', error);
    process.exit(1);
  }
}

applyMigration();