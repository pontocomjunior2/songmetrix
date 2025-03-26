-- Trigger para sincronizar novos usuários com o Brevo via Edge Function
-- Este trigger envia dados para a Edge Function user-webhook quando um novo usuário é criado

-- Criar uma função para o trigger
CREATE OR REPLACE FUNCTION public.trigger_sync_user_to_brevo()
RETURNS TRIGGER AS $$
DECLARE
  r json;
  webhook_url text := 'https://aylxcqaddelwxfukerhr.supabase.co/functions/v1/user-webhook';
  http_method text := 'POST';
BEGIN
  -- Enviar dados para a Edge Function
  SELECT status, content::json INTO r
  FROM
    http((
      http_method,
      webhook_url,
      ARRAY[http_header('Content-Type', 'application/json')],
      json_build_object(
        'type', TG_OP, 
        'table', TG_TABLE_NAME, 
        'record', row_to_json(NEW)
      )::text
    ));

  -- Log para depuração
  RAISE LOG 'Enviado para webhook: % %', TG_OP, webhook_url;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Capturar erros, mas não bloquear a operação principal
  RAISE WARNING 'Erro ao enviar para webhook: %', SQLERRM;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Comentário da função
COMMENT ON FUNCTION public.trigger_sync_user_to_brevo() IS 'Envia dados de usuários para a Edge Function Brevo quando há INSERT ou UPDATE';

-- Verificar se a extensão HTTP está habilitada (necessária para chamar a Edge Function)
CREATE EXTENSION IF NOT EXISTS http;

-- Remover o trigger se já existir (para atualização)
DROP TRIGGER IF EXISTS trigger_sync_users_to_brevo ON auth.users;

-- Criar o trigger para novos usuários
CREATE TRIGGER trigger_sync_users_to_brevo
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.trigger_sync_user_to_brevo();

-- Instrução para testar diretamente a Edge Function via cURL:
-- curl -X POST https://aylxcqaddelwxfukerhr.supabase.co/functions/v1/user-webhook -H "Content-Type: application/json" -d '{"email":"teste@example.com","name":"Usuário Teste","status":"TRIAL","id":"test-id"}' 