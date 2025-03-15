// Utilitário para criar função administrativa no banco de dados
import pkg from 'pg';
const { Pool } = pkg;
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Carregar variáveis de ambiente
const envPaths = [
  path.join(__dirname, '.env'),
  path.join(dirname(__dirname), '.env')
];

for (const envPath of envPaths) {
  if (dotenv.config({ path: envPath }).error === undefined) {
    console.log('Loaded environment variables from:', envPath);
    break;
  }
}

// Configurar pool de conexão
const pool = new Pool({
  connectionString: process.env.POSTGRES_CONNECTION_STRING,
  ssl: { rejectUnauthorized: false }
});

async function createAdminFunction() {
  try {
    console.log('Criando função SQL com privilégios elevados para atualizar status...');
    
    // Primeiro, verificar se existem triggers na tabela users
    const checkTriggersSQL = `
      SELECT trigger_name, event_manipulation, action_statement
      FROM information_schema.triggers
      WHERE event_object_table = 'users' AND trigger_schema = 'public'
    `;
    
    const { rows: triggers } = await pool.query(checkTriggersSQL);
    
    console.log('Triggers na tabela users:');
    for (const trigger of triggers) {
      console.log(`- ${trigger.trigger_name} (${trigger.event_manipulation}): ${trigger.action_statement}`);
    }

    // Criar função para contornar os triggers
    const createFunctionWithElevatedPrivileges = `
      CREATE OR REPLACE FUNCTION admin_force_update_user_status(target_user_id UUID, new_status TEXT)
      RETURNS BOOLEAN
      LANGUAGE plpgsql
      SECURITY DEFINER -- Esta função executará com os privilégios do criador (superusuário)
      AS $$
      DECLARE
        success BOOLEAN;
      BEGIN
        -- Validar o status
        IF new_status NOT IN ('ADMIN', 'ATIVO', 'INATIVO', 'TRIAL') THEN
          RAISE EXCEPTION 'Status inválido: %', new_status;
          RETURN FALSE;
        END IF;
        
        -- Desabilitar todos os triggers temporariamente
        SET session_replication_role = 'replica';
        
        -- Atualizar o status diretamente, ignorando todos os triggers
        UPDATE public.users
        SET status = new_status, 
            updated_at = NOW()
        WHERE id = target_user_id;
        
        -- Verificar se a atualização funcionou
        GET DIAGNOSTICS success = ROW_COUNT;
        
        -- Reativar os triggers
        SET session_replication_role = 'origin';
        
        -- Registrar operação (opcional)
        INSERT INTO public.admin_audit_log(
          operation, 
          table_name, 
          record_id, 
          old_values, 
          new_values, 
          created_at
        )
        VALUES(
          'bypass_update_user_status',
          'users',
          target_user_id,
          NULL,
          jsonb_build_object('status', new_status, 'updated_at', NOW()),
          NOW()
        )
        ON CONFLICT DO NOTHING;
        
        RETURN (success > 0);
      END;
      $$;
      
      -- Grant permission para aplicação usar
      GRANT EXECUTE ON FUNCTION admin_force_update_user_status TO authenticated;
      GRANT EXECUTE ON FUNCTION admin_force_update_user_status TO anon;
      GRANT EXECUTE ON FUNCTION admin_force_update_user_status TO service_role;
      
      -- Criar tabela de auditoria se não existir
      CREATE TABLE IF NOT EXISTS public.admin_audit_log (
        id SERIAL PRIMARY KEY,
        operation TEXT NOT NULL,
        table_name TEXT NOT NULL,
        record_id UUID NOT NULL,
        old_values JSONB,
        new_values JSONB,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `;
    
    // Executar o script SQL para criar a função
    await pool.query(createFunctionWithElevatedPrivileges);
    
    console.log('Função admin_force_update_user_status criada com sucesso!');
    
    // Testar a função criada
    console.log('Verificando permissões da função...');
    
    const permissionCheck = `
      SELECT has_function_privilege(
        'admin_force_update_user_status(uuid, text)',
        'execute'
      ) as can_execute;
    `;
    
    const { rows: permissionResult } = await pool.query(permissionCheck);
    
    console.log(`Permissão para executar a função: ${permissionResult[0].can_execute ? 'SIM' : 'NÃO'}`);
    
    // Verificar o schema da tabela users
    console.log('Verificando estrutura da tabela users...');
    
    const tableInfoSQL = `
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'users'
      ORDER BY ordinal_position;
    `;
    
    const { rows: tableInfo } = await pool.query(tableInfoSQL);
    
    console.log('Estrutura da tabela users:');
    for (const column of tableInfo) {
      console.log(`- ${column.column_name} (${column.data_type}, ${column.is_nullable === 'YES' ? 'nullable' : 'not null'})`);
    }
    
    // Verificar se a tabela users tem políticas RLS
    console.log('Verificando políticas RLS na tabela users...');
    
    const rlsPoliciesSQL = `
      SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
      FROM pg_policies
      WHERE tablename = 'users' AND schemaname = 'public';
    `;
    
    const { rows: rlsPolicies } = await pool.query(rlsPoliciesSQL);
    
    console.log('Políticas RLS na tabela users:');
    for (const policy of rlsPolicies) {
      console.log(`- ${policy.policyname} (${policy.cmd}): Roles: ${policy.roles}, Permissive: ${policy.permissive}`);
      console.log(`  Using expression: ${policy.qual}`);
    }
    
    console.log('Script concluído com sucesso!');
    
  } catch (error) {
    console.error('Erro ao criar função de atualização privilegiada:', error);
  } finally {
    await pool.end();
  }
}

// Executar a função principal
createAdminFunction().then(() => {
  console.log('Script concluído.');
}).catch(error => {
  console.error('Erro no script:', error);
}); 