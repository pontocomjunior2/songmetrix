# Configuração do Sistema de Email no Supabase

Este guia explica como executar o script SQL para configurar o sistema de emails no Supabase.

## Passo a Passo

1. **Acesse o Dashboard do Supabase**
   - Entre em [app.supabase.io](https://app.supabase.io/)
   - Faça login na sua conta
   - Selecione o projeto do SongMetrix

2. **Abra o Editor SQL**
   - No menu lateral esquerdo, clique em "SQL Editor"
   - Clique no botão "New query" (Novo Query)

3. **Execute o Script SQL**
   - Cole o conteúdo do arquivo `sql/create_email_tables.sql` no editor
   - Clique no botão "RUN" (ou pressione Ctrl+Enter)
   - Aguarde a execução completa do script

4. **Verificação**
   - Vá para "Table Editor" no menu lateral
   - Verifique se as novas tabelas foram criadas:
     - `email_templates`
     - `email_sequences`
     - `email_logs`
   - Confirme se o template de boas-vindas padrão foi inserido

## Possíveis Problemas

### Erro UUID_GENERATE_V4
Se você receber um erro relacionado à função `uuid_generate_v4()`, execute o seguinte comando:

```sql
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
```

### Erro nos Índices
Se houver erro ao criar os índices, verifique se os nomes são únicos no banco de dados.

### Erro nas Políticas RLS
Se houver erro nas políticas RLS, verifique se:
1. As tabelas foram criadas corretamente
2. As referências a outras tabelas estão corretas

## Após a Configuração

Depois de executar o script com sucesso, você precisa:

1. **Configurar as variáveis SMTP no arquivo .env**:
   ```
   SMTP_HOST=smtp.seu-provedor.com
   SMTP_PORT=465
   SMTP_SECURE=true
   SMTP_USER=seu-email@seu-provedor.com
   SMTP_PASSWORD=sua-senha-ou-app-password
   SMTP_FROM=SONGMETRIX <noreply@songmetrix.com.br>
   ```

2. **Iniciar o servidor Express**:
   ```
   npm run server
   ```

3. **Acessar a interface administrativa**:
   - Entre no SongMetrix com uma conta de administrador
   - Navegue até "Gerenciar Emails" no menu lateral 