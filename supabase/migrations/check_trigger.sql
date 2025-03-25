-- Script para verificar e corrigir o trigger de sincronização com o Brevo

-- Logar informação sobre a execução do script
DO $$
BEGIN
    RAISE NOTICE 'Verificando trigger de sincronização com o Brevo';
END
$$;

-- Verificar se o trigger existe
DO $$
DECLARE
    trigger_exists BOOLEAN;
BEGIN
    SELECT EXISTS (
        SELECT 1
        FROM pg_trigger
        WHERE tgname = 'trigger_sync_user_to_brevo'
    ) INTO trigger_exists;
    
    IF trigger_exists THEN
        RAISE NOTICE 'Trigger trigger_sync_user_to_brevo existe.';
    ELSE
        RAISE WARNING 'Trigger trigger_sync_user_to_brevo NÃO existe!';
    END IF;
END
$$;

-- Verificar se a função existe
DO $$
DECLARE
    func_exists BOOLEAN;
BEGIN
    SELECT EXISTS (
        SELECT 1
        FROM pg_proc
        WHERE proname = 'sync_user_to_brevo'
    ) INTO func_exists;
    
    IF func_exists THEN
        RAISE NOTICE 'Função sync_user_to_brevo existe.';
    ELSE
        RAISE WARNING 'Função sync_user_to_brevo NÃO existe!';
    END IF;
END
$$;

-- Verificar definição completa do trigger
SELECT 
    tgname AS trigger_name,
    pg_get_triggerdef(t.oid) AS trigger_definition
FROM 
    pg_trigger t
WHERE 
    tgname = 'trigger_sync_user_to_brevo';

-- Recriar o trigger e a função (mesmo que já existam)
DROP TRIGGER IF EXISTS trigger_sync_user_to_brevo ON users;
DROP FUNCTION IF EXISTS sync_user_to_brevo();

-- Criar função que será acionada pelo trigger
CREATE OR REPLACE FUNCTION sync_user_to_brevo()
RETURNS TRIGGER AS $$
DECLARE
    response_id BIGINT;
    response_status INT;
    response_content TEXT;
BEGIN
    -- Logar a operação para depuração
    RAISE NOTICE 'Executando função sync_user_to_brevo para operação: %', TG_OP;
    
    -- Verificar se é uma operação DELETE
    IF TG_OP = 'DELETE' THEN
        -- Logar a operação que está acontecendo
        RAISE NOTICE 'Sincronizando exclusão de usuário com Brevo: % (operação: DELETE)', OLD.email;
        
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
        
        -- Logar o resultado da chamada HTTP
        RAISE NOTICE 'Chamada para função Edge completada (DELETE): status=%, id=%, content=%', 
            response_status, response_id, substr(response_content, 1, 100);
            
        -- Retornar OLD para operações DELETE (requerido pelo PostgreSQL)
        RETURN OLD;
    END IF;

    -- Logar a operação que está acontecendo (INSERT ou UPDATE)
    RAISE NOTICE 'Sincronizando usuário com Brevo: % (operação: %)', NEW.email, TG_OP;
    
    -- Se for uma atualização, verificar se houve mudança de status
    IF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status THEN
        RAISE NOTICE 'Detectada mudança de status: % -> %', OLD.status, NEW.status;
        
        -- Fazer uma chamada direta para API do Brevo usando pg_net
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
        
        -- Logar o resultado da chamada HTTP
        RAISE NOTICE 'Chamada para função Edge completada: status=%, id=%, content=%', 
            response_status, response_id, substr(response_content, 1, 100);
        
        -- Verificar se a resposta foi bem-sucedida
        IF response_status < 200 OR response_status >= 300 THEN
            RAISE WARNING 'Erro ao chamar função Edge: status=%, conteúdo=%', 
                response_status, substr(response_content, 1, 100);
        END IF;
    -- Adicionando caso especial para INSERT (novos usuários)
    ELSIF TG_OP = 'INSERT' THEN
        RAISE NOTICE 'Processando novo usuário: %', NEW.email;
        
        -- Chamada para API via função Edge
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
            
        -- Logar o resultado da chamada HTTP
        RAISE NOTICE 'Chamada para função Edge completada (INSERT): status=%, id=%, content=%', 
            response_status, response_id, substr(response_content, 1, 100);
        
        -- Verificar se a resposta foi bem-sucedida
        IF response_status < 200 OR response_status >= 300 THEN
            RAISE WARNING 'Erro ao chamar função Edge para novo usuário: status=%, conteúdo=%', 
                response_status, substr(response_content, 1, 100);
        END IF;
    ELSE
        -- Para operações normais (não mudança de status), também chamar a função Edge
        -- mas sem priorizar a detecção de mudança de status
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
                    'old_record', CASE WHEN TG_OP = 'UPDATE' THEN row_to_json(OLD) ELSE NULL END
                )
            );
        
        -- Logar o resultado da chamada HTTP
        RAISE NOTICE 'Chamada para função Edge completada: status=%, id=%, content=%', 
            response_status, response_id, substr(response_content, 1, 100);
    END IF;
    
    -- Sempre retornar a linha sendo inserida/atualizada
    RETURN NEW;
EXCEPTION
    WHEN OTHERS THEN
        -- Logar o erro, mas permitir que a operação continue
        RAISE WARNING 'Erro ao sincronizar usuário com Brevo: % / %', SQLERRM, SQLSTATE;
        RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Criar trigger para acionar a função quando um usuário for inserido, atualizado ou excluído
CREATE TRIGGER trigger_sync_user_to_brevo
AFTER INSERT OR UPDATE OR DELETE ON users
FOR EACH ROW
EXECUTE FUNCTION sync_user_to_brevo();

-- Comentário explicativo
COMMENT ON TRIGGER trigger_sync_user_to_brevo ON users IS 'Trigger que sincroniza usuários com o Brevo via função Edge (inclui suporte a DELETE e melhorias para INSERT)';
COMMENT ON FUNCTION sync_user_to_brevo() IS 'Função que envia dados de usuários para a função Edge de sincronização com o Brevo, incluindo inserções, atualizações e exclusões';

-- Verificar se o trigger foi criado corretamente
SELECT * FROM pg_trigger WHERE tgname = 'trigger_sync_user_to_brevo'; 