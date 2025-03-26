# Instruções para Configuração Manual da Sincronização com o Brevo

## Problema Identificado
Os scripts automatizados não estão funcionando corretamente devido a problemas com a execução de SQL em fragmentos. A solução é aplicar o SQL manualmente no console do Supabase.

## Observação Importante sobre o Esquema de Usuários
No Supabase, a tabela de usuários geralmente está no esquema `auth`. Dependendo da sua instalação, pode ser necessário verificar o esquema e o nome correto da tabela antes de executar o Bloco 3 (criação do trigger).

Execute a seguinte consulta para verificar a localização correta da tabela de usuários:
```sql
SELECT table_schema, table_name 
FROM information_schema.tables 
WHERE table_name LIKE '%user%';
```

Se a tabela não for `auth.users`, ajuste o Bloco 3 substituindo `auth.users` pelo caminho correto da tabela.

## Passo a Passo para Configuração Manual

1. Acesse o painel do Supabase: https://supabase.com/dashboard
2. Selecione seu projeto
3. Vá para "SQL Editor"
4. **IMPORTANTE**: Execute cada bloco SQL separadamente, um por vez (selecione cada bloco e execute):

### Bloco 0: Verificar e habilitar extensão HTTP (EXECUTAR PRIMEIRO)

```sql
-- Verificar se a extensão http está disponível
SELECT * FROM pg_available_extensions WHERE name = 'http';

-- Instalar a extensão se disponível (necessária para o webhook)
CREATE EXTENSION IF NOT EXISTS http;
```

### Bloco 1: Função exec_sql

```sql
-- Primeiro remover a função existente se já estiver definida
DROP FUNCTION IF EXISTS public.exec_sql(text);

-- Criar função exec_sql
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
```

### Bloco 2: Função sync_new_trial_user_to_brevo

```sql
-- Primeiro remover a função existente se já estiver definida
DROP FUNCTION IF EXISTS public.sync_new_trial_user_to_brevo() CASCADE;

-- Criar função para sincronizar usuários com o Brevo
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
  webhook_base_url text := 'https://songmetrix.dataradio.com.br/api/webhook';
BEGIN
  -- Se o usuário for TRIAL, aciona o webhook
  IF NEW.status = 'TRIAL' THEN
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
```

### Bloco 4: Ajustar a função para não depender de configurações de ambiente

```sql
-- Como não temos permissão para alterar configurações do banco de dados,
-- vamos modificar a função sync_new_trial_user_to_brevo para usar URLs hardcoded

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
  webhook_base_url text := 'https://songmetrix.dataradio.com.br/api/webhook';
BEGIN
  -- Se o usuário for TRIAL, aciona o webhook
  IF NEW.status = 'TRIAL' THEN
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
```

**Observação**: Este bloco sobrescreve a função criada no Bloco 2 removendo a dependência de variáveis de ambiente. Substitua a URL do webhook `https://songmetrix.dataradio.com.br/api/webhook` pela URL correta do seu ambiente se necessário.

### Bloco 3: Criar o trigger

```sql
-- Remover o trigger se já existir (para atualização)
DROP TRIGGER IF EXISTS trigger_sync_new_trial_user_to_brevo ON auth.users;

-- Criar o trigger
CREATE TRIGGER trigger_sync_new_trial_user_to_brevo
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_new_trial_user_to_brevo();
```

## Ordem de Execução após Modificações

Com a modificação do Bloco 4, a ordem correta de execução agora é:

1. **Bloco 0**: Verificar e habilitar a extensão HTTP
2. **Bloco 1**: Criar a função exec_sql
3. **Bloco 2**: Criar a primeira versão da função do trigger
4. **Bloco 4**: Sobrescrever a função do trigger com versão simplificada (sem dependências de configuração)
5. **Bloco 3**: Criar o trigger usando a função configurada

É importante manter esta ordem para garantir que a versão final da função seja a que não depende de configurações de ambiente.

## Verificação da Instalação

Após executar os blocos acima, você pode verificar se a função e o trigger foram criados corretamente executando:

```sql
-- Verificar função exec_sql
SELECT proname, proargtypes, prosrc 
FROM pg_proc 
WHERE proname = 'exec_sql';

-- Verificar função sync_new_trial_user_to_brevo
SELECT proname, proargtypes, prosrc 
FROM pg_proc 
WHERE proname = 'sync_new_trial_user_to_brevo';

-- Verificar trigger
SELECT tgname, pg_get_triggerdef(t.oid) 
FROM pg_trigger t 
WHERE tgname = 'trigger_sync_new_trial_user_to_brevo';
```

## Possíveis Erros e Soluções

### 1. Erro com o retorno da função
Se você receber erro como `cannot change return type of existing function`, certifique-se de ter executado primeiro o comando DROP FUNCTION conforme indicado no Bloco 1 e Bloco 2.

### 2. Erro com o esquema "auth"
Se você receber erro como `schema "auth" does not exist` ou `relation "auth.users" does not exist`, você precisa identificar o esquema e tabela corretos no seu Supabase.

Execute novamente:
```sql
-- Verificar tabelas com "user" no nome
SELECT table_schema, table_name 
FROM information_schema.tables 
WHERE table_name LIKE '%user%';
```

E ajuste o Bloco 3 substituindo `auth.users` pelo caminho correto.

### 3. Erro com a extensão HTTP
Se você receber erro relacionado à função HTTP, verifique se a extensão foi instalada corretamente:

```sql
-- Verificar extensões instaladas
SELECT * FROM pg_extension;
```

Se a extensão 'http' não estiver na lista, pode ser que seu projeto Supabase não tenha a extensão disponível. Neste caso, você precisará entrar em contato com o suporte do Supabase ou implementar uma solução alternativa que não dependa da extensão HTTP.

### 4. Erro com permissões para modificar configurações
Se você receber erro como `permission denied to set parameter`, isso significa que você não tem permissões para modificar configurações no nível do banco de dados. Use a versão simplificada da função fornecida no Bloco 4, que não depende de configurações de ambiente.

## Verificando os Logs e Problemas

Após configurar a integração, você pode verificar os logs de execução do PostgreSQL para diagnosticar problemas:

```sql
-- Verificar logs recentes do PostgreSQL
SELECT 
  log_time,
  message
FROM pg_logs
WHERE message LIKE '%Brevo%' OR message LIKE '%sync%'
ORDER BY log_time DESC
LIMIT 50;
```

O Supabase também oferece uma interface para visualizar logs em "Database" > "Logs". Procure por mensagens relacionadas ao trigger e à sincronização com o Brevo.

### Problemas comuns a verificar:

1. **Se a extensão HTTP não funcionar**: Você pode receber erros como "função http não existe" ou problemas ao executar a chamada HTTP. Nesse caso, crie uma Edge Function no Supabase para fazer a sincronização.

2. **Se a tabela `auth.users` não for encontrada**: Você precisa substituir `auth.users` pelo nome correto da tabela de usuários do seu projeto. Use a consulta fornecida anteriormente para encontrar o nome correto.

3. **Se você tiver problemas com o campo `status`**: Verifique se a tabela de usuários tem um campo chamado `status` com um valor 'TRIAL'. Caso contrário, ajuste a condição `IF NEW.status = 'TRIAL' THEN` para usar o campo correto que identifica usuários em período de teste.

## Testando a Integração

Para testar se a integração está funcionando, você pode:

1. Criar um novo usuário com status TRIAL no Supabase
2. Verificar nos logs do Supabase se o webhook foi acionado (acesse o menu "Database" > "Logs")
3. Verificar no Brevo se o novo usuário foi adicionado à lista

## Alternativa: Uso de Edge Functions

Se você continuar tendo problemas com o método direto via SQL, considere implementar uma Edge Function no Supabase que escute eventos de inserção de usuários e faça a sincronização com o Brevo. Esta abordagem pode ser mais flexível e evitar alguns dos problemas encontrados com triggers SQL.

### 1. Verificando o Endpoint de Webhook

Antes de implementar uma Edge Function, vamos verificar se o endpoint de webhook está funcionando corretamente:

```bash
curl -X POST https://songmetrix.dataradio.com.br/api/webhook \
  -H "Content-Type: application/json" \
  -d '{
    "id": "test-id",
    "email": "teste@example.com",
    "status": "TRIAL",
    "name": "Usuário Teste",
    "updated_at": "2023-03-25T00:00:00Z",
    "event_type": "new_trial_user"
  }'
```

Se você receber uma resposta positiva, o problema pode estar no trigger ou na função SQL. Se receber um erro, o problema está no endpoint do webhook.

### 2. Implementando uma Edge Function no Supabase

#### Passo 1: Criar uma nova Edge Function

1. Acesse o painel do Supabase
2. Vá para "Edge Functions"
3. Clique em "Create a new function"
4. Dê o nome de "sync-user-to-brevo"
5. Cole o código abaixo:

```typescript
// Função para sincronizar usuários com o Brevo
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const BREVO_API_KEY = Deno.env.get('BREVO_API_KEY')
const BREVO_LIST_ID = Deno.env.get('BREVO_MAIN_LIST_ID') || '7'
const BREVO_API_URL = 'https://api.brevo.com/v3/contacts'

// Function to sync user to Brevo
async function syncUserToBrevo(user) {
  try {
    if (!user || !user.email) {
      return { success: false, error: 'User data invalid or missing email' }
    }

    // Prepare payload for Brevo
    const payload = {
      email: user.email,
      attributes: {
        NAME: user.name || '',
        STATUS: user.status || 'TRIAL',
        USER_ID: user.id || '',
        SIGNUP_DATE: new Date().toISOString()
      },
      listIds: [parseInt(BREVO_LIST_ID)]
    }

    // Send to Brevo API
    const response = await fetch(BREVO_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': BREVO_API_KEY
      },
      body: JSON.stringify(payload)
    })

    const result = await response.json()
    
    return { 
      success: response.status >= 200 && response.status < 300,
      status: response.status,
      result 
    }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

// Main handler
serve(async (req) => {
  try {
    // Handle OPTIONS request for CORS
    if (req.method === 'OPTIONS') {
      return new Response('', {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization'
        },
        status: 204
      })
    }

    // Only allow POST for actual data
    if (req.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), {
        headers: { 'Content-Type': 'application/json' },
        status: 405
      })
    }

    // Parse user data from request
    const userData = await req.json()
    
    // Check if this is a row-level change from database
    let user = userData
    if (userData.type === 'INSERT' && userData.table === 'users') {
      user = userData.record
    }

    // Sync to Brevo
    const result = await syncUserToBrevo(user)

    return new Response(JSON.stringify(result), {
      headers: { 'Content-Type': 'application/json' }
    })
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { 'Content-Type': 'application/json' },
      status: 500
    })
  }
})
```

#### Passo 2: Configurar as Variáveis de Ambiente

1. No painel do Supabase, vá para "Project Settings" > "API"
2. Desça até a seção "Environment Variables"
3. Adicione as seguintes variáveis:
   - `BREVO_API_KEY`: Adicione sua chave de API do Brevo
   - `BREVO_MAIN_LIST_ID`: ID da lista principal do Brevo (geralmente 7)

#### Passo 3: Implementar um Database Webhook

1. No painel do Supabase, vá para "Database" > "Webhooks"
2. Clique em "Create a new webhook"
3. Configure o webhook:
   - Nome: "sync-new-users-to-brevo"
   - Tabela: "users" (ou o nome correto da sua tabela de usuários)
   - Eventos: Selecione "INSERT" (novos usuários)
   - URL: Copie a URL da sua edge function (geralmente algo como: https://aylxcqaddelwxfukerhr.supabase.co/functions/v1/sync-user-to-brevo)

#### Passo 4: Teste Manual da Edge Function

Você pode testar a Edge Function diretamente para verificar se ela está funcionando:

```bash
curl -X POST https://aylxcqaddelwxfukerhr.supabase.co/functions/v1/sync-user-to-brevo \
  -H "Content-Type: application/json" \
  -d '{
    "email": "teste@example.com",
    "name": "Usuário Teste",
    "status": "TRIAL",
    "id": "test-id"
  }'
```

## Verificando a Integração com o Brevo API

Se ainda houver problemas, você pode verificar diretamente a API do Brevo:

1. Verifique se a API key do Brevo está correta
2. Teste a API diretamente:

```bash
curl -X POST https://api.brevo.com/v3/contacts \
  -H "accept: application/json" \
  -H "api-key: SEU_API_KEY_AQUI" \
  -H "content-type: application/json" \
  -d '{
    "email": "teste@example.com",
    "attributes": {
      "NAME": "Teste API",
      "STATUS": "TRIAL"
    },
    "listIds": [7]
  }'
```

Se este comando funcionar, significa que você pode se comunicar diretamente com o Brevo, e o problema está na integração entre o Supabase e o Brevo.

## Conclusão

Existem várias abordagens para integrar o Supabase com o Brevo:

1. **Triggers SQL**: Conforme configuramos nos passos anteriores, mas pode ter limitações de permissão.
2. **Edge Functions**: Uma abordagem mais moderna e flexível, com menos restrições.
3. **Webhooks externos**: Utilize serviços como Zapier ou Make para conectar Supabase e Brevo.

Se você continuar tendo problemas, considere usar a abordagem de Edge Functions ou um serviço de automação de terceiros para garantir uma integração confiável. 