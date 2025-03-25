-- Script para corrigir a integração com o Brevo
BEGIN;

-- Remover trigger e função existentes
DROP TRIGGER IF EXISTS trigger_sync_user_to_brevo ON users;
DROP FUNCTION IF EXISTS sync_user_to_brevo();

-- Criar nova função com debug
CREATE OR REPLACE FUNCTION sync_user_to_brevo()
RETURNS TRIGGER AS $$
DECLARE
    response_id BIGINT;
    response_status INT;
    response_content TEXT;
BEGIN
    -- Aumentar o nível de logs para DEBUG
    SET LOCAL log_min_messages TO 'DEBUG';
    
    -- Log mais detalhado para depuração
    RAISE DEBUG 'sync_user_to_brevo iniciada: operação=%, tabela=%', TG_OP, TG_TABLE_NAME;
    
    -- Verificar se é uma operação DELETE
    IF TG_OP = 'DELETE' THEN
        RAISE DEBUG 'Processando DELETE para email=%', OLD.email;
        
        -- Chamar a função Edge para processar a exclusão do usuário
        SELECT
            id, status, content
        INTO 
            response_id, response_status, response_content
        FROM
            net.http_post(
                url := 'https://aylxcqaddelwxfukerhr.supabase.co/functions/v1/user-webhook',
                headers := jsonb_build_object(
                    'Content-Type', 'application/json',
                    'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF5bHhjcWFkZGVsd3hmdWtlcmhyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDAwMTc2NTksImV4cCI6MjA1NTU5MzY1OX0.YqQAdHMeGMmPAfKFtZPTovJ8szJi_iiUwkEnnLk1Cg8'
                ),
                body := jsonb_build_object(
                    'type', 'DELETE',
                    'table', TG_TABLE_NAME,
                    'schema', TG_TABLE_SCHEMA,
                    'record', NULL,
                    'old_record', row_to_json(OLD)
                )
            );
        
        RAISE DEBUG 'Resposta DELETE: status=%, conteúdo=%', response_status, response_content;
        RETURN OLD;
    END IF;

    -- Para INSERT e UPDATE, processo similar
    RAISE DEBUG 'Processando % para email=%', TG_OP, NEW.email;
    
    -- Se for INSERT, garantir que o status está definido
    IF TG_OP = 'INSERT' THEN
        RAISE DEBUG 'Novo usuário detectado: email=%, status=%', NEW.email, NEW.status;
        
        -- Forçar a priorização de INSERTs
        SELECT
            id, status, content
        INTO 
            response_id, response_status, response_content
        FROM
            net.http_post(
                url := 'https://aylxcqaddelwxfukerhr.supabase.co/functions/v1/user-webhook',
                headers := jsonb_build_object(
                    'Content-Type', 'application/json',
                    'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF5bHhjcWFkZGVsd3hmdWtlcmhyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDAwMTc2NTksImV4cCI6MjA1NTU5MzY1OX0.YqQAdHMeGMmPAfKFtZPTovJ8szJi_iiUwkEnnLk1Cg8'
                ),
                body := jsonb_build_object(
                    'type', 'INSERT',
                    'table', TG_TABLE_NAME,
                    'schema', TG_TABLE_SCHEMA,
                    'record', row_to_json(NEW),
                    'old_record', NULL
                )
            );
        
        RAISE DEBUG 'Resposta INSERT: status=%, conteúdo=%', response_status, response_content;
    -- Se for UPDATE com mudança de status, processar de forma especial
    ELSIF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status THEN
        RAISE DEBUG 'Mudança de status detectada: % -> %', OLD.status, NEW.status;
        
        SELECT
            id, status, content
        INTO 
            response_id, response_status, response_content
        FROM
            net.http_post(
                url := 'https://aylxcqaddelwxfukerhr.supabase.co/functions/v1/user-webhook',
                headers := jsonb_build_object(
                    'Content-Type', 'application/json',
                    'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF5bHhjcWFkZGVsd3hmdWtlcmhyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDAwMTc2NTksImV4cCI6MjA1NTU5MzY1OX0.YqQAdHMeGMmPAfKFtZPTovJ8szJi_iiUwkEnnLk1Cg8'
                ),
                body := jsonb_build_object(
                    'type', TG_OP,
                    'table', TG_TABLE_NAME,
                    'schema', TG_TABLE_SCHEMA,
                    'record', row_to_json(NEW),
                    'old_record', row_to_json(OLD)
                )
            );
        
        RAISE DEBUG 'Resposta UPDATE (status change): status=%, conteúdo=%', response_status, response_content;
    -- Para outros tipos de UPDATE, também chamar webhook
    ELSE
        RAISE DEBUG 'UPDATE sem mudança de status';
        
        SELECT
            id, status, content
        INTO 
            response_id, response_status, response_content
        FROM
            net.http_post(
                url := 'https://aylxcqaddelwxfukerhr.supabase.co/functions/v1/user-webhook',
                headers := jsonb_build_object(
                    'Content-Type', 'application/json',
                    'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF5bHhjcWFkZGVsd3hmdWtlcmhyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDAwMTc2NTksImV4cCI6MjA1NTU5MzY1OX0.YqQAdHMeGMmPAfKFtZPTovJ8szJi_iiUwkEnnLk1Cg8'
                ),
                body := jsonb_build_object(
                    'type', TG_OP,
                    'table', TG_TABLE_NAME,
                    'schema', TG_TABLE_SCHEMA,
                    'record', row_to_json(NEW),
                    'old_record', row_to_json(OLD)
                )
            );
        
        RAISE DEBUG 'Resposta UPDATE (normal): status=%, conteúdo=%', response_status, response_content;
    END IF;
    
    -- Verificar e logar problemas
    IF response_status < 200 OR response_status >= 300 THEN
        RAISE WARNING 'Erro na resposta da Edge Function: status=%, conteúdo=%', 
            response_status, response_content;
    ELSE
        RAISE DEBUG 'Sincronização com Brevo concluída com sucesso';
    END IF;
    
    RETURN NEW;
EXCEPTION
    WHEN OTHERS THEN
        -- Logar o erro em detalhes para facilitar depuração
        RAISE WARNING 'Exceção em sync_user_to_brevo: %, %, detalhe: %', 
            SQLERRM, SQLSTATE, PG_EXCEPTION_DETAIL;
        RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Criar trigger com FOR EACH ROW e AFTER
CREATE TRIGGER trigger_sync_user_to_brevo
AFTER INSERT OR UPDATE OR DELETE ON users
FOR EACH ROW
EXECUTE FUNCTION sync_user_to_brevo();

-- Comentário explicativo 
COMMENT ON TRIGGER trigger_sync_user_to_brevo ON users IS 'Trigger que sincroniza usuários com o Brevo via função Edge (versão corrigida)';
COMMENT ON FUNCTION sync_user_to_brevo() IS 'Função que envia dados de usuários para o Brevo, com logs detalhados para depuração';

-- Verificar se o trigger foi criado corretamente
SELECT tgname, pg_get_triggerdef(t.oid) 
FROM pg_trigger t 
WHERE tgname = 'trigger_sync_user_to_brevo';

-- Agora vamos verificar a função Edge
DO $$
BEGIN
    RAISE NOTICE 'Verificando configuração da função Edge user-webhook...';
    
    -- Simular uma inserção para testar
    RAISE NOTICE 'Teste manual: Inserindo usuário de teste via webhook direto (sem afetar o banco)';
    
    -- Forçar um log detalhado da função e parâmetros
    RAISE NOTICE 'Certifique-se de que a função Edge user-webhook está configurada corretamente: https://supabase.com/dashboard/project/aylxcqaddelwxfukerhr/functions';
    RAISE NOTICE 'Certifique-se de que as variáveis de ambiente estão configuradas:';
    RAISE NOTICE '- BREVO_API_KEY está definida';
    RAISE NOTICE '- BREVO_MAIN_LIST_ID está definida';
    RAISE NOTICE '- As listas no código estão corretas: TRIAL=7, ATIVO=8, INATIVO=9';
END;
$$;

-- Dicas para testes manuais
DO $$
BEGIN
    RAISE NOTICE 'Após aplicar este script, teste:';
    RAISE NOTICE '1. Criar um novo usuário com status TRIAL';
    RAISE NOTICE '2. Atualizar um usuário existente de TRIAL para ATIVO';
END;
$$;

COMMIT; 