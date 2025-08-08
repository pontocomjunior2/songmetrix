# Sistema de Administração - SongMetrix

Este documento descreve o sistema de administração implementado para o SongMetrix, incluindo middleware de autenticação e rotas protegidas.

## Visão Geral

O sistema de admin foi implementado com:
- Middleware `checkAdminAuth` para verificar permissões de administrador
- Tabela `public.admins` para gerenciar usuários administradores
- Rotas protegidas para funcionalidades administrativas
- Integração com o sistema de autenticação existente

## Estrutura

### Arquivos Criados

1. **`src/routes/adminRoutes.ts`** - Versão TypeScript das rotas (para referência)
2. **`server/routes/adminRoutes.js`** - Rotas de admin em JavaScript (ativa)
3. **`sql/create_admins_table.sql`** - Script SQL para criar a tabela de admins
4. **`scripts/add-first-admin.js`** - Script para adicionar o primeiro administrador

### Middleware de Autenticação

O middleware `checkAdminAuth` funciona da seguinte forma:

1. Verifica se o usuário está autenticado (via middleware `authenticateBasicUser`)
2. Consulta a tabela `public.admins` para verificar se o `user_id` existe
3. Permite acesso apenas se o usuário for encontrado na tabela de admins

```javascript
// Exemplo de uso
app.use('/api/admin', authenticateBasicUser, adminRoutes);
```

## Configuração Inicial

### 1. Criar a Tabela de Admins

Execute o script SQL para criar a tabela:

```sql
-- Execute o conteúdo de sql/create_admins_table.sql no Supabase
```

### 2. Adicionar o Primeiro Admin

Use o script para adicionar o primeiro administrador:

```bash
node scripts/add-first-admin.js SEU_USER_ID_AQUI
```

**Como obter seu User ID:**
1. Faça login no sistema
2. Abra o Developer Tools (F12)
3. Vá para Application > Local Storage
4. Procure por dados do Supabase ou faça uma requisição autenticada
5. O user_id estará no token JWT ou nos dados do usuário

## Rotas Disponíveis

Todas as rotas estão protegidas pelo middleware `checkAdminAuth` e requerem autenticação prévia.

### Emails de Insights

- **GET** `/api/admin/insight-emails` - Listar emails de insights
  - Query params: `page`, `limit`, `status`
  
- **POST** `/api/admin/insight-emails` - Criar novo email de insight
  - Body: `user_id`, `insight_type`, `email_subject`, `email_content`, `metrics`
  
- **PUT** `/api/admin/insight-emails/:id` - Atualizar email de insight
  - Body: `status`, `email_subject`, `email_content`, `metrics`
  
- **DELETE** `/api/admin/insight-emails/:id` - Deletar email de insight

### Configurações de LLM

- **GET** `/api/admin/llm-settings` - Obter configurações atuais
- **PUT** `/api/admin/llm-settings` - Atualizar configurações
  - Body: `llm_api_url`, `llm_model`, `max_tokens`, `temperature`

### Gerenciamento de Usuários

- **GET** `/api/admin/users` - Listar usuários
  - Query params: `page`, `limit`, `search`, `status`
  
- **PUT** `/api/admin/users/:id/status` - Atualizar status do usuário
  - Body: `status` (ADMIN, ATIVO, TRIAL, FREE, INATIVO)

### Estatísticas

- **GET** `/api/admin/stats` - Obter estatísticas do sistema
- **GET** `/api/admin/check` - Verificar se o usuário atual é admin

## Exemplos de Uso

### Verificar se é Admin

```javascript
fetch('/api/admin/check', {
  headers: {
    'Authorization': `Bearer ${token}`
  }
})
.then(response => response.json())
.then(data => {
  if (data.isAdmin) {
    console.log('Usuário é admin');
  }
});
```

### Listar Usuários

```javascript
fetch('/api/admin/users?page=1&limit=50', {
  headers: {
    'Authorization': `Bearer ${token}`
  }
})
.then(response => response.json())
.then(data => {
  console.log('Usuários:', data.users);
  console.log('Paginação:', data.pagination);
});
```

### Atualizar Status de Usuário

```javascript
fetch('/api/admin/users/USER_ID/status', {
  method: 'PUT',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    status: 'ATIVO'
  })
})
.then(response => response.json())
.then(data => {
  console.log('Status atualizado:', data.user);
});
```

## Segurança

### Row Level Security (RLS)

A tabela `admins` possui políticas RLS que garantem:
- Apenas admins podem visualizar a tabela de admins
- Apenas admins podem inserir novos admins
- Apenas admins podem atualizar/deletar registros

### Middleware em Camadas

1. **`authenticateBasicUser`** - Verifica autenticação básica e status do usuário
2. **`checkAdminAuth`** - Verifica se o usuário é administrador

### Logs de Auditoria

Todas as ações administrativas são logadas com:
- ID do admin que executou a ação
- Timestamp da ação
- Detalhes da operação

## Troubleshooting

### Erro: "Usuário não é admin"

1. Verifique se o usuário foi adicionado à tabela `admins`
2. Confirme se o `user_id` está correto
3. Verifique se a tabela `admins` existe

### Erro: "Tabela admins não encontrada"

Execute o script SQL de criação:
```bash
# No Supabase SQL Editor, execute o conteúdo de:
# sql/create_admins_table.sql
```

### Erro de Permissão

1. Verifique se o middleware `authenticateBasicUser` está funcionando
2. Confirme se o token JWT é válido
3. Verifique se as políticas RLS estão configuradas corretamente

## Próximos Passos

1. **Interface Web**: Criar interface administrativa no frontend
2. **Logs de Auditoria**: Implementar tabela de logs para ações administrativas
3. **Permissões Granulares**: Implementar diferentes níveis de admin
4. **Notificações**: Sistema de notificações para ações administrativas

## Manutenção

### Adicionar Novo Admin

```bash
node scripts/add-first-admin.js NOVO_USER_ID
```

### Remover Admin

```sql
DELETE FROM public.admins WHERE user_id = 'USER_ID_AQUI';
```

### Listar Todos os Admins

```sql
SELECT a.user_id, u.email, a.created_at 
FROM public.admins a
LEFT JOIN auth.users u ON a.user_id = u.id;
```