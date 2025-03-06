// Script to apply the Stripe customer fields migration
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import dotenv from 'dotenv';
import { dirname } from 'path';
import { fileURLToPath } from 'url';

// Setup ES modules compatibility
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

// Read the migration SQL file
const migrationPath = 'supabase/migrations/20250316000005_add_stripe_customer_fields.sql';
const sql = fs.readFileSync(migrationPath, 'utf8');

async function applyMigration() {
  console.log(`Applying migration: ${migrationPath}`);
  
  try {
    // Execute each statement separately
    const statements = sql.split(';').filter(stmt => stmt.trim().length > 0);
    
    for (const statement of statements) {
      try {
        // Using 'sql' parameter instead of 'sql_query' based on the error message
        const { error } = await supabase.rpc('exec_sql', { 
          sql: statement + ';' 
        });
        
        if (error) {
          // Check if it's just a "policy already exists" error, which we can ignore
          if (error.message && error.message.includes('policy') && error.message.includes('already exists')) {
            console.log('Policy already exists, skipping this statement');
            continue;
          }
          
          console.error('Error executing statement:', statement);
          throw error;
        }
      } catch (stmtError) {
        // Check if it's just a "policy already exists" error, which we can ignore
        if (stmtError.message && stmtError.message.includes('policy') && stmtError.message.includes('already exists')) {
          console.log('Policy already exists, skipping this statement');
          continue;
        }
        throw stmtError;
      }
    }
    
    console.log('Migration applied successfully!');
  } catch (error) {
    console.error('Error applying migration:', error);
    process.exit(1);
  }
}

// Run the migration
applyMigration();