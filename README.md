# SongMetrix Dashboard

## Correções de Autenticação

### Problema: Tela branca após refresh (F5) e sessão persistente indesejada

Foram realizadas as seguintes alterações para resolver ambos os problemas:

1. **Cliente Supabase (supabase-client.ts)**:
   - **Mudança radical**: Implementada utilização de `sessionStorage` em vez de `localStorage`
   - Adicionada função `clearAllSessionData` para limpar todos os dados de sessão (localStorage, sessionStorage e cookies)
   - Adicionada limpeza completa de dados ao inicializar o cliente
   - Implementação de armazenamento personalizado com validação robusta
   - Adicionados redirecionamentos automáticos para login quando a sessão expira

2. **Contexto de Autenticação (AuthContext.tsx)**:
   - Adicionada função `checkSessionActive` para verificar se há uma sessão ativa
   - Aprimorada a função `refreshUserStatus` para verificar a sessão primeiro
   - Ajustada a ordem de operações para evitar race conditions
   - Adicionados redirecionamentos com `replace: true` para evitar erros de navegação
   - Melhorado o tratamento de erros e a lógica de inicialização

3. **Rotas Protegidas (ProtectedRoute.tsx)**:
   - Reescrita a lógica de verificação de autenticação
   - Implementada função de retry recursiva para atualização do status
   - Adicionada verificação prévia de usuário já autenticado para otimização
   - Adicionados redirecionamentos com `replace: true` para navegação mais limpa
   - Adicionada verificação final após todas as operações assíncronas

### Comportamento esperado após as alterações:

- A sessão é armazenada apenas no `sessionStorage`, sendo limpa automaticamente ao fechar a aba/navegador
- O refresh da página não causa mais tela branca, mantendo a navegação fluida
- Erros de autenticação são tratados graciosamente, com redirecionamentos apropriados
- A sessão expira após 15 minutos de inatividade, com verificação contínua
- Mensagens de erro claras são exibidas quando problemas ocorrem
- A experiência do usuário é melhorada com feedback visual durante o carregamento

## Desenvolvimento

Para executar o projeto localmente:

```bash
npm install
npm run dev
```

## Produção

Para construir o projeto para produção:

```bash
npm run build
```

## Correção de Erros do Supabase

### Erro: `42P01: missing FROM-clause entry for table "new"`

Este erro ocorre quando há uma referência à tabela especial `NEW` em políticas RLS do Supabase. Para corrigir, siga um dos métodos:

#### Método 1: Correção via Interface Web

1. Execute o servidor de migração:
   ```
   npm run migration-web
   ```

2. Acesse a interface web em seu navegador:
   ```
   http://localhost:3030
   ```

3. Insira suas credenciais do Supabase e clique em "Aplicar Migração".
   - A migração detectará o erro e aplicará a correção automaticamente.

#### Método 2: Correção via Linha de Comando

1. Execute o script de correção:
   ```
   npm run fix-trial-status
   ```

2. O script detectará o erro e aplicará a correção específica.

#### Método 3: Correção Manual no SQL Editor do Supabase

1. Acesse o dashboard do Supabase e vá para o SQL Editor.

2. Execute o seguinte script:
   ```sql
   -- Remover a política problemática
   DROP POLICY IF EXISTS "Usuários autenticados podem atualizar seus dados" ON "public"."users";

   -- Criar a política corrigida sem uso direto de NEW na cláusula WITH CHECK
   CREATE POLICY "Usuários autenticados podem atualizar seus dados" 
   ON "public"."users" 
   FOR UPDATE TO authenticated
   USING (
     auth.uid() = id
   ) 
   WITH CHECK (
     (auth.uid() = id) AND
     (
       -- Validar se o novo status é permitido
       (status IN ('ADMIN', 'ATIVO', 'INATIVO', 'TRIAL')) AND
       -- Apenas admins podem definir o status para ADMIN
       (
         (status = 'ADMIN' AND EXISTS (
           SELECT 1 FROM users WHERE id = auth.uid() AND status = 'ADMIN'
         )) OR
         (status != 'ADMIN')
       )
     )
   );
   ```

O problema ocorre porque a referência especial `NEW` só pode ser usada em funções de trigger (BEFORE/AFTER INSERT/UPDATE) e não pode ser usada diretamente em políticas RLS.