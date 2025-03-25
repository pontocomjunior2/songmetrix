# Integração com Brevo (Sendinblue)

Este documento explica como configurar e usar a integração com a plataforma Brevo (anteriormente Sendinblue) para envio de emails.

## Visão Geral

O Brevo é uma plataforma completa de marketing por email que oferece:

- Envio confiável de emails transacionais
- Rastreamento de aberturas e cliques
- Automação de marketing
- Segmentação avançada de usuários
- Interface amigável para gerenciamento de templates
- API robusta para integração

## Configuração

### 1. Criar uma conta no Brevo

1. Acesse [https://www.brevo.com](https://www.brevo.com)
2. Crie uma conta gratuita (permite até 300 emails por dia)
3. Verifique seu domínio de email (recomendado)

### 2. Obter a API Key

1. Faça login em sua conta Brevo
2. Acesse "SMTP & API" no menu lateral
3. Gere uma nova chave de API

### 3. Criar listas de contatos no Brevo

1. Acesse "Contatos" > "Listas" no menu lateral
2. Crie as seguintes listas:
   - Lista para usuários TRIAL (ID 7)
   - Lista para usuários ATIVOS (ID 8)
   - Lista para usuários INATIVOS (ID 9)
3. Anote os IDs das listas (você verá no URL quando estiver visualizando a lista)

### 4. Configurar o arquivo .env

```
BREVO_API_KEY=sua_api_key_aqui
BREVO_SENDER_NAME=Songmetrix
BREVO_SENDER_EMAIL=noreply@songmetrix.com.br
BREVO_MAIN_LIST_ID=7  # ID da lista principal (usuários Trial)
```

## Sincronização de Usuários com o Brevo

### Sincronização Automática

Quando um usuário é criado ou seu status é alterado no Supabase, o sistema automaticamente:

1. Cria/atualiza o contato no Brevo com os dados do usuário
2. Associa o contato à lista correta baseado no status:
   - TRIAL: Lista 7
   - ATIVO: Lista 8
   - INATIVO: Lista 9

Isso é feito através da integração webhook do Supabase, que chama a função Edge `user-webhook` quando há mudanças na tabela `users`.

### Sincronização Manual

#### Sincronizar todos os contatos com o Brevo

Para adicionar todos os usuários existentes como contatos no Brevo:

```bash
npm run sync-brevo-contacts
```

Este comando irá:
- Ler todos os usuários do banco de dados
- Criar ou atualizar os contatos no Brevo
- Adicionar os contatos à lista principal configurada no .env

#### Sincronizar contatos com as listas corretas baseado no status

Para garantir que todos os usuários estejam nas listas corretas de acordo com seus status:

```bash
npm run sync-brevo-lists
```

Este comando irá:
- Ler todos os usuários do banco de dados
- Distribuir os contatos nas listas corretas com base no status:
  - TRIAL: Lista 7
  - ATIVO: Lista 8
  - INATIVO: Lista 9
- Remover contatos das listas incorretas
- Exibir estatísticas detalhadas da sincronização

### Atualizar contato individual via API

Para atualizar manualmente um contato e suas listas:

```
POST /api/email/create-contact
{
  "email": "usuario@exemplo.com",
  "fullName": "Nome Completo",
  "status": "ATIVO"
}
```

Para atualizar apenas as listas de um contato baseado no status:

```
POST /api/email/update-contact-lists
{
  "email": "usuario@exemplo.com",
  "status": "ATIVO"
}
```

### 6. Configurar webhook para sincronização automática

Para sincronizar automaticamente os usuários com o Brevo quando eles forem criados ou atualizados:

1. Implante a função Edge:
   ```bash
   cd supabase/functions
   supabase functions deploy user-webhook --project-ref seu-ref-do-projeto
   ```

2. Configure as variáveis de ambiente da função Edge:
   ```bash
   supabase secrets set --env production BREVO_API_KEY=sua_api_key_aqui --project-ref seu-ref-do-projeto
   supabase secrets set --env production BREVO_MAIN_LIST_ID=7 --project-ref seu-ref-do-projeto
   ```

3. Execute a migração SQL para criar o webhook:
   - Abra o arquivo `supabase/migrations/20250503000000_add_brevo_webhook.sql`
   - Substitua `[PROJECT_REF]` pelo ID do seu projeto Supabase
   - Execute a migração no Studio SQL do Supabase ou via CLI

Após a configuração, todos os novos usuários serão automaticamente sincronizados com o Brevo e adicionados à lista correspondente ao seu status.

### 7. Sincronizar templates

Para sincronizar os templates do banco de dados com o Brevo:

```bash
npm run email:sync-brevo
```

Este comando irá:
- Ler todos os templates ativos do banco de dados
- Criar ou atualizar templates no Brevo
- Armazenar os IDs dos templates do Brevo de volta no banco de dados

## Usando a integração

### Iniciar o servidor de email

```bash
npm run email:server-brevo
```

### Enviar email de teste

```
POST /api/email/send-test
{
  "email": "destinatario@exemplo.com",
  "templateId": "id-do-template"
}
```

### Processamento de emails programados

```bash
npm run process-scheduled-emails
```

### Configuração como serviço

Para garantir que os emails sejam enviados mesmo após reinicialização do servidor:

```bash
# Instalar PM2 (se necessário)
npm install -g pm2

# Iniciar o serviço
pm2 start scripts/schedule-emails.js --name songmetrix-email-scheduler

# Salvar a configuração
pm2 save

# Configurar para iniciar no boot
pm2 startup
```

## Detalhes da Implementação

A integração com o Brevo foi implementada com as seguintes características:

### Componentes Principais

1. **Service API (server/brevo-email-service.js)**
   - Oferece funções para criar/atualizar contatos
   - Gerencia associação de contatos a listas
   - Envia emails usando templates

2. **Função Edge (supabase/functions/user-webhook/index.ts)**
   - Recebe eventos de criação/atualização de usuários
   - Sincroniza dados com o Brevo
   - Distribui usuários nas listas corretas baseado no status

3. **API REST (server-email.js)**
   - Expõe endpoints para interação com o Brevo
   - Permite criar/atualizar contatos
   - Permite atualizar listas de contatos

4. **Scripts de Sincronização**
   - `sync-brevo-contacts.js`: Sincroniza todos os usuários com o Brevo
   - `sync-brevo-lists.js`: Distribui contatos nas listas corretas baseado no status

### Fluxo de Funcionamento

1. **Usuário Criado/Atualizado no Supabase**
   - Trigger SQL aciona a função Edge
   - Função Edge envia dados para o Brevo
   - Usuário é adicionado à lista correspondente ao seu status

2. **Envio de Emails**
   - Templates são carregados do banco ou do Brevo
   - Variáveis são substituídas nos templates
   - Email é enviado via API do Brevo

3. **Gerenciamento de Listas**
   - Usuários TRIAL são adicionados à lista 7
   - Usuários ATIVOS são adicionados à lista 8
   - Usuários INATIVOS são adicionados à lista 9
   - Usuários são removidos de outras listas ao mudar de status

## Vantagens do Brevo sobre SMTP direto

1. **Maior confiabilidade**: Evita problemas de bloqueio e spam
2. **Rastreamento detalhado**: Taxas de abertura, cliques, entregas
3. **Interface de gestão**: Dashboard para monitoramento e templates
4. **Escalabilidade**: Fácil aumento do volume de envios
5. **Automações**: Campanhas automatizadas e segmentação
6. **Segmentação por listas**: Gerenciamento eficiente de comunicação por status

## Resolução de problemas

### Verificar status dos emails

1. Acesse o dashboard do Brevo
2. Navegue até "Emails transacionais" > "Log de eventos"
3. Consulte o status de entrega, problemas e estatísticas

### Problemas comuns

- **Email não enviado**: Verifique os limites diários da sua conta
- **Erros de autenticação**: Confirme a API key no arquivo .env
- **Templates não sincronizados**: Execute novamente `npm run email:sync-brevo`
- **Contatos em listas erradas**: Execute `npm run sync-brevo-lists` para corrigir
- **Webhook não funcionando**: Verifique logs da função Edge no console do Supabase 