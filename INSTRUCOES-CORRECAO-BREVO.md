# Instruções para Correção da Sincronização com Brevo

Este documento contém instruções detalhadas para corrigir os problemas de sincronização com o Brevo:

1. Sincronização automática de novos usuários TRIAL para a lista do Brevo com ID 7
2. Funcionamento correto do botão "Sincronizar com o Brevo" no componente Usuarios

## Problema 1: Sincronização automática de novos usuários TRIAL

### Solução: Instalar um novo trigger no Supabase

Para garantir que novos usuários com status TRIAL sejam automaticamente adicionados à lista 7 do Brevo, siga os passos abaixo:

1. Acesse o [Painel de Controle do Supabase](https://app.supabase.io)
2. Selecione seu projeto
3. Clique em "SQL Editor" no menu lateral
4. Crie uma nova consulta SQL
5. Cole o conteúdo do arquivo `install-brevo-sync.sql` que foi criado
6. Execute a consulta SQL clicando em "Run"

Este script irá:
- Criar uma nova função `sync_trial_user_to_brevo()` que será responsável por enviar os dados do usuário para a função Edge
- Configurar um trigger que dispara a função automaticamente quando um novo usuário é criado
- Remover triggers antigos que podem estar causando conflitos

### Verificação

Após instalar o trigger, você pode testar criando um novo usuário com status TRIAL. Para verificar se a sincronização está funcionando:

1. Crie um novo usuário através da aplicação
2. Verifique na interface do Brevo se o usuário foi adicionado à lista 7
3. Verifique os logs do Supabase para confirmação

## Problema 2: Botão "Sincronizar com o Brevo" não funciona

### Solução: Atualizar o servidor Node.js

O endpoint responsável pela sincronização manual precisa ser atualizado. Siga os passos:

1. Acesse o servidor onde está hospedado o arquivo `server.js`
2. Faça backup do arquivo atual:
   ```bash
   cp server/server.js server/server.js.backup
   ```
3. Atualize o arquivo `server/server.js` com as correções realizadas no endpoint `/api/brevo/sync-users`
4. Reinicie o servidor:
   ```bash
   pm2 restart all  # ou o comando específico para seu ambiente
   ```

As alterações realizadas no endpoint `/api/brevo/sync-users` incluem:
- Correção no processamento de usuários
- Melhoria na detecção de erros
- Garantia de que cada usuário seja adicionado à lista correspondente ao seu status
- Tratamento de duplicação de contatos

### Verificação

Após aplicar as alterações, teste o botão "Sincronizar com o Brevo" no componente Usuarios:

1. Faça login como administrador
2. Acesse a página de Usuários
3. Clique no botão "Sincronizar com o Brevo"
4. Verifique se o processo conclui sem erros
5. Confirme na interface do Brevo se os usuários foram adicionados às listas corretas:
   - TRIAL -> Lista 7
   - ATIVO -> Lista 8
   - INATIVO -> Lista 9
   - ADMIN -> Lista 8

## Função Edge no Supabase (Opcional)

Se encontrar problemas com a função Edge que processa as requisições de sincronização, você também pode atualizá-la:

1. Acesse o [Painel de Controle do Supabase](https://app.supabase.io)
2. Vá para "Edge Functions"
3. Selecione a função `user-webhook`
4. Atualize o código da função com o conteúdo do arquivo modificado
5. Implante a nova versão

## Testando a Solução

Para garantir que ambos os problemas foram resolvidos, realize os seguintes testes:

1. **Teste de sincronização automática**:
   - Crie um novo usuário com status TRIAL
   - Verifique se ele é adicionado automaticamente à lista 7 do Brevo

2. **Teste de sincronização manual**:
   - Clique no botão "Sincronizar com o Brevo"
   - Verifique se todos os usuários são sincronizados corretamente
   - Confirme que cada usuário está na lista correspondente ao seu status

## Suporte

Se encontrar problemas durante a implementação das correções, você pode:

1. Verificar os logs do servidor para identificar erros
2. Verificar os logs da função Edge no Supabase
3. Verificar os logs de depuração do componente UserList no console do navegador

Em caso de dúvidas ou problemas, entre em contato com o suporte técnico.