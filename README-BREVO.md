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

### 3. Criar uma lista de contatos no Brevo

1. Acesse "Contatos" > "Listas" no menu lateral
2. Clique em "Criar uma lista"
3. Dê um nome à lista (ex: "Usuários Songmetrix")
4. Anote o ID da lista (você verá no URL quando estiver visualizando a lista)

### 4. Configurar o arquivo .env

```
BREVO_API_KEY=sua_api_key_aqui
BREVO_SENDER_NAME=Songmetrix
BREVO_SENDER_EMAIL=noreply@songmetrix.com.br
BREVO_MAIN_LIST_ID=123456  # ID da lista principal para usuários
```

### 5. Sincronizar contatos existentes

Para adicionar todos os usuários existentes como contatos no Brevo:

```bash
npm run sync-brevo-contacts
```

Este comando irá:
- Ler todos os usuários do banco de dados
- Criar ou atualizar os contatos no Brevo
- Adicionar os contatos à lista principal configurada no .env

### 6. Configurar webhook para sincronização automática (opcional)

Para sincronizar automaticamente os usuários com o Brevo quando eles forem criados ou atualizados:

1. Implante a função Edge:
   ```bash
   cd supabase/functions
   supabase functions deploy user-webhook --project-ref seu-ref-do-projeto
   ```

2. Configure as variáveis de ambiente da função Edge:
   ```bash
   supabase secrets set --env production BREVO_API_KEY=sua_api_key_aqui --project-ref seu-ref-do-projeto
   supabase secrets set --env production BREVO_MAIN_LIST_ID=123456 --project-ref seu-ref-do-projeto
   ```

3. Execute a migração SQL para criar o webhook:
   - Abra o arquivo `supabase/migrations/20250503000000_add_brevo_webhook.sql`
   - Substitua `[PROJECT_REF]` pelo ID do seu projeto Supabase
   - Execute a migração no Studio SQL do Supabase ou via CLI

Após a configuração, todos os novos usuários serão automaticamente sincronizados com o Brevo.

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

## Vantagens do Brevo sobre SMTP direto

1. **Maior confiabilidade**: Evita problemas de bloqueio e spam
2. **Rastreamento detalhado**: Taxas de abertura, cliques, entregas
3. **Interface de gestão**: Dashboard para monitoramento e templates
4. **Escalabilidade**: Fácil aumento do volume de envios
5. **Automações**: Campanhas automatizadas e segmentação

## Resolução de problemas

### Verificar status dos emails

1. Acesse o dashboard do Brevo
2. Navegue até "Emails transacionais" > "Log de eventos"
3. Consulte o status de entrega, problemas e estatísticas

### Problemas comuns

- **Email não enviado**: Verifique os limites diários da sua conta
- **Erros de autenticação**: Confirme a API key no arquivo .env
- **Templates não sincronizados**: Execute novamente `npm run email:sync-brevo` 