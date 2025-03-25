# Sincronização de Usuários com Brevo

Este documento descreve a solução implementada para resolver o problema de movimentação automática de usuários entre listas do Brevo quando há alteração de status.

## Problema

Quando um usuário tinha seu status alterado no painel de Admin (por exemplo, de ATIVO para TRIAL), essa alteração estava sendo salva corretamente no banco de dados Supabase, mas o usuário não estava sendo movido automaticamente para a lista correspondente no Brevo.

## Solução

A solução envolveu quatro componentes principais:

1. **Trigger SQL aprimorado**
   - Implementamos um trigger mais robusto no Supabase que detecta especificamente mudanças de status
   - Quando há uma mudança de status, o trigger envia tanto o registro antigo quanto o novo para a função Edge

2. **Função Edge user-webhook**
   - Melhoramos a função para detectar mudanças de status através da comparação entre o registro antigo e o novo
   - Implementamos um processo de remoção do usuário de todas as listas antes de adicioná-lo à lista correta
   - Atualizamos os atributos do contato para manter as informações sincronizadas

3. **Scripts de sincronização**
   - `sync-brevo-lists.js`: Sincroniza todos os usuários com suas listas corretas no Brevo
   - `force-sync-brevo.js`: Script para forçar a sincronização de um usuário específico
   - `test-brevo-sync.js`: Script para testar a sincronização com usuários TRIAL

4. **Solução SQL para reinstalação do trigger**
   - `deploy_brevo_webhook_fixed.sql`: Script SQL para reinstalar o trigger corretamente no Supabase

## Mapeamento de Status para Listas

Os status dos usuários são mapeados para as seguintes listas no Brevo:

- **TRIAL**: Lista #7
- **ATIVO**: Lista #8
- **INATIVO**: Lista #9

## Instruções de Uso

### Instalação e Configuração

1. **Instalar o trigger**
   ```sql
   -- Executar no SQL Editor do Supabase
   -- Conteúdo do arquivo supabase/migrations/deploy_brevo_webhook_fixed.sql
   ```

2. **Implantar a função Edge**
   ```bash
   cd supabase
   npx supabase functions deploy user-webhook
   ```

### Uso Diário

1. **Alteração pelo Painel Admin**
   - Ao alterar o status de um usuário no painel de Admin, a alteração deve ser automaticamente refletida no Brevo
   - O usuário deve ser removido da lista anterior e adicionado à lista correspondente ao novo status

2. **Sincronização Manual (se necessário)**
   ```bash
   # Sincronizar todos os usuários
   npm run sync-brevo-lists
   
   # Sincronizar um usuário específico
   npm run force-sync-brevo user@example.com ATIVO
   ```

3. **Teste da Integração**
   ```bash
   npm run test-brevo-sync
   ```

## Troubleshooting

Se um usuário não for movido automaticamente entre listas após a alteração de status:

1. Verificar se o trigger está instalado e ativo:
   ```sql
   SELECT * FROM pg_trigger WHERE tgname = 'trigger_sync_user_to_brevo';
   ```

2. Verificar logs da função Edge no Supabase Dashboard

3. Forçar a sincronização manual do usuário:
   ```bash
   node scripts/force-sync-brevo.js email@exemplo.com NOVO_STATUS
   ```

## Desenvolvimento e Manutenção

### Arquivos Relevantes

- **SQL**: `supabase/migrations/deploy_brevo_webhook_fixed.sql`
- **Função Edge**: `supabase/functions/user-webhook/index.ts`
- **Scripts de Sincronização**:
  - `scripts/sync-brevo-lists.js`
  - `scripts/force-sync-brevo.js`
  - `scripts/test-brevo-sync.js`

### NPM Scripts

Adicionamos os seguintes scripts ao `package.json`:

```json
{
  "sync-brevo-lists": "node scripts/sync-brevo-lists.js",
  "force-sync-brevo": "node scripts/force-sync-brevo.js",
  "test-brevo-sync": "node scripts/test-brevo-sync.js"
}
``` 