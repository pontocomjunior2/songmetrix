# Configuração da Sincronização Automática com Brevo

## Visão Geral

Este documento descreve como configurar e testar a sincronização automática de novos usuários com o Brevo. Quando um novo usuário com status TRIAL é criado no Supabase, ele será automaticamente sincronizado com a lista correspondente no Brevo.

## Pré-requisitos

- Acesso ao banco de dados Supabase com permissões apropriadas
- Chave de API do Brevo configurada nas variáveis de ambiente
- IDs das listas configurados no Brevo

## Instalação

Execute o seguinte comando para instalar a sincronização automática:

```bash
npm run install-brevo-auto-sync
```

Este comando fará o seguinte:

1. Criar a função `exec_sql` no banco de dados
2. Instalar o trigger SQL que sincroniza automaticamente novos usuários TRIAL com o Brevo

Se o método padrão falhar, o script tentará automaticamente o método alternativo usando SQL direto.

### Método Alternativo de Instalação

Se você encontrar problemas com o método padrão, pode executar diretamente o método alternativo:

```bash
npm run direct-sql-setup
```

Este comando aplica o SQL diretamente ao banco de dados PostgreSQL do Supabase usando uma conexão direta, sem depender da função intermediária `exec_sql`.

#### Configuração da Conexão PostgreSQL

Para a conexão direta ao PostgreSQL, o script utiliza as seguintes variáveis de ambiente:

```
POSTGRES_HOST=db.seu-projeto.supabase.co
POSTGRES_PORT=5432
POSTGRES_DB=postgres
POSTGRES_USER=postgres
POSTGRES_PASSWORD=sua-chave-de-servico
```

Se estas variáveis não estiverem configuradas, o script tentará extrair as informações de conexão a partir da URL do Supabase e usando a chave de serviço como senha.

## Verificação da Instalação

Para verificar se o trigger foi instalado corretamente, você pode executar:

```bash
npm run apply-trigger-sql
```

Este comando verificará se o trigger já existe e, em caso afirmativo, confirmará que está corretamente instalado.

## Testando a Sincronização Automática

Para testar a sincronização automática:

1. Crie um novo usuário através da interface de cadastro
2. Defina o status do usuário como TRIAL
3. Verifique no painel do Brevo se o usuário foi adicionado à lista correspondente

## Sincronização Manual (para Administradores)

Administradores ainda podem sincronizar manualmente usuários quando necessário:

1. Acesse o painel de administração
2. Navegue até a lista de usuários
3. Utilize o botão de sincronização (visível apenas para administradores)

## Solução de Problemas

Se encontrar problemas na sincronização:

1. Verifique se as variáveis de ambiente estão configuradas corretamente:
   - `VITE_SUPABASE_URL` ou `SUPABASE_URL`
   - `VITE_SUPABASE_SERVICE_ROLE_KEY` ou `SUPABASE_SERVICE_KEY`
   - `VITE_BREVO_API_KEY` ou `BREVO_API_KEY`
   - `VITE_BREVO_TRIAL_LIST_ID` ou `BREVO_TRIAL_LIST_ID`

2. Verifique os logs do servidor para erros

3. Confirme se o trigger está instalado executando:
   ```sql
   SELECT * FROM pg_trigger WHERE tgname = 'trigger_sync_new_trial_user_to_brevo';
   ```

4. Se o método padrão falhar, tente o método alternativo:
   ```bash
   npm run direct-sql-setup
   ```

5. Para problemas com o método alternativo, verifique:
   - Se você tem as credenciais corretas do PostgreSQL
   - Se a conexão SSL está configurada corretamente
   - Se existe um firewall bloqueando a conexão

6. Como última alternativa, você sempre pode executar o SQL manualmente no console do Supabase:
   - Acesse https://supabase.com/dashboard
   - Selecione seu projeto
   - Vá para "SQL Editor"
   - Cole o conteúdo do arquivo `supabase/migrations/auto_sync_trial_users.sql`
   - Execute o script

## Scripts Disponíveis

- `npm run install-brevo-auto-sync` - Instala todo o sistema de sincronização automática
- `npm run create-exec-sql` - Cria apenas a função exec_sql
- `npm run apply-trigger-sql` - Instala ou verifica apenas o trigger
- `npm run direct-sql-setup` - Aplica SQL diretamente ao banco de dados (método alternativo)
- `npm run sync-brevo` - Sincroniza manualmente todos os usuários TRIAL com o Brevo 