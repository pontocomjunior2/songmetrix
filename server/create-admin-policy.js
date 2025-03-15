// Script para criar política RLS que permite atualizar status para ADMIN
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import path from 'path';

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

// Criar cliente Supabase com chave de serviço (para acesso administrativo)
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

async function createAdminPolicy() {
  try {
    console.log('Iniciando criação de política para status ADMIN...');
    
    // 1. Verificar se já existe a política
    console.log('Verificando políticas existentes...');
    const { data: existingPolicies, error: policiesError } = await supabaseAdmin.rpc(
      'pg_query',
      { 
        query: `
          SELECT policyname
          FROM pg_policies
          WHERE tablename = 'users' 
            AND schemaname = 'public'
            AND policyname = 'allow_service_role_set_admin'
        `
      }
    );
    
    if (policiesError) {
      console.error('Erro ao verificar políticas existentes:', policiesError);
      
      // Tentar abordagem alternativa - usar função SQL direta
      console.log('Tentando método alternativo...');
      
      // 2. Criar função SQL para contornar restrições RLS
      console.log('Criando função SQL para contornar restrições...');
      const createFunctionQuery = `
        CREATE OR REPLACE FUNCTION public.admin_set_user_status(
          user_id UUID,
          new_status TEXT
        ) RETURNS BOOLEAN
        LANGUAGE plpgsql
        SECURITY DEFINER -- Executa com privilégios do criador (superuser)
        AS $$
        DECLARE
          success BOOLEAN;
        BEGIN
          -- Validar status
          IF new_status NOT IN ('ADMIN', 'ATIVO', 'INATIVO', 'TRIAL') THEN
            RAISE EXCEPTION 'Status inválido: %', new_status;
            RETURN FALSE;
          END IF;
          
          -- Desativar políticas RLS temporariamente
          SET LOCAL session_replication_role = 'replica';
          
          -- Atualizar status do usuário
          UPDATE public.users
          SET status = new_status,
              updated_at = NOW()
          WHERE id = user_id;
          
          -- Verificar se a atualização funcionou
          GET DIAGNOSTICS success = ROW_COUNT;
          
          -- Reativar RLS
          SET LOCAL session_replication_role = 'origin';
          
          -- Registrar a operação para auditoria
          INSERT INTO public.admin_audit_log(
            operation,
            table_name,
            record_id,
            old_values,
            new_values,
            created_at
          )
          VALUES(
            'set_admin_status',
            'users',
            user_id,
            NULL,
            jsonb_build_object('status', new_status),
            NOW()
          )
          ON CONFLICT DO NOTHING;
          
          RETURN success;
        END;
        $$;
        
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
        
        -- Conceder permissões
        GRANT EXECUTE ON FUNCTION public.admin_set_user_status TO service_role;
      `;
      
      // Executar a criação da função
      const { error: functionError } = await supabaseAdmin.rpc(
        'pg_query',
        { query: createFunctionQuery }
      );
      
      if (functionError) {
        console.error('Erro ao criar função:', functionError);
        throw new Error(`Não foi possível criar a função: ${functionError.message}`);
      }
      
      console.log('✓ Função admin_set_user_status criada com sucesso!');
      
      // 3. Testar a função criada
      console.log('Verificando se a função está acessível...');
      const { error: testError } = await supabaseAdmin.rpc(
        'pg_query',
        { 
          query: `
            SELECT has_function_privilege(
              'public.admin_set_user_status(uuid, text)', 
              'execute'
            );
          `
        }
      );
      
      if (testError) {
        console.error('Erro ao verificar função:', testError);
      } else {
        console.log('✓ Função está acessível!');
      }
      
      return true;
    }
    
    // Se a política já existe, informar
    if (existingPolicies && existingPolicies.length > 0) {
      console.log('A política para status ADMIN já existe. Nenhuma ação necessária.');
      return true;
    }
    
    // 4. Criar política RLS para permitir que service_role atualize para ADMIN
    console.log('Criando política RLS para status ADMIN...');
    const createPolicyQuery = `
      -- Habilitar RLS na tabela users (caso ainda não esteja)
      ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
      
      -- Criar política específica para service_role
      CREATE POLICY allow_service_role_set_admin
      ON public.users
      FOR UPDATE
      USING (true)
      WITH CHECK (
        current_setting('role') = 'authenticated' AND
        (current_setting('request.jwt.claims', true)::json->>'role')::text = 'service_role'
      );
    `;
    
    const { error: policyError } = await supabaseAdmin.rpc(
      'pg_query',
      { query: createPolicyQuery }
    );
    
    if (policyError) {
      console.error('Erro ao criar política:', policyError);
      throw new Error(`Não foi possível criar a política: ${policyError.message}`);
    }
    
    console.log('✓ Política RLS para status ADMIN criada com sucesso!');
    return true;
    
  } catch (error) {
    console.error('Erro ao configurar política para status ADMIN:', error);
    return false;
  }
}

// Executar a função principal
createAdminPolicy().then(success => {
  console.log('Resultado da configuração de política ADMIN:', success ? 'SUCESSO' : 'FALHA');
}).catch(error => {
  console.error('Erro na execução do script:', error);
}); 