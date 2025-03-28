# Migração do Brevo para o SendPulse

Este documento resume as alterações realizadas para migrar a integração de email marketing do Brevo para o SendPulse no sistema Songmetrix.

## Arquivos Criados/Modificados

1. **Novo Serviço do SendPulse:**
   - `utils/sendpulse-service-esm.js` - Implementação principal da API do SendPulse
   - `src/utils/sendpulse-service.ts` - Versão TypeScript para uso no frontend

2. **Atualizações no Servidor:**
   - `server/server.js` - Atualizado para usar o serviço do SendPulse e endpoints correspondentes

3. **Atualização no Frontend:**
   - `src/components/Admin/UserList.tsx` - Atualizado para usar os novos endpoints do SendPulse

4. **Configurações de Ambiente:**
   - `.env` - Adicionadas variáveis para o SendPulse mantendo compatibilidade com o Brevo

5. **Scripts de Banco de Dados:**
   - `init-sendpulse-lists.sql` - Script para inicializar tabelas e funções relacionadas ao SendPulse

6. **Documentação:**
   - `INSTRUCOES-MIGRACAO-SENDPULSE.md` - Guia passo a passo para migração
   - `README-SENDPULSE.md` - Este arquivo de resumo

## Principais Alterações

### 1. Nova Implementação da API

O novo serviço do SendPulse implementa as seguintes funcionalidades:

- Autenticação OAuth com SendPulse usando Client ID e Secret
- Gerenciamento de tokens de acesso
- Verificação, criação e atualização de contatos
- Gerenciamento de listas (adicionar/remover contatos)
- Sincronização automática baseada no status do usuário

### 2. Mudanças nos Endpoints

Os novos endpoints da API incluem:

- `/api/sendpulse/sync-user` - Para sincronizar um único usuário
- `/api/sendpulse/sync-users` - Para sincronizar todos os usuários (requer autenticação de admin)
- `/api/sendpulse/webhook` - Para webhooks de integração com o Supabase

### 3. Compatibilidade com Código Existente

Para garantir compatibilidade com o código existente:

- Mantivemos aliases para as funções do Brevo (`syncUserWithBrevo` -> `syncUserWithSendPulse`)
- Preservamos a estrutura de resposta da API
- Mantivemos as mesmas interfaces de usuário e processos de sincronização

## Testes Realizados

- [x] Sincronização de usuário individual
- [x] Sincronização em massa
- [x] Sincronização automática ao criar novo usuário
- [x] Sincronização automática ao alterar status de usuário

## Próximos Passos

1. Migrar contatos existentes do Brevo para o SendPulse
2. Atualizar os valores reais dos IDs de lista do SendPulse
3. Monitorar o funcionamento da integração
4. Remover código legado do Brevo após período de estabilidade

## Vantagens da Migração

- API mais estável e melhor documentada
- Maior limite de requisições (10/segundo vs 5/segundo no Brevo)
- Interface de usuário mais amigável para marketeiros
- Melhor custo-benefício para volumes maiores de envio

# Instruções SendPulse

## Inicialização do Serviço

Para funcionar corretamente, o sistema agora possui dois servidores:

1. **Servidor Principal**: Gerencia a aplicação web e as principais funcionalidades
2. **Servidor de Email**: Dedicado ao envio de emails através do SendPulse

### Como Iniciar os Servidores

Para iniciar ambos os servidores de uma vez, use o seguinte comando:

```bash
node start-servers.js
```

Este script irá:
- Iniciar o servidor principal
- Aguardar 2 segundos
- Iniciar o servidor de email
- Exibir logs de ambos os servidores usando cores diferentes para fácil identificação

### Inicialização Manual

Se preferir iniciar manualmente, você precisará de dois terminais:

Terminal 1 (Servidor Principal):
```bash
node server/server.js
```

Terminal 2 (Servidor de Email):
```bash
node server-email.js
```

## Problemas Comuns

### Erro "Not Found" (404) ao Enviar Emails

Se você estiver recebendo o erro `{"success":false,"error":"Erro na API (404): Not Found"}` ao tentar enviar emails, isso provavelmente indica que:

1. O servidor de email não está em execução, ou
2. O cliente está tentando acessar o endpoint incorreto

**Solução**:
- Certifique-se de que o servidor de email está em execução
- Verifique se o arquivo `src/utils/sendpulse-service.ts` está utilizando as rotas corretas:
  - Deve apontar para `/api/email/send-test` ao invés de `/api/sendpulse/send-email`
  - Deve apontar para `/api/email/send-welcome` ao invés de `/api/sendpulse/send-welcome`

## Configuração das Credenciais

As credenciais do SendPulse devem ser configuradas no arquivo `.env`:

```
# Configurações do SendPulse
SENDPULSE_CLIENT_ID=seu_client_id
SENDPULSE_CLIENT_SECRET=seu_client_secret
SENDPULSE_SENDER_NAME=Songmetrix
SENDPULSE_SENDER_EMAIL=noreply@songmetrix.com.br
```

## Estrutura de Servidores

Para entender a estrutura do sistema de email:

1. O frontend (cliente) faz requisições para o servidor principal em `/api/email/*`
2. O servidor principal redireciona para o servidor de email em desenvolvimento, ou usa proxy interno em produção
3. O servidor de email processa a requisição e utiliza a API do SendPulse para enviar os emails

Esta arquitetura garante melhor desempenho e escalabilidade para o envio de emails.

## Suporte

Se continuar enfrentando problemas, verifique os logs dos servidores para obter mais detalhes sobre os erros encontrados.

---

Feat(api): migrate from Brevo to SendPulse email marketing service 