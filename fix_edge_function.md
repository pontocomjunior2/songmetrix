# Ajustes Necessários na Função Edge user-webhook

Após analisar o código, identifiquei que podem haver problemas nas seguintes áreas:

## 1. Verificar IDs das Listas no Brevo

No arquivo `index.ts` da função Edge, é preciso verificar se os IDs das listas estão corretos:

```typescript
// IDs das listas do Brevo conforme o status do usuário
const statusListIds = {
  TRIAL: '7',    // Lista para usuários Trial
  ATIVO: '8',    // Lista para usuários Ativos
  INATIVO: '9',  // Lista para usuários Inativos
};
```

Certifique-se que estes IDs correspondem às listas corretas na sua conta do Brevo.

## 2. Verificar Variáveis de Ambiente

Confirme que estas variáveis estão configuradas na função Edge:
- `BREVO_API_KEY`
- `BREVO_MAIN_LIST_ID`

## 3. Problemas com Remoção/Adição de Contatos

Para usuários novos, verificar se o contato é adicionado corretamente à lista TRIAL:
```typescript
// No código da Edge Function, verificar esta parte:
if (targetListId) {
  brevoContact.listIds = [parseInt(targetListId)];
  console.log(`Adicionando novo contato à lista ${targetListId} para status ${userStatus}`);
} else {
  console.warn(`Status do usuário não mapeado para uma lista: ${userStatus}`);
}
```

Para mudanças de status, verificar as operações de remoção e adição:
```typescript
// Remover de todas as listas de status
for (const listId of Object.values(statusListIds)) {
  // código de remoção
}

// Adicionar à lista correta para o status atual
if (targetListId) {
  // código de adição
}
```

## 4. Melhorias Sugeridas para a Função Edge

1. Adicionar mais logs de depuração detalhados
2. Verificar se o contato já existe no Brevo antes de tentar adicionar
3. Implementar mecanismo de retry para falhas temporárias
4. Validar os parâmetros recebidos no webhook antes de processar

## 5. Teste Manual via Supabase UI

Para testar a função diretamente, acesse a UI do Supabase e:

1. No painel de Edge Functions, selecione "user-webhook"
2. Clique em "Invoke" e use este payload para teste:

```json
{
  "type": "INSERT",
  "table": "users",
  "schema": "public",
  "record": {
    "id": "test-id",
    "email": "test@example.com",
    "status": "TRIAL",
    "full_name": "Test User",
    "whatsapp": "5511999999999",
    "created_at": "2023-01-01T00:00:00.000Z"
  }
}
```

3. Verifique os logs para identificar possíveis erros

## 6. Considerações Finais

Se após aplicar as correções no trigger do PostgreSQL ainda persistirem problemas, pode ser necessário revisar completamente a integração com o Brevo, incluindo as permissões de API e acesso às listas.

O script SQL `fix_brevo_integration.sql` criado corrige a parte do trigger no PostgreSQL, mas também é importante verificar o funcionamento da função Edge. 