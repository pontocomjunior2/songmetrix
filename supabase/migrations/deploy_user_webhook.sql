-- Criar webhook para sincronizar usuários com o Brevo
DROP TRIGGER IF EXISTS trigger_sync_user_to_brevo ON users;
DROP FUNCTION IF EXISTS sync_user_to_brevo();

-- Função que será acionada pelo trigger
CREATE OR REPLACE FUNCTION sync_user_to_brevo()
RETURNS TRIGGER AS $$
BEGIN
    -- Chamar a função Edge para sincronizar com o Brevo
    PERFORM net.http_post(
        url := 'https://aylxcqaddelwxfukerhr.supabase.co/functions/v1/user-webhook',
        headers := '{"Content-Type": "application/json", "Authorization": "Bearer ' || current_setting('app.edge_function_key', true) || '"}',
        body := json_build_object(
            'type', TG_OP,
            'table', TG_TABLE_NAME,
            'schema', TG_TABLE_SCHEMA,
            'record', row_to_json(NEW)
        )::text
    );
    
    -- Sempre retornar a linha sendo inserida/atualizada
    RETURN NEW;
EXCEPTION
    WHEN OTHERS THEN
        -- Logar o erro, mas permitir que a operação continue
        RAISE WARNING 'Erro ao sincronizar usuário com Brevo: %', SQLERRM;
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