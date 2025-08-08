# Página Gerenciador de Prompts

Esta documentação descreve a nova página **PromptManagerPage** que permite aos administradores gerenciar templates de prompt para geração de insights de IA.

## 📍 Localização e Acesso

- **Arquivo:** `src/pages/admin/PromptManagerPage.tsx`
- **Rota:** `/admin/prompts`
- **Menu:** Sidebar Admin → "Gerenciar Prompts"
- **Permissão:** Apenas administradores (`planId === 'ADMIN'`)

## 🎯 Funcionalidades

### ✅ **CRUD Completo**
- **Criar** novos templates de prompt
- **Listar** todos os templates existentes
- **Editar** nome e conteúdo dos templates
- **Excluir** templates (com proteção para o último ativo)
- **Ativar** templates (apenas 1 ativo por vez)

### 🔧 **Interface de Usuário**

#### **Header**
- Título: "Gerenciador de Prompts da IA"
- Botão: "Criar Novo Prompt"
- Ícone: FileText (Lucide React)

#### **Alert Informativo**
- Explica o uso do placeholder `{{INSIGHT_DATA}}`
- Informa sobre a exclusividade de ativação

#### **Tabela de Templates**
| Coluna | Descrição |
|--------|-----------|
| **Nome do Template** | Nome identificador do template |
| **Status** | Badge "Ativo" (verde) ou "Inativo" (cinza) |
| **Conteúdo** | Prévia truncada do conteúdo (100 chars) |
| **Criado Em** | Data/hora de criação formatada |
| **Ações** | Botões Ativar, Editar, Excluir |

#### **Modal de Criação/Edição**
- **Campo Nome:** Input obrigatório
- **Campo Conteúdo:** Textarea com 15 linhas, fonte monospace
- **Placeholder:** Exemplo completo de template
- **Validação:** Campos obrigatórios
- **Botões:** Cancelar, Criar/Atualizar

## 🔌 **Integração com APIs**

### **Endpoints Utilizados**
```typescript
GET    /api/admin/prompts           // Listar templates
POST   /api/admin/prompts           // Criar template
PUT    /api/admin/prompts/:id       // Atualizar template
POST   /api/admin/prompts/:id/activate // Ativar template
DELETE /api/admin/prompts/:id       // Excluir template
```

### **Estrutura de Dados**
```typescript
interface PromptTemplate {
  id: string;
  name: string;
  content: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}
```

## 🎨 **Componentes UI Utilizados**

### **shadcn/ui Components**
- `Button` - Botões de ação
- `Card` - Container principal
- `Table` - Listagem de templates
- `Dialog` - Modal de criação/edição
- `Input` - Campo de nome
- `Textarea` - Campo de conteúdo
- `Label` - Rótulos dos campos
- `Badge` - Status dos templates
- `Alert` - Informações importantes

### **Lucide React Icons**
- `FileText` - Ícone principal
- `Plus` - Criar novo
- `Edit` - Editar template
- `Trash2` - Excluir template
- `Zap` - Ativar template
- `Check` - Template ativo
- `Loader2` - Estados de carregamento
- `AlertCircle` - Alertas

## 🔄 **Estados e Lógica**

### **Estados Principais**
```typescript
const [prompts, setPrompts] = useState<PromptTemplate[]>([]);
const [isLoading, setIsLoading] = useState(true);
const [isSaving, setIsSaving] = useState(false);
const [isActivating, setIsActivating] = useState<string | null>(null);
const [isDeleting, setIsDeleting] = useState<string | null>(null);
const [editingPrompt, setEditingPrompt] = useState<PromptTemplate | null>(null);
const [isModalOpen, setIsModalOpen] = useState(false);
const [formData, setFormData] = useState<PromptForm>({ name: '', content: '' });
```

### **Funções Principais**
- `loadPrompts()` - Carrega lista de templates
- `handleSave()` - Salva template (criar/editar)
- `handleActivate()` - Ativa template específico
- `handleDelete()` - Exclui template com confirmação
- `handleOpenModal()` - Abre modal para criar/editar
- `handleCloseModal()` - Fecha modal e limpa estado

## 🛡️ **Validações e Segurança**

### **Validações Frontend**
- ✅ Campos obrigatórios (nome e conteúdo)
- ✅ Confirmação antes de excluir
- ✅ Desabilitar botões durante operações
- ✅ Estados de loading individuais

### **Validações Backend**
- ✅ Autenticação de administrador
- ✅ Verificação de existência antes de operações
- ✅ Proteção contra exclusão do último template ativo
- ✅ Transação atômica para ativação exclusiva

### **Tratamento de Erros**
- ✅ Toast notifications para feedback
- ✅ Estados de erro específicos
- ✅ Fallbacks para dados não encontrados

## 📱 **Responsividade**

### **Desktop**
- Layout em grid completo
- Modal com largura máxima de 4xl
- Tabela com scroll horizontal se necessário

### **Mobile**
- Botões adaptados para toque
- Modal ocupa altura máxima da tela
- Texto truncado em colunas estreitas

## 🧪 **Testes**

### **Teste Automatizado**
```bash
npm run test-prompt-manager-page
```

### **Casos de Teste**
1. ✅ Carregamento inicial de templates
2. ✅ Criação de novo template
3. ✅ Edição de template existente
4. ✅ Ativação de template (exclusividade)
5. ✅ Exclusão de template (com proteções)
6. ✅ Validação de campos obrigatórios
7. ✅ Estados de loading e erro

## 🚀 **Como Usar**

### **1. Acesso**
```
http://localhost:5173/admin/prompts
```

### **2. Criar Template**
1. Clique em "Criar Novo Prompt"
2. Preencha nome e conteúdo
3. Use `{{INSIGHT_DATA}}` onde necessário
4. Clique em "Criar Template"

### **3. Ativar Template**
1. Localize o template na tabela
2. Clique em "Ativar" (se inativo)
3. Confirme que apenas este ficou ativo

### **4. Editar Template**
1. Clique em "Editar" na linha do template
2. Modifique nome ou conteúdo
3. Clique em "Atualizar Template"

### **5. Excluir Template**
1. Clique em "Excluir" na linha do template
2. Confirme a exclusão no dialog
3. Template será removido permanentemente

## 📊 **Exemplo de Template**

```text
Você é um especialista em marketing musical para rádios brasileiras.

Baseado nos dados de insight fornecidos: {{INSIGHT_DATA}}

Crie um e-mail profissional que:
- Destaque o crescimento da música
- Use dados específicos para credibilidade
- Tenha tom profissional mas acessível
- Inclua chamada para ação clara

Responda APENAS com um objeto JSON válido contendo:
- "subject": assunto do e-mail (máximo 60 caracteres)
- "body_html": corpo do e-mail em HTML
```

## 🔗 **Integração com Sistema**

### **Fluxo Completo**
1. **Admin cria template** → PromptManagerPage
2. **Admin ativa template** → PromptManagerPage
3. **Sistema usa template** → LlmService
4. **Gera insights** → InsightDashboardPage

### **Dependências**
- ✅ Tabela `prompt_templates` no Supabase
- ✅ APIs em `server/routes/adminRoutes.js`
- ✅ LlmService modificado para usar templates
- ✅ Menu de navegação atualizado

## 🎯 **Próximas Melhorias**

1. **Versionamento** de templates
2. **Preview** do e-mail gerado
3. **Importar/Exportar** templates
4. **Categorização** por tipo de insight
5. **Métricas** de performance por template
6. **A/B Testing** de templates
7. **Templates** pré-definidos
8. **Histórico** de alterações

---

**Status:** ✅ **Implementado e Funcional**
**Versão:** 1.0.0
**Última Atualização:** Agosto 2025