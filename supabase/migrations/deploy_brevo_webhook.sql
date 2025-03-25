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
    -- Logar a operação que está acontecendo
    RAISE NOTICE 'Sincronizando usuário com Brevo: % (operação: %)', NEW.email, TG_OP;
    
    -- Se for uma atualização, verificar se houve mudança de status
    IF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status THEN
        RAISE NOTICE 'Detectada mudança de status: % -> %', OLD.status, NEW.status;
    END IF;
    
    -- Incluir o OLD record para poder detectar mudanças de status
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
    
    -- Verificar se a resposta foi bem-sucedida
    IF response_status < 200 OR response_status >= 300 THEN
        RAISE WARNING 'Erro ao chamar função Edge: status=%, conteúdo=%', 
            response_status, substr(response_content, 1, 100);
    END IF;
    
    -- Sempre retornar a linha sendo inserida/atualizada
    RETURN NEW;
EXCEPTION
    WHEN OTHERS THEN
        -- Logar o erro, mas permitir que a operação continue
        RAISE WARNING 'Erro ao sincronizar usuário com Brevo: % / %', SQLERRM, SQLSTATE;
        RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Criar trigger para acionar a função quando um usuário for inserido ou atualizado
CREATE TRIGGER trigger_sync_user_to_brevo
AFTER INSERT OR UPDATE ON users
FOR EACH ROW
EXECUTE FUNCTION sync_user_to_brevo();

-- Comentário explicativo
COMMENT ON TRIGGER trigger_sync_user_to_brevo ON users IS 'Trigger que sincroniza usuários com o Brevo via função Edge';
COMMENT ON FUNCTION sync_user_to_brevo() IS 'Função que envia dados de usuários para a função Edge de sincronização com o Brevo';

-- Verificar se o trigger foi criado corretamente
SELECT * FROM pg_trigger WHERE tgname = 'trigger_sync_user_to_brevo';

-- Testar imediatamente com uma atualização para forçar a mudança entre listas:
-- Quando estiver pronto para testar, descomente UMA das linhas abaixo:

-- 1. Testar mudança de ATIVO para TRIAL:
-- UPDATE users SET status = 'TRIAL' WHERE status = 'ATIVO' LIMIT 1;

-- 2. Testar mudança de TRIAL para ATIVO:
-- UPDATE users SET status = 'ATIVO' WHERE status = 'TRIAL' LIMIT 1;

-- Instruções para testar manualmente:
-- 1. Execute este script no Supabase Studio SQL Editor
-- 2. Verifique nos logs da função Edge user-webhook se ela está sendo chamada
-- 3. Observe que agora enviamos tanto o registro novo quanto o antigo para a função Edge,
--    permitindo que ela detecte mudanças de status e mova o usuário entre listas corretamente 