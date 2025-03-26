-- Arquivo de migração para corrigir a sincronização automática de novos usuários TRIAL com o Brevo
-- Atualiza ou cria o trigger que sincroniza novos usuários com status TRIAL para o Brevo

-- Verificar se a extensão HTTP está instalada
CREATE EXTENSION IF NOT EXISTS http;

-- Criar ou substituir a função que será chamada pelo trigger
CREATE OR REPLACE FUNCTION public.sync_trial_user_to_brevo()
RETURNS TRIGGER AS $$
DECLARE
  response_status INT;
  response_content TEXT;
  edge_function_url TEXT := 'https://aylxcqaddelwxfukerhr.supabase.co/functions/v1/user-webhook';
  auth_token TEXT := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF5bHhjcWFkZGVsd3hmdWtlcmhyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDAwMTc2NTksImV4cCI6MjA1NTU5MzY1OX0.YqQAdHMeGMmPAfKFtZPTovJ8szJi_iiUwkEnnLk1Cg8';
BEGIN
  -- Verificar se o status do usuário é TRIAL
  IF NEW.raw_user_meta_data->>'status' = 'TRIAL' OR NEW.raw_user_meta_data->>'status' IS NULL THEN
    -- Enviar para a Edge Function que sincroniza com o Brevo
    SELECT
      status, content
    INTO
      response_status, response_content
    FROM
      http((
        'POST',
        edge_function_url,
        ARRAY[
          http_header('Content-Type', 'application/json'),
          http_header('Authorization', 'Bearer ' || auth_token)
        ],
        json_build_object(
          'email', NEW.email,
          'name', NEW.raw_user_meta_data->>'name',
          'status', COALESCE(NEW.raw_user_meta_data->>'status', 'TRIAL'),
          'id', NEW.id,
          'created_at', NEW.created_at
        )::text
      ));
    
    -- Registrar nos logs
    IF response_status >= 200 AND response_status < 300 THEN
      RAISE LOG 'Usuário TRIAL sincronizado com sucesso: % (status: %)', NEW.email, response_status;
    ELSE
      RAISE WARNING 'Falha ao sincronizar usuário TRIAL %: status %, resposta %',
        NEW.email, response_status, response_content;
    END IF;
  END IF;
  
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Capturar erros para não interromper o fluxo principal
  RAISE WARNING 'Erro ao sincronizar usuário TRIAL com Brevo: %', SQLERRM;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Comentário explicativo
COMMENT ON FUNCTION public.sync_trial_user_to_brevo() IS 'Sincroniza automaticamente novos usuários TRIAL com o Brevo via Edge Function';

-- Remover trigger antigo se existir
DROP TRIGGER IF EXISTS trigger_sync_new_trial_user_to_brevo ON auth.users;
DROP TRIGGER IF EXISTS trigger_sync_trial_user_to_brevo ON auth.users;

-- Criar o novo trigger
CREATE TRIGGER trigger_sync_trial_user_to_brevo
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.sync_trial_user_to_brevo();

-- Verificar se o trigger foi criado corretamente
SELECT * FROM pg_trigger WHERE tgname = 'trigger_sync_trial_user_to_brevo';

-- Instruções: Execute este script via SQL Editor no Supabase Studio.
-- Para testar, crie um novo usuário com status TRIAL e verifique nos logs se a sincronização aconteceu. 