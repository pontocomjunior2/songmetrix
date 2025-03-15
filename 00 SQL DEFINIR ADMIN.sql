-- Script para atualizar status de usuário para ADMIN (com suporte a ENUM)
DO $$ 
DECLARE
    target_user_id TEXT := '0b671175-c282-4e3b-b53d-e82468d315e5'; -- ID do usuário a ser alterado
    new_status TEXT := 'ADMIN'; -- Novo status (tem que ser um valor válido no ENUM user_status)
    current_status TEXT;
    updated_status TEXT;
BEGIN
    -- Verificar status atual antes da mudança
    RAISE NOTICE '===== INICIANDO ATUALIZAÇÃO DE STATUS =====';

    SELECT status INTO current_status
    FROM public.users
    WHERE id = target_user_id::UUID;

    RAISE NOTICE 'Status atual: %', current_status;

    -- Desativar políticas RLS temporariamente
    EXECUTE 'SET session_replication_role = ''replica''';

    -- Atualizar o status (convertendo explicitamente para user_status)
    UPDATE public.users
    SET
        status = new_status::user_status, -- CORREÇÃO: Conversão para ENUM
        updated_at = NOW()
    WHERE id = target_user_id::UUID;

    -- Restaurar políticas RLS
    EXECUTE 'SET session_replication_role = ''origin''';

    -- Verificar status após a mudança
    SELECT status INTO updated_status
    FROM public.users
    WHERE id = target_user_id::UUID;

    RAISE NOTICE 'Status após atualização: %', updated_status;
    
    -- Verificação final
    IF updated_status = 'ADMIN' THEN
        RAISE NOTICE '✓ Status atualizado com sucesso para ADMIN!';
    ELSE
        RAISE NOTICE '❌ Falha na atualização! Status atual: %', updated_status;
    END IF;

    -- Criar tabela de auditoria se não existir
    CREATE TABLE IF NOT EXISTS admin_audit_log (
        id SERIAL PRIMARY KEY,
        operation VARCHAR(255) NOT NULL,
        target_table VARCHAR(255) NOT NULL,
        record_id UUID NOT NULL,
        old_value TEXT,
        new_value TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );

    -- Inserir registro da alteração na auditoria
    INSERT INTO admin_audit_log (
        operation,
        target_table,
        record_id,
        old_value,
        new_value,
        created_at
    ) VALUES (
        'update_user_status',
        'users',
        target_user_id::UUID,
        current_status,
        new_status,
        NOW()
    );

    RAISE NOTICE '===== ATUALIZAÇÃO DE STATUS CONCLUÍDA =====';

END $$;
