import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: path.join(dirname(__dirname), '.env') });

// Criar cliente Supabase com chave de serviço para acesso admin
const supabaseAdmin = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

const createTables = async () => {
  try {
    console.log('Iniciando criação de tabelas no Supabase...');
    
    // Criar tabela admin_tasks se não existir
    const { error: tasksError } = await supabaseAdmin.rpc('create_admin_tasks_table');
    
    if (tasksError) {
      console.error('Erro ao criar tabela admin_tasks via RPC:', tasksError);
      console.log('Tentando criar tabela diretamente...');
      
      // Tentar criar a tabela diretamente
      const { error: createError } = await supabaseAdmin.from('admin_tasks').select('count').limit(1);
      
      if (createError && createError.message.includes('relation "admin_tasks" does not exist')) {
        console.log('Tabela admin_tasks não existe, criando...');
        
        // Criar a tabela usando SQL
        const { error: sqlError } = await supabaseAdmin.rpc('execute_sql', {
          sql: `
            CREATE TABLE IF NOT EXISTS admin_tasks (
              id SERIAL PRIMARY KEY,
              task_type TEXT NOT NULL,
              user_id UUID NOT NULL,
              new_status TEXT,
              created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
              processed BOOLEAN DEFAULT FALSE,
              processed_at TIMESTAMP WITH TIME ZONE,
              error TEXT
            );
            
            -- Adicionar políticas de segurança
            ALTER TABLE admin_tasks ENABLE ROW LEVEL SECURITY;
            
            -- Criar política para permitir apenas administradores acessarem
            CREATE POLICY admin_tasks_policy ON admin_tasks
              USING (EXISTS (
                SELECT 1 FROM users
                WHERE users.id = auth.uid() AND users.status = 'ADMIN'
              ));
          `
        });
        
        if (sqlError) {
          console.error('Erro ao criar tabela via SQL:', sqlError);
          throw sqlError;
        }
        
        console.log('Tabela admin_tasks criada com sucesso');
      } else if (createError) {
        console.error('Erro ao verificar tabela admin_tasks:', createError);
        throw createError;
      } else {
        console.log('Tabela admin_tasks já existe');
      }
    } else {
      console.log('Tabela admin_tasks criada com sucesso via RPC');
    }
    
    console.log('Criação de tabelas concluída!');
  } catch (err) {
    console.error('Erro ao criar tabelas:', err);
    process.exit(1);
  }
};

// Executar a criação das tabelas
createTables().then(() => {
  console.log('Script finalizado');
  process.exit(0);
}).catch(err => {
  console.error('Falha no script:', err);
  process.exit(1);
}); 