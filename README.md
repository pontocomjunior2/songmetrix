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