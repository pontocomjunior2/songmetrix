import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const migrationsPath = path.join(__dirname, '../supabase/migrations');
const migrationFiles = [
  // Adicione o arquivo da função exec_sql primeiro
  '20250214000072_create_exec_sql_function.sql',
  '20250214000073_update_user_status_function.sql',
  '20250214000074_update_user_status_policy.sql'
];

async function applyMigrations() {
  try {
    for (const file of migrationFiles) {
      console.log(`Applying migration: ${file}`);
      const migration = fs.readFileSync(path.join(migrationsPath, file), 'utf8');
      
      // Para a primeira migration (criação da função exec_sql),
      // use uma abordagem diferente se necessário
      if (file === '20250214000072_create_exec_sql_function.sql') {
        // Você pode precisar usar outro método aqui,
        // como conectar diretamente ao PostgreSQL
        const { error } = await supabase.rpc('exec_sql', { sql: migration });
        if (error) throw error;
      } else {
        const { error } = await supabase.rpc('exec_sql', { sql: migration });
        if (error) throw error;
      }
      
      console.log(`Successfully applied: ${file}`);
    }
    console.log('All migrations completed successfully');
  } catch (error) {
    console.error('Error applying migrations:', error);
    process.exit(1);
  }
}

applyMigrations();
