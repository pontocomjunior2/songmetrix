/*
 * Script SQL para contornar restrições RLS na tabela users
 * Para atualizar status para ADMIN
 *
 * INSTRUÇÕES DE USO:
 * 1. Acesse o Supabase Studio (https://supabase.com/dashboard)
 * 2. Selecione seu projeto
 * 3. Vá para o SQL Editor
 * 4. Cole este script
 * 5. Substitua os valores em CONFIGURAÇÃO abaixo
 * 6. Execute o script
 */

-- CONFIGURAÇÃO
DO $$
DECLARE
  target_user_id UUID := '0b671175-c282-4e3b-b53d-e82468d315e5'; -- Substitua pelo ID do usuário
  new_status TEXT := 'ADMIN'; -- Status desejado (ADMIN, ATIVO, INATIVO, TRIAL)
  success BOOLEAN;
BEGIN
  -- Validar o status
  IF new_status NOT IN ('ADMIN', 'ATIVO', 'INATIVO', 'TRIAL') THEN
    RAISE EXCEPTION 'Status inválido: %', new_status;
    RETURN;
  END IF;
  
  -- Primeiro, verificar status atual
  RAISE NOTICE 'Verificando status atual para usuário %', target_user_id;
  
  PERFORM status FROM public.users WHERE id = target_user_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Usuário não encontrado: %', target_user_id;
    RETURN;
  END IF;
  
  -- Desabilitar temporariamente restrições RLS
  RAISE NOTICE 'Desativando temporariamente Row Level Security';
  SET session_replication_role = 'replica';
  
  -- Atualizar o status
  RAISE NOTICE 'Atualizando status para %', new_status;
  UPDATE public.users
  SET status = new_status,
      updated_at = NOW()
  WHERE id = target_user_id;
  
  -- Verificar se a atualização funcionou
  GET DIAGNOSTICS success = ROW_COUNT;
  
  -- Reativar RLS
  SET session_replication_role = 'origin';
  
  -- Verificar status após atualização
  DECLARE
    current_status TEXT;
  BEGIN
    SELECT status INTO current_status 
    FROM public.users 
    WHERE id = target_user_id;
    
    RAISE NOTICE 'Status após atualização: %', current_status;
    
    IF current_status = new_status THEN
      RAISE NOTICE '✓ Status atualizado com sucesso!';
    ELSE
      RAISE NOTICE '❌ Falha na atualização de status!';
    END IF;
  END;
  
  -- Registrar operação para auditoria
  BEGIN
    CREATE TABLE IF NOT EXISTS public.admin_audit_log (
      id SERIAL PRIMARY KEY,
      operation TEXT NOT NULL,
      table_name TEXT NOT NULL,
      record_id UUID NOT NULL,
      old_values JSONB,
      new_values JSONB,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
    
    INSERT INTO public.admin_audit_log(
      operation, 
      table_name, 
      record_id, 
      new_values, 
      created_at
    )
    VALUES(
      'manual_update_status',
      'users',
      target_user_id,
      jsonb_build_object('status', new_status, 'updated_at', NOW()),
      NOW()
    );
    
    RAISE NOTICE '✓ Log de auditoria registrado';
  EXCEPTION
    WHEN OTHERS THEN
      RAISE NOTICE '⚠️ Não foi possível registrar auditoria: %', SQLERRM;
  END;
END $$;

-- Verificar políticas RLS na tabela users
SELECT
  tablename,
  policyname,
  permissive,
  cmd,
  qual,
  with_check,
  roles
FROM
  pg_policies
WHERE
  tablename = 'users'
  AND schemaname = 'public'
ORDER BY
  policyname;

-- Criar política RLS que permite service_role atualizar para ADMIN
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'users'
      AND policyname = 'service_role_admin_update'
  ) THEN
    EXECUTE 
    'CREATE POLICY service_role_admin_update ON public.users
     FOR UPDATE
     USING (auth.role() = ''service_role'')
     WITH CHECK (auth.role() = ''service_role'')';
     
    RAISE NOTICE '✓ Política service_role_admin_update criada';
  ELSE
    RAISE NOTICE 'Política service_role_admin_update já existe';
  END IF;
END $$; 