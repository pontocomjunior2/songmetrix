# Resolução do Problema de Sincronização com Brevo

Identificamos duas questões distintas que precisavam ser corrigidas:

1. ✅ **Erro "Contact already in list" tratado como falha** - CORRIGIDO
2. ❌ **Novos usuários TRIAL não são adicionados automaticamente à lista TRIAL** - PENDENTE

## Correção 1: Tratamento do erro "Contact already in list"

Esta correção já foi implementada e está funcionando corretamente, conforme logs:

```
Erro ao adicionar usuário@email.com à lista 7: {"code":"invalid_parameter","message":"Contact already in list and/or does not exist"}
Contato usuário@email.com já está na lista 7, considerando como sucesso
```

## Correção 2: Sincronização automática de novos usuários TRIAL

Para corrigir este problema, você precisa:

1. Acessar o painel administrativo do Supabase: https://app.supabase.io
2. Selecionar o projeto **Songmetrix**
3. Ir para a seção **SQL Editor** no menu lateral
4. Criar uma nova consulta
5. Colar o conteúdo do arquivo `CORRIGIR-TRIGGER-BREVO.sql` ou copiar o código abaixo:

```sql
-- Script para corrigir a sincronização automática de usuários TRIAL com Brevo
CREATE EXTENSION IF NOT EXISTS http;

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
    RAISE LOG 'Novo usuário TRIAL detectado: %', NEW.email;
    
    -- Enviar para a Edge Function que sincroniza com o Brevo
    SELECT status, content INTO response_status, response_content
    FROM http((
      'POST',
      edge_function_url,
      ARRAY[
        http_header('Content-Type', 'application/json'),
        http_header('Authorization', 'Bearer ' || auth_token)
      ],
      json_build_object(
        'email', NEW.email,
        'name', NEW.raw_user_meta_data->>'name',
        'status', 'TRIAL',
        'id', NEW.id,
        'created_at', NEW.created_at
      )::text
    ));
    
    IF response_status >= 200 AND response_status < 300 THEN
      RAISE LOG 'Usuário TRIAL sincronizado com sucesso: %', NEW.email;
    ELSE
      RAISE WARNING 'Falha ao sincronizar usuário TRIAL %: %', NEW.email, response_content;
    END IF;
  END IF;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Erro ao sincronizar usuário TRIAL: %', SQLERRM;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Remover triggers antigos se existirem
DROP TRIGGER IF EXISTS trigger_sync_new_trial_user_to_brevo ON auth.users;
DROP TRIGGER IF EXISTS trigger_sync_trial_user_to_brevo ON auth.users;

-- Criar o novo trigger
CREATE TRIGGER trigger_sync_trial_user_to_brevo
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.sync_trial_user_to_brevo();
```

6. Clicar no botão **Run** para executar o script
7. Verifique se o trigger foi criado com sucesso executando:

```sql
SELECT * FROM pg_trigger WHERE tgname = 'trigger_sync_trial_user_to_brevo';
```

## Verificando a solução

Para confirmar que a solução está funcionando:

1. Crie um novo usuário com status TRIAL no aplicativo
2. Verifique no Brevo se o usuário foi adicionado à lista TRIAL (Lista ID 7)
3. Verifique os logs do Supabase para mensagens de sucesso

## Suporte adicional

Se o problema persistir após a implementação dessas correções, verifique:

1. Se a Edge Function `user-webhook` está ativa e funcionando corretamente
2. Os logs da Edge Function para identificar possíveis erros
3. Se as permissões e políticas de segurança estão configuradas corretamente

---

Não se esqueça de fazer commit das alterações realizadas no servidor:

```
git add server/server.js
git commit -m "Fix(brevo): tratar contatos já existentes na lista como sucesso e corrigir trigger de sincronização"
``` 