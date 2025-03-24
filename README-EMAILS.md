# Sistema de Emails do SongMetrix

Este documento descreve o sistema de envio de emails para o SongMetrix, incluindo instruções para configuração e uso.

## Estrutura do Sistema

O sistema de emails é composto por:

1. **Tabelas no Supabase**:
   - `email_templates`: Armazena os templates de email em HTML
   - `email_sequences`: Configura sequências de email a serem enviadas após determinados dias do cadastro
   - `email_logs`: Registra histórico de todos os emails enviados

2. **APIs no servidor Express**:
   - `/api/email/send-welcome`: Endpoint para envio manual de email de boas-vindas
   - `/api/email/process-scheduled`: Endpoint para disparar processamento de emails agendados

3. **Scripts de processamento**:
   - `scripts/send-scheduled-emails.js`: Script para processamento diário de emails agendados
   - `scripts/send-welcome-email.js`: Script para envio manual de emails de boas-vindas

4. **Interface Administrativa**:
   - `EmailTemplates`: Gerenciamento de templates (criar, editar, visualizar, ativar/desativar)
   - `EmailSequences`: Configuração de sequências de email (quando enviar cada template)
   - `EmailLogs`: Visualização do histórico de emails enviados com filtros

## Configuração Inicial

### 1. Executar SQL no Supabase

Para criar as tabelas necessárias no Supabase:

1. Acesse o [Dashboard do Supabase](https://app.supabase.io)
2. Selecione seu projeto
3. Vá para a seção "SQL Editor"
4. Crie um novo arquivo de consulta (New query)
5. Cole o conteúdo do arquivo `sql/create_email_tables.sql`
6. Execute o script clicando em "RUN"

> **Nota**: O script criará as tabelas, índices, políticas de segurança e inserirá um template de email de boas-vindas padrão.

### 2. Configurar variáveis SMTP no arquivo .env

```
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=seu-email@gmail.com
SMTP_PASSWORD=sua-senha-de-app
SMTP_FROM=SongMetrix <noreply@songmetrix.com.br>
```

> **Importante**: Para Gmail, use uma "Senha de App" gerada nas configurações de segurança da sua conta Google.

## Uso do Sistema

### Interface Administrativa

Acesse a interface administrativa através do menu "Gerenciar Emails" no painel do administrador. Esta interface permite:

1. **Gerenciar Templates**: 
   - Criar, editar e visualizar templates HTML
   - Ativar/desativar templates existentes
   - Usar variáveis como `{{name}}`, `{{email}}` e `{{date}}` nos templates

2. **Configurar Sequências**:
   - Definir quando cada email deve ser enviado após o cadastro do usuário
   - Associar templates a sequências de email
   - Ativar/desativar sequências

3. **Visualizar Logs**:
   - Ver histórico de emails enviados
   - Filtrar por status, data e conteúdo
   - Ver detalhes de erros em envios falhos

### Envio Manual de Email de Boas-vindas

Para enviar manualmente um email de boas-vindas para um usuário específico:

```bash
npm run email:send-welcome
```

Este comando mostrará uma lista dos usuários recentes e permitirá selecionar um para envio.

### Processamento Automático de Emails Programados

Para processar manualmente os emails programados:

```bash
npm run email:send-scheduled
```

Em ambiente de produção, recomenda-se configurar um cron job para executar este comando diariamente:

```
0 9 * * * cd /caminho/para/songmetrix && npm run email:send-scheduled
```

Este exemplo configura o envio para todos os dias às 9:00.

## Funcionamento Técnico

1. **Envio de Boas-vindas**:
   - Ao registrar um novo usuário, o sistema pode enviar automaticamente um email de boas-vindas
   - O email de boas-vindas usa o template com nome 'welcome_email'

2. **Sequências de Email**:
   - A cada execução do script de processamento, o sistema verifica usuários que se cadastraram há X dias
   - Se existir uma sequência configurada para X dias após o cadastro, o email é enviado
   - Cada email é enviado apenas uma vez (verificado pela tabela de logs)

3. **Registro de Logs**:
   - Todos os envios são registrados na tabela `email_logs`
   - Sucesso ou falha são registrados com detalhes para auditoria

## Personalização de Templates

Ao criar templates HTML, você pode usar as seguintes variáveis:

- `{{name}}`: Nome do usuário (ou primeira parte do email se não houver nome)
- `{{email}}`: Email do usuário
- `{{date}}`: Data atual formatada no padrão brasileiro

Exemplo de HTML:

```html
<h1>Olá {{name}}!</h1>
<p>Seu email é {{email}} e hoje é {{date}}.</p>
```

## Segurança

- Acesso à interface administrativa e APIs é restrito a usuários com status 'ADMIN'
- Políticas RLS no Supabase garantem que apenas administradores possam gerenciar templates e sequências
- Senhas SMTP são armazenadas apenas no arquivo .env e nunca expostas no frontend 