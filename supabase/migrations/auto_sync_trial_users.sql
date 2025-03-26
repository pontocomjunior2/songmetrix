-- Arquivo de migração para configurar sincronização automática de novos usuários TRIAL com o Brevo
-- Este arquivo contém:
-- 1. Criação da função exec_sql (se não existir)
-- 2. Criação do trigger que sincroniza novos usuários TRIAL

-- Parte 1: Criar função exec_sql se não existir
DO $$
BEGIN
  -- Verifica se a função já existe
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc 
    WHERE proname = 'exec_sql' 
    AND pg_function_is_visible(oid)
  ) THEN
    -- Cria a função exec_sql com o serviço de HTTP
    CREATE OR REPLACE FUNCTION public.exec_sql(sql_query text)
    RETURNS json
    LANGUAGE plpgsql
    SECURITY DEFINER
    AS $$
    DECLARE
      result json;
    BEGIN
      EXECUTE sql_query;
      result := json_build_object('success', true, 'message', 'SQL executado com sucesso');
      RETURN result;
    EXCEPTION WHEN OTHERS THEN
      result := json_build_object('success', false, 'message', SQLERRM);
      RETURN result;
    END;
    $$;

    -- Adiciona comentário à função
    COMMENT ON FUNCTION public.exec_sql(text) IS 'Executa SQL dinâmico com segurança elevada';

    RAISE NOTICE 'Função exec_sql criada com sucesso!';
  ELSE
    RAISE NOTICE 'Função exec_sql já existe, pulando criação.';
  END IF;
END;
$$;

-- Parte 2: Criar função e trigger para sincronização automática
-- Função webhook para sincronizar usuários com o Brevo
DO $$
BEGIN
  -- Verifica se a função já existe
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc 
    WHERE proname = 'sync_new_trial_user_to_brevo' 
    AND pg_function_is_visible(oid)
  ) THEN
    -- Cria a função para sincronizar usuários com o Brevo
    CREATE OR REPLACE FUNCTION public.sync_new_trial_user_to_brevo()
    RETURNS TRIGGER
    LANGUAGE plpgsql
    SECURITY DEFINER
    AS $$
    DECLARE
      http_response json;
      http_status integer;
      http_method text := 'POST';
      payload json;
      webhook_url text := current_setting('app.webhook_url', true);
      webhook_base_url text;
    BEGIN
      -- Se o usuário for TRIAL, aciona o webhook
      IF NEW.status = 'TRIAL' THEN
        -- Configurar URL base do webhook baseado em ambiente
        IF webhook_url IS NULL OR webhook_url = '' THEN
          -- Usar URL de edge function ou URL de vercel
          IF current_setting('app.environment', true) = 'development' THEN
            webhook_base_url := 'http://localhost:3000/api/webhook';
          ELSE
            -- Usar URL do site em produção
            webhook_base_url := 'https://songmetrix.dataradio.com.br/api/webhook';
          END IF;
        ELSE
          -- Usar URL configurada
          webhook_base_url := webhook_url;
        END IF;

        -- Montar payload com dados do usuário
        payload := json_build_object(
          'id', NEW.id,
          'email', NEW.email,
          'status', NEW.status,
          'name', NEW.name,
          'updated_at', NEW.updated_at,
          'event_type', 'new_trial_user'
        );

        -- Chamar webhook para sincronizar
        SELECT
          status,
          content::json
        INTO
          http_status,
          http_response
        FROM
          http((
            http_method,
            webhook_base_url,
            ARRAY[http_header('Content-Type', 'application/json')],
            to_jsonb(payload)::text,
            5  -- 5 segundos timeout
          ));

        -- Registrar resposta nos logs
        RAISE LOG 'Brevo sync webhook para usuário %: status %, resposta %',
          NEW.email, http_status, http_response;

        -- Verificar resposta
        IF http_status >= 200 AND http_status < 300 THEN
          RAISE LOG 'Usuário TRIAL sincronizado com sucesso: %', NEW.email;
        ELSE
          RAISE WARNING 'Falha ao sincronizar usuário TRIAL %: status %, resposta %',
            NEW.email, http_status, http_response;
        END IF;
      END IF;

      RETURN NEW;
    EXCEPTION WHEN OTHERS THEN
      -- Capturar erros, mas não bloquear a operação principal
      RAISE WARNING 'Erro ao sincronizar usuário com Brevo: %', SQLERRM;
      RETURN NEW;
    END;
    $$;

    -- Adiciona comentário à função
    COMMENT ON FUNCTION public.sync_new_trial_user_to_brevo() 
      IS 'Sincroniza automaticamente novos usuários TRIAL com o Brevo';

    RAISE NOTICE 'Função sync_new_trial_user_to_brevo criada com sucesso!';
  ELSE
    RAISE NOTICE 'Função sync_new_trial_user_to_brevo já existe, pulando criação.';
  END IF;
END;
$$;

-- Verificar e criar o trigger se não existir
DO $$
BEGIN
  -- Remove o trigger se já existir (para atualização)
  DROP TRIGGER IF EXISTS trigger_sync_new_trial_user_to_brevo ON auth.users;
  
  -- Cria o trigger
  CREATE TRIGGER trigger_sync_new_trial_user_to_brevo
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.sync_new_trial_user_to_brevo();

  RAISE NOTICE 'Trigger trigger_sync_new_trial_user_to_brevo instalado com sucesso!';
END;
$$; 