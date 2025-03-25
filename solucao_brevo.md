# Solução para Problemas de Integração com Brevo

## Diagnóstico

Identificamos os seguintes problemas:

1. O trigger do PostgreSQL não está sendo acionado corretamente quando o status do usuário é alterado.
2. A função Edge `user-webhook` para sincronização com o Brevo pode estar enfrentando falhas.
3. O endpoint `/api/users/update-status` está retornando erro 500 durante as atualizações de status.

## Etapas de Solução

### 1. Corrigir o Trigger do PostgreSQL

Execute o script de diagnóstico para verificar se o trigger está presente e funcionando:

```sql
-- Execute este script no SQL Editor do Supabase
SELECT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'trigger_sync_user_to_brevo'
) AS trigger_exists;
```

Se o resultado for `false`, aplique o script `fix_brevo_integration.sql` para recriar o trigger.

### 2. Verificar as Variáveis de Ambiente da Função Edge

Acesse o painel do Supabase > Edge Functions > user-webhook > Settings:

- Verifique se as seguintes variáveis de ambiente estão configuradas:
  - `BREVO_API_KEY` - Sua chave de API do Brevo
  - `BREVO_MAIN_LIST_ID` - O ID da lista principal no Brevo (opcional)

### 3. Verificar os IDs das Listas no Brevo

No código da função Edge (`user-webhook/index.ts`), verifique se os IDs das listas estão corretos:

```typescript
const statusListIds = {
  TRIAL: '7',    // Lista para usuários Trial
  ATIVO: '8',    // Lista para usuários Ativos
  INATIVO: '9',  // Lista para usuários Inativos
};
```

Estas IDs devem corresponder às suas listas no Brevo. Abra sua conta do Brevo e confirme.

### 4. Testar a Função Edge Diretamente

Use o script `test_edge_function.js` para testar a função Edge diretamente, sem depender do trigger:

```bash
npm install node-fetch
node test_edge_function.js
```

Veja os resultados e ajuste o código da função conforme necessário.

### 5. Verificar o Endpoint de Atualização de Status

Use o script `test_api_endpoint.js` para testar o endpoint diretamente:

```bash
npm install node-fetch @supabase/supabase-js
node test_api_endpoint.js <userId> <newStatus>
```

Substitua `<userId>` pelo ID de um usuário real e `<newStatus>` por um status válido.

### 6. Depuração do Servidor

Verifique os logs do servidor para identificar o erro específico:

```bash
# No diretório do projeto
cd server
npm run dev
```

Em outro terminal, execute o teste e observe os logs detalhados.

## Solução Completa

1. **Executar o diagnóstico do trigger**:
   - Use o script `fix_trigger_test.sql` para verificar o trigger

2. **Aplicar correções no trigger**:
   - Execute o script `fix_brevo_integration.sql` corrigido

3. **Verificar/atualizar a função Edge**:
   - Substitua a função Edge existente pelo código atualizado em `updated_edge_function.ts`

4. **Teste manual após as correções**:
   - Criar um novo usuário (deve ir para a lista TRIAL)
   - Atualizar um usuário de TRIAL para ATIVO (deve ser movido de lista)

## Se Nada Funcionar

Se após as correções ainda persistirem problemas:

1. **Desative temporariamente o trigger**:
   ```sql
   ALTER TABLE users DISABLE TRIGGER trigger_sync_user_to_brevo;
   ```

2. **Sincronize manualmente os usuários**:
   - Implemente um script de sincronização em lote

3. **Considere uma abordagem alternativa**:
   - Use Webhooks do Supabase Auth em vez de triggers
   - Implemente filas de mensagens para operações assíncronas

## Acompanhamento

Após implementar as correções, monitore os logs por 24-48 horas para garantir que a sincronização esteja funcionando corretamente para todas as operações de usuários.

Don't forget to commit com:
"Fix(brevo): corrigir integração de sincronização com listas do Brevo" 