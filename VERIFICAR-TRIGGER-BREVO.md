# Verificação do Trigger para Sincronização de Usuários TRIAL com Brevo

## Problema Identificado

O problema relatado é que novos usuários TRIAL criados não estão sendo adicionados automaticamente à lista TRIAL no Brevo (lista ID 7). Isso indica que o trigger automático no Supabase pode não estar funcionando corretamente.

## Verificar se o Trigger Está Instalado

1. Acesse o [Dashboard do Supabase](https://app.supabase.io).
2. Selecione o projeto Songmetrix.
3. Vá para a seção **SQL Editor** no menu lateral.
4. Execute a seguinte consulta SQL para verificar se o trigger existe:

```sql
SELECT * FROM pg_trigger WHERE tgname = 'trigger_sync_trial_user_to_brevo';
```

Se o resultado estiver vazio, o trigger não está instalado.

## Instalar o Trigger

Se o trigger não estiver instalado, execute o script de instalação:

1. No **SQL Editor** do Supabase, crie uma nova consulta.
2. Cole o conteúdo do arquivo `install-brevo-sync.sql` ou execute a seguinte consulta:

```sql
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
  -- Verificar se o status do usuário é TRIAL (verificar nos metadados)
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
```

3. Execute a consulta clicando no botão **Run**.
4. Verifique se o trigger foi criado com sucesso executando novamente:

```sql
SELECT * FROM pg_trigger WHERE tgname = 'trigger_sync_trial_user_to_brevo';
```

## Verificar a Edge Function

Além disso, precisamos verificar se a Edge Function `user-webhook` está corretamente implementada e ativa:

1. No dashboard do Supabase, vá para **Edge Functions** no menu lateral.
2. Verifique se a função `user-webhook` está listada e ativa.
3. Se necessário, você pode implementar ou atualizar a função usando o código do arquivo `supabase/functions/user-webhook/index.ts`.

## Testar a Sincronização Automática

Após verificar a instalação do trigger e da Edge Function, teste criando um novo usuário TRIAL:

1. Registre um novo usuário no aplicativo Songmetrix.
2. Verifique no Brevo se o usuário foi adicionado à lista TRIAL (lista ID 7).
3. Verifique os logs do Supabase para erros ou mensagens relacionadas.

## Testar Manualmente a Função

Para testar manualmente se a função está funcionando:

1. Execute a seguinte consulta SQL no Supabase:

```sql
SELECT sync_trial_user_to_brevo(
  json_build_object(
    'id', 'test-' || floor(random() * 1000000),
    'email', 'teste-' || floor(random() * 1000000) || '@example.com',
    'raw_user_meta_data', '{"status":"TRIAL", "name":"Usuário Teste"}'::jsonb,
    'created_at', now()
  )::jsonb
);
```

2. Verifique nos logs do Supabase se há mensagens relacionadas à sincronização.
3. Verifique no Brevo se o usuário de teste foi adicionado à lista TRIAL.

## Verificar Logs e Depurar Erros

Se o problema persistir:

1. Verifique os logs da Edge Function em **Logs** no painel do Supabase.
2. Verifique logs da função SQL usando:

```sql
SELECT * FROM pg_stat_statements_noid 
WHERE query LIKE '%sync_trial_user_to_brevo%' 
ORDER BY mean_exec_time DESC;
```

3. Execute queries para ver mensagens de log recentes:

```sql
SELECT * FROM pg_logs 
WHERE message LIKE '%Usuário TRIAL sincronizado%' 
ORDER BY log_time DESC 
LIMIT 100;
```

4. Verifique se as variáveis de ambiente necessárias estão configuradas na Edge Function:
   - SUPABASE_URL
   - SUPABASE_SERVICE_ROLE_KEY
   - BREVO_API_KEY 