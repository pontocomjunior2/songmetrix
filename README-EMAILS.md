# Sistema de Emails do SongMetrix

Este documento descreve o sistema de envio de emails para o SongMetrix, incluindo instruções para configuração e uso.

## Estrutura do Sistema

O sistema de emails é composto por:

1. **Tabelas no Supabase**:
   - `email_templates`: Armazena os templates de email em HTML
   - `email_sequences`: Configura sequências de email a serem enviadas após determinados dias do cadastro ou após o primeiro login
   - `email_logs`: Registra histórico de todos os emails enviados

2. **APIs no servidor Express**:
   - `/api/email/send-welcome`: Endpoint para envio manual de email de boas-vindas
   - `/api/email/process-scheduled`: Endpoint para disparar processamento de emails agendados

3. **Scripts de processamento**:
   - `scripts/send-scheduled-emails.js`: Script para processamento diário de emails agendados na hora especificada
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

1. **Gerenciar Templates de Email**:
   - Criar templates com HTML e variáveis de substituição
   - Editar e visualizar templates existentes
   - Ativar/desativar templates

2. **Configurar Sequências de Email**:
   - Configurar quando cada template deve ser enviado
   - **Tipos de agendamento disponíveis**:
     - **Dias após cadastro**: Envia o email X dias após o cadastro do usuário, na hora especificada
     - **Após primeiro login**: Envia o email imediatamente após o primeiro login do usuário (após confirmação de email)
   - Especificar a hora do dia para envio (apenas para o tipo "Dias após cadastro")
   - Ativar/desativar sequências

3. **Visualizar Logs de Email**:
   - Ver histórico de emails enviados
   - Filtrar por usuário, status, template, etc.
   - Ver detalhes e mensagens de erro

### Configuração do Processamento Automático

Para configurar o processamento automático dos emails agendados, configure um cron job para executar o script `scripts/send-scheduled-emails.js` a cada hora:

```bash
# Exemplo de configuração no crontab
0 * * * * cd /caminho/do/projeto && node scripts/send-scheduled-emails.js >> /var/log/songmetrix/emails.log 2>&1
```

Este script irá:
1. Verificar a hora atual
2. Buscar emails que devem ser enviados nessa hora
3. Processar e enviar os emails
4. Registrar os resultados no log

## Variáveis de Template

Os templates de email suportam as seguintes variáveis que são substituídas automaticamente:

- `{{name}}`: Nome do usuário (ou primeira parte do email se não houver nome)
- `{{email}}`: Email do usuário
- `{{date}}`: Data atual no formato brasileiro (DD/MM/AAAA)

## Resolução de Problemas

### Emails não estão sendo enviados

1. Verifique os logs de email na interface administrativa para ver se há erros
2. Confirme que as variáveis SMTP estão configuradas corretamente no arquivo .env
3. Verifique se o cron job está executando corretamente (logs)
4. Verifique se as sequências e templates estão ativos

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