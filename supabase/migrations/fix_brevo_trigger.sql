-- Script para corrigir o trigger de sincronização com o Brevo
DROP TRIGGER IF EXISTS trigger_sync_user_to_brevo ON users;
DROP FUNCTION IF EXISTS sync_user_to_brevo();

CREATE OR REPLACE FUNCTION sync_user_to_brevo()
RETURNS TRIGGER AS $$
DECLARE
    response_id BIGINT;
    response_status INT;
    response_content TEXT;
BEGIN
    -- Verificar se é uma operação DELETE
    IF TG_OP = 'DELETE' THEN
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
        RETURN OLD;
    ELSIF TG_OP = 'INSERT' THEN
        -- Caso especial para INSERT (novos usuários)
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
    ELSIF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status THEN
        -- Caso especial para mudança de status
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
    ELSE
        -- Outros tipos de UPDATE
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
    END IF;
    
    RETURN NEW;
EXCEPTION
    WHEN OTHERS THEN
        RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trigger_sync_user_to_brevo
AFTER INSERT OR UPDATE OR DELETE ON users
FOR EACH ROW
EXECUTE FUNCTION sync_user_to_brevo(); 