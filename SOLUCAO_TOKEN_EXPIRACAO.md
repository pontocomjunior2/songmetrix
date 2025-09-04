# Solução para Problema de Expiração de Token

## Problema Identificado

O usuário estava enfrentando logout automático após um curto período logado, necessitando F5 ou novo login para acessar os dados novamente.

### Causas Raiz Identificadas:

1. **Sessão muito restritiva**: Configurada para expirar em apenas 15 minutos
2. **Armazenamento inadequado**: Uso forçado de `sessionStorage` em vez de `localStorage`
3. **Interferência com sistema nativo**: O código personalizado estava conflitando com o sistema de refresh automático do Supabase
4. **Verificações excessivas**: Checagem de expiração a cada requisição causando logouts prematuros

## Soluções Implementadas

### 1. Configuração Otimizada do Cliente Supabase (`src/lib/supabase-client.ts`)

**Antes:**
- Sessão de 15 minutos
- Storage personalizado complexo
- Verificações constantes de expiração
- Uso de `sessionStorage`

**Depois:**
- Sessão de inatividade de 2 horas (mais realista)
- Uso do storage padrão do Supabase (`localStorage`)
- Sistema de refresh automático nativo do Supabase
- Verificações otimizadas (a cada 5 minutos)
- Throttling de atualizações de atividade (30 segundos)

### 2. Melhorias no Gerenciamento de Tokens (`src/lib/auth.ts`)

**Melhorias:**
- Refresh automático quando token expira em menos de 15 minutos
- Melhor tratamento de erros
- Logs mais informativos
- Uso do sistema nativo de refresh do Supabase

### 3. Cliente de API Otimizado (`src/lib/api-client.ts`)

**Melhorias:**
- Uso da função `ensureValidToken` para garantir tokens válidos
- Fallback robusto em caso de erro
- Melhor tratamento de autenticação

### 4. Configurações Centralizadas (`src/config/session.ts`)

**Novo arquivo** com:
- Constantes centralizadas para configuração de sessão
- Funções utilitárias para debug
- Configurações facilmente ajustáveis

## Configurações Recomendadas

### Tempos de Sessão:
- **Inatividade**: 2 horas (ajustável em `SESSION_CONFIG.INACTIVITY_TIMEOUT`)
- **Verificação**: A cada 5 minutos
- **Refresh de token**: 15 minutos antes do vencimento
- **Throttle de atividade**: 30 segundos entre atualizações

### Eventos de Atividade Monitorados:
- `mousedown`, `mousemove`
- `keypress`, `scroll`
- `touchstart`, `click`

## Como Testar

1. **Teste de Sessão Normal:**
   - Faça login
   - Use a aplicação normalmente
   - Verifique se não há logouts inesperados

2. **Teste de Inatividade:**
   - Faça login
   - Deixe a aplicação inativa por mais de 2 horas
   - Tente usar a aplicação - deve fazer logout automático

3. **Teste de Refresh de Token:**
   - Monitore o console do navegador
   - Procure por logs de "Token próximo do vencimento, fazendo refresh..."

4. **Teste de Persistência:**
   - Faça login
   - Feche e reabra o navegador
   - A sessão deve persistir (se dentro do prazo de inatividade)

## Monitoramento

### Logs Importantes:
- `Auth state change: [evento]` - Mudanças de estado de autenticação
- `Token próximo do vencimento, fazendo refresh...` - Refresh automático
- `Sessão expirada por inatividade` - Logout por inatividade

### Verificações no DevTools:
- `localStorage`: Deve conter chaves do Supabase (`sb-*`)
- `sessionStorage`: Deve conter `songmetrix_last_activity`

## Configurações Ajustáveis

Para ajustar os tempos, edite `src/config/session.ts`:

```typescript
export const SESSION_CONFIG = {
  // Aumentar/diminuir tempo de inatividade
  INACTIVITY_TIMEOUT: 4 * 60 * 60 * 1000, // 4 horas
  
  // Ajustar frequência de verificação
  CHECK_INTERVAL: 10 * 60 * 1000, // 10 minutos
  
  // Ajustar throttle de atividade
  ACTIVITY_THROTTLE: 60 * 1000, // 1 minuto
};
```

## Benefícios da Solução

1. **Experiência do usuário melhorada**: Menos logouts inesperados
2. **Performance otimizada**: Menos verificações desnecessárias
3. **Compatibilidade**: Usa sistemas nativos do Supabase
4. **Manutenibilidade**: Configurações centralizadas e código mais limpo
5. **Robustez**: Melhor tratamento de erros e fallbacks

## Próximos Passos Recomendados

1. **Monitorar logs** por alguns dias para verificar comportamento
2. **Ajustar tempos** se necessário baseado no uso real
3. **Implementar notificações** de sessão próxima ao vencimento (opcional)
4. **Adicionar métricas** de sessão para análise (opcional)

---

**Nota**: Após implementar essas mudanças, recomenda-se limpar o cache do navegador e fazer um novo login para garantir que as novas configurações sejam aplicadas corretamente.