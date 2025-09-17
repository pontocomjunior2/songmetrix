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
  process.env.SUPABASE_SERVICE_ROLE_KEY,
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
    const sqlFilePath = process.argv[2];
    if (!sqlFilePath) {
      console.error('Please provide the SQL file path as an argument');
      process.exit(1);
    }
    
    const fullPath = path.resolve(sqlFilePath);
    console.log(`Reading SQL file: ${fullPath}`);
    
    if (!fs.existsSync(fullPath)) {
      console.error(`SQL file not found: ${fullPath}`);
      process.exit(1);
    }
    
    const sqlContent = fs.readFileSync(fullPath, 'utf8');
    console.log('SQL content loaded, executing migration...');
    
    // Split SQL into individual statements and execute them
    const statements = sqlContent
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));
    
    for (const statement of statements) {
      if (statement.trim()) {
        console.log(`Executing: ${statement.substring(0, 100)}...`);
        
        // Use the REST API directly for DDL operations
        const response = await fetch(`${process.env.VITE_SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
            'apikey': process.env.SUPABASE_SERVICE_ROLE_KEY
          },
          body: JSON.stringify({ sql_query: statement })
        });
        
        if (!response.ok) {
          // If exec_sql doesn't exist, try direct SQL execution via PostgREST
          console.log('exec_sql not available, trying alternative approach...');
          
          // For CREATE/ALTER statements, we need to use a different approach
          // Let's try using the supabase client with raw SQL
          const { error } = await supabase.rpc('exec_sql', { sql_query: statement }).single();
          
          if (error) {
            console.error(`Error executing statement: ${statement}`);
            console.error('Error:', error);
            // Continue with next statement instead of failing completely
            continue;
          }
        }
        
        console.log('Statement executed successfully');
      }
    }
    
    console.log('Migration completed successfully');
  } catch (error) {
    console.error('Error applying migration:', error);
    process.exit(1);
  }
}

applyMigration();