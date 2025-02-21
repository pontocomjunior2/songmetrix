import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const functionPath = path.join(__dirname, '../supabase/migrations/20250214000073_update_user_status_function.sql');
const functionSQL = fs.readFileSync(functionPath, 'utf8');

async function applyFunction() {
  try {
    const { data, error } = await supabase.rpc('exec_sql', { sql: functionSQL });
    if (error) throw error;
    console.log('Function applied successfully');
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

applyFunction();
