// Criação direta da função admin_set_user_status no PostgreSQL
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
    console.log('Variáveis de ambiente carregadas de:', envPath);
    break;
  }
}

// Configurar conexão PostgreSQL usando a string de conexão direta
const pool = new Pool({
  connectionString: process.env.POSTGRES_CONNECTION_STRING,
  ssl: { rejectUnauthorized: false }
});

async function createAdminFunction() {
  try {
    console.log('Conectando ao banco de dados para criar função admin_set_user_status...');
    
    // Primeiro verificar políticas RLS na tabela users
    console.log('Verificando políticas RLS existentes...');
    const checkRlsQuery = `
      SELECT tablename, policyname, permissive, cmd, qual, with_check
      FROM pg_policies
      WHERE tablename = 'users' AND schemaname = 'public'
    `;
    
    const { rows: policies } = await pool.query(checkRlsQuery);
    
    console.log(`Encontradas ${policies.length} políticas RLS na tabela users:`);
    for (const policy of policies) {
      console.log(`- ${policy.policyname}: ${policy.cmd} (${policy.permissive ? 'PERMISSIVE' : 'RESTRICTIVE'})`);
      if (policy.qual) console.log(`  USING: ${policy.qual}`);
      if (policy.with_check) console.log(`  WITH CHECK: ${policy.with_check}`);
    }
    
    // Criar função SECURITY DEFINER para atualizar status
    console.log('Criando função admin_set_user_status...');
    const createFunctionQuery = `
      CREATE OR REPLACE FUNCTION public.admin_set_user_status(
        target_user_id UUID,
        new_status TEXT
      )
      RETURNS BOOLEAN
      LANGUAGE plpgsql
      SECURITY DEFINER -- Executa com privilégios do criador
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
      EXCEPTION
        WHEN undefined_table THEN
          -- Tabela admin_audit_log não existe
          -- Criar tabela
          CREATE TABLE IF NOT EXISTS public.admin_audit_log (
            id SERIAL PRIMARY KEY,
            operation TEXT NOT NULL,
            table_name TEXT NOT NULL,
            record_id UUID NOT NULL,
            old_values JSONB,
            new_values JSONB,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
          );
          
          -- Tentar inserir novamente
          INSERT INTO public.admin_audit_log(
            operation, 
            table_name, 
            record_id, 
            new_values, 
            created_at
          )
          VALUES(
            'bypass_update_user_status',
            'users',
            target_user_id,
            jsonb_build_object('status', new_status, 'updated_at', NOW()),
            NOW()
          );
          
          RETURN (success > 0);
        WHEN OTHERS THEN
          -- Só retornar o resultado da atualização
          RETURN (success > 0);
      END;
      $$;
      
      -- Grant permission para vários papéis
      GRANT EXECUTE ON FUNCTION public.admin_set_user_status TO authenticated;
      GRANT EXECUTE ON FUNCTION public.admin_set_user_status TO anon;
      GRANT EXECUTE ON FUNCTION public.admin_set_user_status TO service_role;
      
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
    await pool.query(createFunctionQuery);
    
    console.log('✓ Função admin_set_user_status criada com sucesso!');
    
    // Testar a função criada
    console.log('Verificando permissões da função...');
    
    const permissionCheck = `
      SELECT has_function_privilege(
        'admin_set_user_status(uuid, text)',
        'execute'
      ) as can_execute;
    `;
    
    const { rows: permissionResult } = await pool.query(permissionCheck);
    
    console.log(`Permissão para executar a função: ${permissionResult[0].can_execute ? 'SIM' : 'NÃO'}`);
    
    // Adicionar também uma política RLS específica para service_role
    console.log('Criando política RLS específica...');
    
    const createPolicyQuery = `
      -- Verificar se a política já existe
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_policies 
          WHERE schemaname = 'public' 
            AND tablename = 'users' 
            AND policyname = 'service_role_admin_update'
        ) THEN
          -- Criar nova política
          CREATE POLICY service_role_admin_update
          ON public.users
          FOR UPDATE
          USING (
            (current_setting('request.jwt.claims', true)::json->>'role')::text = 'service_role'
          )
          WITH CHECK (
            (current_setting('request.jwt.claims', true)::json->>'role')::text = 'service_role'
          );
        END IF;
      END
      $$;
    `;
    
    await pool.query(createPolicyQuery);
    
    console.log('✓ Política RLS service_role_admin_update adicionada ou já existente!');
    
    console.log('Operação concluída com sucesso!');
    
    return true;
  } catch (error) {
    console.error('Erro ao criar função de atualização privilegiada:', error);
    return false;
  } finally {
    await pool.end();
  }
}

// Executar a função principal
createAdminFunction().then(success => {
  console.log(`Script concluído ${success ? 'com sucesso' : 'com falhas'}.`);
  process.exit(success ? 0 : 1);
}).catch(error => {
  console.error('Erro no script:', error);
  process.exit(1);
}); 