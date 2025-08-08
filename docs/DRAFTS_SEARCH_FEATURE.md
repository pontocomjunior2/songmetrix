# Funcionalidade de Busca nos Rascunhos

## 🔍 Visão Geral

Sistema de busca e filtro avançado para a tabela "Rascunhos para Revisão" no Painel de Insights, permitindo encontrar rapidamente insights específicos entre centenas de rascunhos.

## ✨ Funcionalidades Implementadas

### 1. **Campo de Busca Textual**
- 🔍 Busca em tempo real
- 📝 Pesquisa por:
  - Nome do usuário
  - E-mail do usuário  
  - Assunto do insight
  - Tipo de insight

### 2. **Filtros por Categoria**
- 📋 **Todos os insights** - Mostra todos os rascunhos
- ✨ **Personalizados** - Apenas insights customizados
- 🤖 **Automáticos** - Apenas insights gerados automaticamente
- 📝 **Rascunhos** - Apenas status "draft"
- ✅ **Aprovados** - Apenas status "approved"

### 3. **Indicadores Visuais**
- 📊 Contador de resultados encontrados
- 🔍 Ícones de busca ativa nos cabeçalhos
- 🎯 Indicador de filtro ativo
- ✨ Badges diferenciados para tipos de insight

### 4. **UX Melhorada**
- 🧹 Botão "Limpar filtros"
- 📱 Interface responsiva
- ⚡ Busca instantânea (sem delay)
- 💡 Mensagens explicativas

## 🎨 Interface

### Campo de Busca:
```
┌─────────────────────────────────────────┐
│ 🔍 Buscar por usuário, assunto ou tipo... │
└─────────────────────────────────────────┘
```

### Filtro por Tipo:
```
┌─────────────────────┐
│ 📋 Todos os insights ▼ │
├─────────────────────┤
│ ✨ Personalizados    │
│ 🤖 Automáticos       │
│ 📝 Rascunhos         │
│ ✅ Aprovados         │
└─────────────────────┘
```

### Contador de Resultados:
```
15 de 129 insights encontrados para "crescimento"  [Limpar filtros]
```

## 🔧 Como Usar

### 1. **Busca por Texto**
1. Digite no campo de busca
2. Resultados aparecem instantaneamente
3. Busca em nome, e-mail, assunto e tipo

### 2. **Filtro por Categoria**
1. Clique no dropdown de filtro
2. Selecione a categoria desejada
3. Tabela atualiza automaticamente

### 3. **Combinação de Filtros**
1. Use busca + filtro simultaneamente
2. Exemplo: "maria" + "Personalizados"
3. Encontra insights personalizados para usuários chamados Maria

### 4. **Limpar Filtros**
1. Clique em "Limpar filtros"
2. Ou apague o texto de busca
3. Ou selecione "Todos os insights"

## 📊 Exemplos de Uso

### Cenário 1: Encontrar insights de um usuário específico
```
Busca: "maria@exemplo.com"
Resultado: Todos os insights para este usuário
```

### Cenário 2: Ver apenas insights personalizados
```
Filtro: "✨ Personalizados"
Resultado: Apenas insights criados manualmente
```

### Cenário 3: Buscar por assunto específico
```
Busca: "descoberta"
Resultado: Insights com "descoberta" no assunto
```

### Cenário 4: Insights pendentes de aprovação
```
Filtro: "📝 Rascunhos"
Resultado: Apenas insights não aprovados
```

## 🎯 Badges de Tipo

### Insight Personalizado:
```
┌─────────────────┐
│ ✨ Personalizado │ (roxo)
└─────────────────┘
```

### Insight Automático:
```
┌─────────────┐
│ 🤖 Automático │ (cinza)
└─────────────┘
```

## 📱 Estados da Interface

### 1. **Estado Normal**
- Tabela com todos os rascunhos
- Campos de busca vazios
- Contador não visível

### 2. **Estado de Busca Ativa**
- Ícones de busca nos cabeçalhos
- Contador de resultados visível
- Botão "Limpar filtros" disponível

### 3. **Estado Sem Resultados**
- Ícone de busca grande
- Mensagem explicativa
- Botão para limpar filtros

### 4. **Estado Vazio**
- Mensagem de nenhum rascunho
- Botão para gerar novos insights

## 🧪 Testes

### Script de Teste:
```bash
node scripts/test-drafts-search.js
```

### Casos de Teste:
1. ✅ Busca por e-mail
2. ✅ Filtro por tipo personalizado
3. ✅ Busca por assunto
4. ✅ Filtro por status
5. ✅ Combinação de filtros
6. ✅ Limpar filtros

## 🔍 Campos Pesquisáveis

A busca procura nos seguintes campos:
- `draft.subject` - Assunto principal
- `draft.email_subject` - Assunto alternativo
- `draft.users.email` - E-mail do usuário
- `draft.users.full_name` - Nome do usuário
- `draft.insight_type` - Tipo do insight

## ⚡ Performance

- **Busca instantânea** - Sem debounce
- **Filtro em memória** - Não faz novas requisições
- **Limite de 50 usuários** - Para performance na seleção
- **Lazy loading** - Carrega conforme necessário

## 🎉 Benefícios

1. **Produtividade** - Encontra insights rapidamente
2. **Organização** - Separa personalizados de automáticos
3. **Eficiência** - Não precisa rolar a tabela toda
4. **Flexibilidade** - Múltiplos critérios de busca
5. **Usabilidade** - Interface intuitiva

## 📋 Status da Implementação

- [x] Campo de busca textual
- [x] Filtros por categoria
- [x] Indicadores visuais
- [x] Contador de resultados
- [x] Botão limpar filtros
- [x] Estados de interface
- [x] Badges diferenciados
- [x] Busca em tempo real
- [x] Interface responsiva
- [x] Testes automatizados

**🎯 Funcionalidade 100% implementada e testada!**