# Componente InsightDashboardPage - SongMetrix

Este documento descreve o componente React `InsightDashboardPage` implementado para o painel de administração de insights musicais gerados por IA.

## Visão Geral

O `InsightDashboardPage` é um componente React com TypeScript que fornece uma interface completa para administradores gerenciarem insights musicais gerados automaticamente. O componente utiliza shadcn/ui para componentes de interface e react-toastify para notificações.

## Localização

```
src/pages/admin/InsightDashboardPage.tsx
```

## Funcionalidades Implementadas

### 1. Gerenciamento de Estado

✅ **Estados principais:**
- `drafts: Draft[]` - Lista de e-mails para revisão
- `isLoading: boolean` - Feedback visual durante chamadas de API
- `error: string | null` - Mensagens de erro

✅ **Estados do modal:**
- `isModalOpen: boolean` - Controle do modal de revisão
- `selectedDraft: Draft | null` - Rascunho selecionado para revisão
- `isApproving: boolean` - Estado de aprovação
- `isSending: boolean` - Estado de envio

### 2. Integração com API

✅ **Serviços utilizados:**
- `apiGet('/api/admin/insights/drafts')` - Buscar rascunhos
- `apiPost('/api/admin/insights/generate', {})` - Gerar insights
- `apiPost('/api/admin/insights/:id/approve', {})` - Aprovar insight
- `apiPost('/api/admin/insights/:id/send', {})` - Enviar insight

### 3. Interface do Usuário

✅ **Componentes shadcn/ui utilizados:**
- `Button` - Botões de ação
- `Card` - Containers de conteúdo
- `Table` - Tabela de rascunhos
- `Dialog` - Modal de revisão
- `Alert` - Mensagens de erro
- `Badge` - Indicadores de status

✅ **Ícones Lucide React:**
- `Wand2` - Geração de insights
- `Eye` - Revisão
- `Check` - Aprovação
- `Send` - Envio
- `Loader2` - Carregamento
- `AlertCircle` - Erros
- `Mail`, `User`, `Calendar` - Informações

## Estrutura do Componente

### Layout Principal

```typescript
<div className="container mx-auto p-6 space-y-6">
  {/* Cabeçalho com botão de geração */}
  <div className="flex items-center justify-between">
    <h1>Painel de Insights de IA</h1>
    <Button onClick={handleGenerateInsights}>
      Gerar Novos Insights
    </Button>
  </div>

  {/* Card principal com tabela */}
  <Card>
    <CardHeader>Rascunhos para Revisão</CardHeader>
    <CardContent>
      {/* Estados: loading, error, empty, table */}
    </CardContent>
  </Card>

  {/* Modal de revisão */}
  <Dialog>...</Dialog>
</div>
```

### Tabela de Rascunhos

**Colunas implementadas:**
- **Usuário** - Nome e e-mail do destinatário
- **Assunto** - Assunto do e-mail gerado
- **Tipo** - Tipo de insight (growth_trend, etc.)
- **Criado Em** - Data/hora de criação formatada
- **Status** - Badge com status atual
- **Ações** - Botões de ação (Revisar, Aprovar, Enviar)

### Modal de Revisão

**Seções do modal:**
1. **Informações do Destinatário** - Nome, e-mail, tipo, status
2. **Dados do Insight** - Música, artista, estatísticas de crescimento
3. **Preview do E-mail** - Conteúdo HTML sanitizado
4. **Ações** - Botões de aprovação e envio

## Funcionalidades Detalhadas

### 1. Geração de Insights

```typescript
const handleGenerateInsights = async () => {
  setIsGenerating(true);
  
  try {
    const response = await apiPost('/api/admin/insights/generate', {});
    
    if (response.status === 'accepted') {
      toast.info('Processo de geração iniciado!');
      
      // Recarregar após 30 segundos
      setTimeout(() => {
        fetchDrafts();
      }, 30000);
    }
  } catch (err) {
    toast.error('Erro ao iniciar geração');
  } finally {
    setIsGenerating(false);
  }
};
```

**Características:**
- ✅ Botão desabilitado durante geração
- ✅ Feedback visual com spinner
- ✅ Toast informativo sobre processo em background
- ✅ Recarregamento automático após 30 segundos

### 2. Busca de Rascunhos

```typescript
const fetchDrafts = useCallback(async () => {
  setIsLoading(true);
  setError(null);
  
  try {
    const response = await apiGet('/api/admin/insights/drafts');
    setDrafts(response.drafts || []);
  } catch (err) {
    setError(err.message);
    toast.error(err.message);
  } finally {
    setIsLoading(false);
  }
}, []);
```

**Características:**
- ✅ Carregamento na montagem do componente
- ✅ Estados de loading e error
- ✅ Tratamento de erros com toast

### 3. Aprovação de Insights

```typescript
const handleApprove = async (draftId: string) => {
  setIsApproving(true);
  
  try {
    await apiPost(`/api/admin/insights/${draftId}/approve`, {});
    toast.success('Insight aprovado com sucesso!');
    await fetchDrafts(); // Recarregar lista
  } catch (err) {
    toast.error('Erro ao aprovar insight');
  } finally {
    setIsApproving(false);
  }
};
```

**Características:**
- ✅ Feedback visual durante aprovação
- ✅ Toast de sucesso/erro
- ✅ Recarregamento automático da lista

### 4. Envio de E-mails

```typescript
const handleSend = async (draftId: string) => {
  setIsSending(true);
  
  try {
    const response = await apiPost(`/api/admin/insights/${draftId}/send`, {});
    toast.success(`E-mail enviado para ${response.recipient}!`);
    await fetchDrafts();
    setIsModalOpen(false); // Fechar modal
  } catch (err) {
    toast.error('Erro ao enviar insight');
  } finally {
    setIsSending(false);
  }
};
```

**Características:**
- ✅ Validação de status (apenas aprovados podem ser enviados)
- ✅ Feedback com destinatário
- ✅ Fechamento automático do modal

### 5. Aprovação e Envio Combinados

```typescript
const handleApproveAndSend = async (draftId: string) => {
  try {
    await handleApprove(draftId);
    
    setTimeout(async () => {
      await handleSend(draftId);
    }, 1000);
  } catch (err) {
    toast.error('Erro no processo de aprovação e envio');
  }
};
```

## Estados da Interface

### 1. Estado de Carregamento

```typescript
{isLoading && (
  <div className="flex items-center justify-center py-8">
    <Loader2 className="h-8 w-8 animate-spin" />
    <span className="ml-2">Carregando rascunhos...</span>
  </div>
)}
```

### 2. Estado de Erro

```typescript
{error && (
  <Alert variant="destructive">
    <AlertCircle className="h-4 w-4" />
    <AlertDescription>{error}</AlertDescription>
  </Alert>
)}
```

### 3. Estado Vazio

```typescript
{!isLoading && !error && drafts.length === 0 && (
  <div className="text-center py-8">
    <Mail className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
    <h3 className="text-lg font-semibold mb-2">Nenhum rascunho para revisar</h3>
    <p className="text-muted-foreground mb-4">
      Não há insights pendentes no momento.
    </p>
    <Button onClick={handleGenerateInsights} variant="outline">
      Gerar Novos Insights
    </Button>
  </div>
)}
```

## Segurança

### Sanitização de HTML

```typescript
import DOMPurify from 'dompurify';

<div
  dangerouslySetInnerHTML={{
    __html: DOMPurify.sanitize(selectedDraft.content)
  }}
  className="prose prose-sm max-w-none"
/>
```

**Características:**
- ✅ Sanitização com DOMPurify
- ✅ Prevenção contra XSS
- ✅ Renderização segura de HTML

## Responsividade

### Design Responsivo

- ✅ Container com `max-width` responsivo
- ✅ Grid adaptável para informações
- ✅ Modal com altura máxima e scroll
- ✅ Tabela com scroll horizontal em telas pequenas

### Breakpoints

```css
/* Implementado via Tailwind CSS */
.container mx-auto p-6        /* Padding responsivo */
.max-w-4xl                    /* Modal responsivo */
.grid-cols-2                  /* Grid responsivo */
.max-h-[80vh] overflow-y-auto /* Modal com scroll */
```

## Acessibilidade

### Recursos de Acessibilidade

- ✅ Botões com estados disabled apropriados
- ✅ Ícones com significado semântico
- ✅ Feedback visual para ações
- ✅ Estrutura semântica com headings
- ✅ Contraste adequado com cores do tema

### ARIA e Semântica

```typescript
// Botões com estados claros
<Button disabled={isApproving}>
  {isApproving ? <Loader2 className="animate-spin" /> : <Check />}
  Aprovar
</Button>

// Estrutura semântica
<DialogTitle>Título do Modal</DialogTitle>
<DialogDescription>Descrição do conteúdo</DialogDescription>
```

## Integração com Roteamento

### Rota Registrada

```typescript
// src/App.tsx
<Route 
  path="admin/insights" 
  element={<AdminRoute><InsightDashboardPage /></AdminRoute>} 
/>
```

### Proteção de Rota

- ✅ Protegida por `AdminRoute`
- ✅ Requer permissões de administrador
- ✅ Redirecionamento automático se não autorizado

## Performance

### Otimizações Implementadas

1. **useCallback** para funções que são dependências
2. **Lazy loading** de dados apenas quando necessário
3. **Estados locais** para evitar re-renders desnecessários
4. **Debounce implícito** no recarregamento automático

### Gerenciamento de Memória

```typescript
// Cleanup automático de estados
useEffect(() => {
  return () => {
    setDrafts([]);
    setError(null);
    setSelectedDraft(null);
  };
}, []);
```

## Testes

### Cenários de Teste Recomendados

1. **Carregamento inicial** - Verificar busca de rascunhos
2. **Geração de insights** - Testar processo em background
3. **Aprovação** - Verificar mudança de status
4. **Envio** - Testar envio de e-mails
5. **Modal** - Verificar abertura/fechamento
6. **Estados de erro** - Testar tratamento de erros
7. **Estados vazios** - Verificar quando não há dados

### Exemplo de Teste

```typescript
// Teste de geração de insights
test('should start insight generation', async () => {
  render(<InsightDashboardPage />);
  
  const generateButton = screen.getByText('Gerar Novos Insights');
  fireEvent.click(generateButton);
  
  expect(generateButton).toBeDisabled();
  expect(screen.getByText('Gerando...')).toBeInTheDocument();
});
```

## Troubleshooting

### Problemas Comuns

#### "DOMPurify is not defined"
- **Causa**: Biblioteca não instalada
- **Solução**: `npm install dompurify @types/dompurify`

#### "Rascunhos não carregam"
- **Causa**: API não configurada ou usuário não é admin
- **Solução**: Verificar rotas de API e permissões

#### "Modal não abre"
- **Causa**: Estado do modal não atualizado
- **Solução**: Verificar função `handleReview`

#### "Toast não aparece"
- **Causa**: react-toastify não configurado
- **Solução**: Verificar `ToastContainer` no App

### Debug

```typescript
// Adicionar logs para debug
console.log('Drafts loaded:', drafts);
console.log('Selected draft:', selectedDraft);
console.log('Modal open:', isModalOpen);
```

## Roadmap

### Próximas Funcionalidades

1. **Filtros** - Filtrar por tipo, status, data
2. **Busca** - Buscar por usuário ou assunto
3. **Paginação** - Para listas grandes
4. **Edição** - Editar conteúdo antes do envio
5. **Histórico** - Ver insights enviados
6. **Métricas** - Dashboard de performance

### Melhorias Planejadas

1. **Drag & Drop** - Reordenar prioridades
2. **Bulk Actions** - Ações em lote
3. **Templates** - Templates personalizáveis
4. **Preview Mobile** - Preview responsivo
5. **Agendamento** - Agendar envios
6. **A/B Testing** - Testar diferentes versões