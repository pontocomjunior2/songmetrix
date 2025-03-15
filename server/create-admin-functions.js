import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import pg from 'pg';

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

// Conexão direta com o banco de dados PostgreSQL (usando as credenciais do .env)
const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.POSTGRES_CONNECTION_STRING,
  ssl: { rejectUnauthorized: false }
});

const createAdminFunctions = async () => {
  try {
    console.log('Iniciando criação de funções administrativas no Supabase...');
    
    // Conectar ao banco de dados
    const client = await pool.connect();
    
    try {
      // Criar função para atualizar status de usuário como admin (contornando as políticas RLS)
      const createFunctionQuery = `
        CREATE OR REPLACE FUNCTION admin_update_user_status(user_id UUID, new_status TEXT)
        RETURNS VOID
        LANGUAGE plpgsql
        SECURITY DEFINER -- Executa com os privilégios do criador da função
        AS $$
        BEGIN
          -- Verificar se o status é válido
          IF new_status NOT IN ('ADMIN', 'ATIVO', 'INATIVO', 'TRIAL') THEN
            RAISE EXCEPTION 'Status inválido: %', new_status;
          END IF;
          
          -- Atualizar o status do usuário na tabela users
          UPDATE public.users 
          SET 
            status = new_status,
            updated_at = NOW()
          WHERE id = user_id;
          
          -- Registrar a operação (opcional)
          INSERT INTO admin_audit_log(
            operation, 
            table_name, 
            record_id, 
            old_values, 
            new_values, 
            created_at
          )
          VALUES(
            'update_user_status',
            'users',
            user_id,
            (SELECT json_build_object('status', status, 'updated_at', updated_at) FROM users WHERE id = user_id),
            json_build_object('status', new_status, 'updated_at', NOW()),
            NOW()
          );
          
          RETURN;
        END;
        $$;
      `;
      
      // Criar tabela de auditoria se não existir
      const createAuditTable = `
        CREATE TABLE IF NOT EXISTS admin_audit_log (
          id SERIAL PRIMARY KEY,
          operation TEXT NOT NULL,
          table_name TEXT NOT NULL,
          record_id UUID NOT NULL,
          old_values JSONB,
          new_values JSONB,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          admin_id UUID -- pode ser NULL para operações automatizadas
        );
      `;
      
      // Criar tabela de tarefas administrativas se não existir
      const createTasksTable = `
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
      `;
      
      // Executar criação da tabela de auditoria
      console.log('Criando tabela de auditoria...');
      await client.query(createAuditTable);
      console.log('Tabela de auditoria criada ou já existente');
      
      // Executar criação da tabela de tarefas
      console.log('Criando tabela de tarefas administrativas...');
      await client.query(createTasksTable);
      console.log('Tabela de tarefas administrativas criada ou já existente');
      
      // Executar criação da função
      console.log('Criando função admin_update_user_status...');
      await client.query(createFunctionQuery);
      console.log('Função admin_update_user_status criada com sucesso');
      
      console.log('Verificando acesso...');
      const { rows } = await client.query(`
        SELECT has_function_privilege(
          'admin_update_user_status(uuid, text)',
          'execute'
        ) as can_execute;
      `);
      
      if (rows[0].can_execute) {
        console.log('Função pode ser executada pelo usuário atual');
      } else {
        console.warn('AVISO: O usuário atual pode não ter permissão para executar a função');
      }
      
      // Criar função RPC no Supabase
      console.log('Registrando função como RPC no Supabase...');
      const { error } = await supabaseAdmin.rpc('admin_update_user_status', {
        user_id: '00000000-0000-0000-0000-000000000000',  // ID fictício para testar
        new_status: 'ATIVO'
      });
      
      if (error && error.message.includes('function does not exist')) {
        console.error('Erro ao chamar RPC - a função pode não estar exposta no Supabase:', error);
        console.log('Será necessário configurar a função como uma API pública no painel do Supabase');
      } else if (error && error.message.includes('invalid input')) {
        console.log('Função RPC está registrada, mas requer ID válido (comportamento esperado)');
      } else if (error) {
        console.error('Erro desconhecido ao testar função RPC:', error);
      } else {
        console.log('Teste de função RPC bem-sucedido');
      }
      
      console.log('Configuração de funções administrativas concluída!');
    } finally {
      // Sempre liberar o cliente quando terminar
      client.release();
    }
    
  } catch (err) {
    console.error('Erro ao configurar funções administrativas:', err);
    process.exit(1);
  } finally {
    // Fechar pool de conexões
    await pool.end();
  }
};

// Executar a criação das funções
createAdminFunctions().then(() => {
  console.log('Script finalizado');
  process.exit(0);
}).catch(err => {
  console.error('Falha no script:', err);
  process.exit(1);
}); 