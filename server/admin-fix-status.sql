-- Script para atualizar status de usuário para ADMIN
-- Execute este script no SQL Editor do Supabase 
-- Acessível em https://supabase.com/dashboard -> Seu Projeto -> SQL Editor

-- Configuração - Atualize estas variáveis
DECLARE 
  target_user_id UUID := '0b671175-c282-4e3b-b53d-e82468d315e5'; -- ID do usuário a ser alterado
  new_status TEXT := 'ADMIN'; -- Novo status (ADMIN, ATIVO, INATIVO, TRIAL)

BEGIN
  -- Verificar status atual antes da mudança
  RAISE NOTICE '===== INICIANDO ATUALIZAÇÃO DE STATUS =====';
  
  DO $$
  DECLARE
    current_status TEXT;
  BEGIN
    SELECT status INTO current_status 
    FROM public.users 
    WHERE id = '0b671175-c282-4e3b-b53d-e82468d315e5';
    
    RAISE NOTICE 'Status atual: %', current_status;
  END $$;
  
  -- IMPORTANTE: Desativar todas as políticas RLS temporariamente
  -- Isso permite que o Supabase atualize o registro ignorando restrições
  SET session_replication_role = 'replica';
  
  -- Atualizar o status para ADMIN
  UPDATE public.users
  SET 
    status = new_status,
    updated_at = NOW()
  WHERE 
    id = target_user_id;
  
  -- Restaurar políticas RLS
  SET session_replication_role = 'origin';
  
  -- Verificar status após a mudança
  DO $$
  DECLARE
    updated_status TEXT;
  BEGIN
    SELECT status INTO updated_status 
    FROM public.users 
    WHERE id = '0b671175-c282-4e3b-b53d-e82468d315e5';
    
    RAISE NOTICE 'Status após atualização: %', updated_status;
    
    IF updated_status = 'ADMIN' THEN
      RAISE NOTICE '✓ Status atualizado com sucesso para ADMIN!';
    ELSE
      RAISE NOTICE '❌ Falha na atualização! Status atual: %', updated_status;
    END IF;
  END $$;
  
  -- Registrar a operação para auditoria
  -- Criar tabela de log se não existir
  CREATE TABLE IF NOT EXISTS admin_audit_log (
    id SERIAL PRIMARY KEY,
    operation VARCHAR(255) NOT NULL,
    target_table VARCHAR(255) NOT NULL,
    record_id UUID NOT NULL,
    old_value TEXT,
    new_value TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
  );
  
  -- Inserir registro de auditoria
  INSERT INTO admin_audit_log (
    operation,
    target_table,
    record_id,
    new_value,
    created_at
  ) VALUES (
    'update_user_status',
    'users',
    target_user_id,
    new_status,
    NOW()
  );
  
  RAISE NOTICE '===== ATUALIZAÇÃO DE STATUS CONCLUÍDA =====';
END; 