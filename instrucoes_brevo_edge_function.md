# Solução Final para Sincronização com Brevo usando Edge Function

## Problema Resolvido

Implementamos uma solução robusta para sincronizar automaticamente novos usuários com o Brevo, utilizando uma abordagem com Edge Function que contorna as limitações encontradas nos métodos anteriores.

## Componentes da Solução

A solução completa consiste em dois componentes principais:

1. **Edge Function user-webhook:** Atualizada para processar eventos de usuários e sincronizá-los com o Brevo.
2. **Trigger de Database:** Configurado para enviar eventos de novos usuários para a Edge Function.

## Passo 1: Atualizar a Edge Function user-webhook

A Edge Function existente foi atualizada para melhorar o tratamento de usuários TRIAL e incluir logs mais detalhados. Os principais aprimoramentos incluem:

- Tratamento específico para novos usuários TRIAL
- Função auxiliar dedicada para sincronização com o Brevo
- Melhor tratamento de erros e logging
- API Key do Brevo configurada como fallback se não estiver nas variáveis de ambiente

### Como fazer o deploy da Edge Function atualizada:

1. Use o Supabase CLI para fazer deploy da função atualizada:

```bash
supabase functions deploy user-webhook
```

## Passo 2: Configurar o Trigger de Database

Criamos um arquivo SQL `sync_brevo_trigger.sql` que configura um trigger no PostgreSQL para enviar eventos de novos usuários diretamente para a Edge Function.

### Como aplicar o SQL:

1. No painel do Supabase, vá para "SQL Editor"
2. Crie um novo script
3. Cole o conteúdo do arquivo `supabase/migrations/sync_brevo_trigger.sql`
4. Execute o script

## Passo 3: Testar a Solução

Para verificar se a integração está funcionando corretamente:

### Teste direto da Edge Function:

```bash
curl -X POST https://aylxcqaddelwxfukerhr.supabase.co/functions/v1/user-webhook \
  -H "Content-Type: application/json" \
  -d '{
    "email": "teste@example.com",
    "name": "Usuário Teste",
    "status": "TRIAL",
    "id": "test-id"
  }'
```

### Teste através da criação de um usuário:

1. Crie um novo usuário no Supabase
2. Verifique os logs da Edge Function para confirmar o processamento
3. Verifique no Brevo se o contato foi adicionado à lista de TRIAL (ID: 7)

## Verificação e Monitoramento

Para monitorar a solução:

1. Verifique os logs da Edge Function:
```bash
supabase functions logs user-webhook
```

2. Verifique os logs do PostgreSQL no painel do Supabase (Database > Logs)

3. Verifique no Brevo se os contatos estão sendo adicionados corretamente

## Solução de Problemas

Se encontrar problemas:

1. **Erro no trigger SQL**: Verifique se a extensão HTTP está habilitada no seu projeto Supabase.
2. **Edge Function não está sendo chamada**: Verifique os logs do PostgreSQL para ver se o trigger está sendo acionado.
3. **Contatos não aparecem no Brevo**: Teste diretamente a Edge Function para verificar se ela está se comunicando corretamente com a API do Brevo.

## Conclusão

Esta solução utiliza uma abordagem moderna com Edge Functions, que é mais flexível e menos propensa a problemas de permissões. O trigger de database envia eventos de criação de usuários para a Edge Function, que por sua vez processa os dados e os envia para o Brevo. 