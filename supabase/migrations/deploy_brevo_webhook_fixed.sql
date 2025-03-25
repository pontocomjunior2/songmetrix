-- Script corrigido para reinstalar o trigger de sincronização de usuários com Brevo
-- Esta versão resolve problemas com atualizações feitas pelo painel de Admin

-- Verificar e habilitar a extensão net necessária para HTTP
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_extension
        WHERE extname = 'pg_net'
    ) THEN
        RAISE NOTICE 'A extensão pg_net não está habilitada. Tentando habilitar...';
        CREATE EXTENSION IF NOT EXISTS pg_net;
        RAISE NOTICE 'Extensão pg_net habilitada com sucesso.';
    ELSE
        RAISE NOTICE 'Extensão pg_net já está habilitada.';
    END IF;
END
$$;

-- Logar informação sobre a execução do script
DO $$
BEGIN
    RAISE NOTICE 'Iniciando script de reinstalação do trigger sync_user_to_brevo';
    -- Verificar versão do PostgreSQL
    RAISE NOTICE 'Versão do PostgreSQL: %', version();
END
$$;

-- Remover trigger e função existentes se houver
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
COMMENT ON TRIGGER trigger_sync_user_to_brevo ON users IS 'Trigger que sincroniza usuários com o Brevo via função Edge';
COMMENT ON FUNCTION sync_user_to_brevo() IS 'Função que envia dados de usuários para a função Edge de sincronização com o Brevo';

-- Verificar se o trigger foi criado corretamente
SELECT * FROM pg_trigger WHERE tgname = 'trigger_sync_user_to_brevo';

-- Instruções para testar usando SQL diretamente:
DO $$
DECLARE
    test_user_id UUID;
    test_user_email TEXT;
    current_status TEXT;
BEGIN
    -- Encontrar um usuário para teste
    SELECT id, email, status INTO test_user_id, test_user_email, current_status
    FROM users
    WHERE email = 'pontocomjunior10@gmail.com';
    
    IF test_user_id IS NULL THEN
        RAISE NOTICE 'Usuário de teste não encontrado. Tentando encontrar outro usuário...';
        
        -- Tentar encontrar qualquer usuário
        SELECT id, email, status INTO test_user_id, test_user_email, current_status
        FROM users
        LIMIT 1;
        
        IF test_user_id IS NULL THEN
            RAISE NOTICE 'Nenhum usuário encontrado para testar';
            RETURN;
        END IF;
    END IF;
    
    RAISE NOTICE 'Usuário para teste encontrado: % (status atual: %)', test_user_email, current_status;
    
    -- Sugerir como testar
    IF current_status = 'TRIAL' THEN
        RAISE NOTICE 'Para testar, execute: UPDATE users SET status = ''ATIVO'' WHERE id = ''%'';', test_user_id;
    ELSIF current_status = 'ATIVO' THEN
        RAISE NOTICE 'Para testar, execute: UPDATE users SET status = ''TRIAL'' WHERE id = ''%'';', test_user_id;
    ELSE
        RAISE NOTICE 'Para testar, execute: UPDATE users SET status = ''TRIAL'' WHERE id = ''%'';', test_user_id;
    END IF;
END
$$;

-- Instruções adicionais:
-- 1. Se o trigger não estiver funcionando como esperado ao alterar pelo painel Admin, você
--    também pode usar o script dedicado para movimentação manual entre listas:
--    $ node scripts/force-sync-brevo.js email@exemplo.com TRIAL
--    
-- 2. Para garantir que todos os usuários estejam nas listas corretas:
--    $ node scripts/sync-brevo-lists.js
--
-- 3. Para testar o funcionamento do trigger, você pode executar:
--    $ node scripts/test-brevo-sync.js 