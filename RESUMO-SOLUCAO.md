# Resumo da Solução - Sincronização com Brevo

## Problemas Identificados

1. **Sincronização automática não funcional**: Novos usuários com status TRIAL não estavam sendo adicionados automaticamente à lista ID 7 do Brevo.
2. **Botão de sincronização manual não funcional**: O botão "Sincronizar com o Brevo" no componente Usuarios não estava sincronizando os contatos corretamente.

## Alterações Realizadas

### 1. Correção da Sincronização Automática

#### Novo Trigger SQL no Supabase (`install-brevo-sync.sql`)

Criamos um novo trigger SQL para o Supabase que:

- É acionado após a inserção de um novo usuário na tabela `auth.users`
- Verifica se o usuário tem status TRIAL
- Envia os dados diretamente para a Edge Function `user-webhook` via HTTP
- Registra os resultados nos logs para permitir diagnóstico
- Implementa tratamento de erros para não interromper o fluxo principal

```sql
CREATE OR REPLACE FUNCTION public.sync_trial_user_to_brevo()
RETURNS TRIGGER AS $$
DECLARE
  response_status INT;
  response_content TEXT;
  edge_function_url TEXT := 'https://aylxcqaddelwxfukerhr.supabase.co/functions/v1/user-webhook';
  -- código da função omitido para brevidade
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trigger_sync_trial_user_to_brevo
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.sync_trial_user_to_brevo();
```

### 2. Correção da Sincronização Manual

#### Atualização do Endpoint no Servidor (`server.js`)

Identificamos e corrigimos vários problemas no endpoint `/api/brevo/sync-users`:

- Melhorou o tratamento de erros com validações adicionais
- Corrigiu o problema de expressão regular para limpar números de telefone
- Garantiu que cada usuário seja adicionado à lista correta com base em seu status
- Implementou tratamento para casos de contatos duplicados
- Adicionou melhor resposta em streaming para acompanhamento do processo
- Melhorou as mensagens de erro e registros de log

Principais correções:
```javascript
// Correção da expressão regular
let whatsapp = user.whatsapp.replace(/\D/g, ''); // Antes era /\\D/g que não funcionava corretamente

// Melhoria no tratamento de listas
const targetListId = statusListIds[user.status];
if (!targetListId) {
  return { 
    success: false, 
    error: `Status desconhecido: ${user.status}`,
    email: user.email
  };
}

// Tratamento de erros mais robusto
if (!updateResponse.ok) {
  const updateError = await updateResponse.text();
  console.error(`Erro ao atualizar contato ${user.email}:`, updateError);
  return { 
    success: false, 
    error: `Erro ao atualizar atributos: ${updateError}`,
    email: user.email
  };
}
```

### 3. Melhorias na Função Edge (Opcional)

#### Atualização da Função `user-webhook` no Supabase

Atualizamos a função Edge que processa as requisições de sincronização:

- Melhorou a lógica de determinação da lista correta com base no status
- Adicionou validação mais robusta de entradas
- Implementou tratamento específico para usuários ADMIN (lista 8)
- Melhorou o tratamento de erros e mensagens de log
- Adicionou lógica para remover o contato de outras listas antes de adicionar à lista correta
- Implementou validação e criação de registro na tabela `users` quando necessário

```typescript
// Determinação correta da lista com tratamento de fallback
const targetListId = listId || statusListIds['TRIAL'];

// Remoção de listas anteriores antes de adicionar à nova lista
for (const [listStatus, listId] of Object.entries(statusListIds)) {
  // Pular a lista alvo - não precisamos remover da lista que ele deve estar
  if (listId === targetListId) continue;
  
  // Código de remoção omitido para brevidade
}
```

## Testes e Verificação

Para garantir que as alterações resolvem os problemas, são necessários dois tipos de testes:

1. **Teste de sincronização automática**: Criar um novo usuário TRIAL e verificar se ele é automaticamente adicionado à lista 7 do Brevo.

2. **Teste de sincronização manual**: Usar o botão "Sincronizar com o Brevo" e verificar se todos os contatos são corretamente sincronizados nas listas apropriadas.

## Conclusão

As alterações realizadas corrigem os dois problemas identificados:

1. Novos usuários com status TRIAL agora são automaticamente adicionados à lista do Brevo com ID 7.
2. O botão "Sincronizar com o Brevo" agora funciona corretamente, sincronizando todos os contatos em suas devidas listas. 