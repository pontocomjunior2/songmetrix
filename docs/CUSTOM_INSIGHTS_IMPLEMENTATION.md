# Implementação de Insights Personalizados

## 📋 Resumo da Funcionalidade

Sistema avançado de geração de insights personalizados que permite aos administradores criar e-mails de insights usando prompts livres com variáveis dinâmicas do banco de dados.

## 🎯 Funcionalidades Implementadas

### 1. Interface de Usuário Expandida

**Arquivo**: `src/pages/Admin/InsightDashboardPage.tsx`

- ✅ **Botão "Insight Personalizado"** no cabeçalho
- ✅ **Modal avançado** com interface em abas
- ✅ **Seleção de usuário específico** com busca em tempo real
- ✅ **Seleção de grupos** (admin, ativo, trial, free, premium, etc.)
- ✅ **Campo de prompt livre** com editor de texto
- ✅ **Painel de variáveis disponíveis** com inserção por clique
- ✅ **Preview das variáveis detectadas** no prompt
- ✅ **Validação de formulário** antes do envio

### 2. Variáveis Dinâmicas Disponíveis

```javascript
{user_name}           // Nome do usuário
{user_email}          // E-mail do usuário
{top_song}            // Música mais tocada
{top_artist}          // Artista mais tocado
{total_plays}         // Total de execuções
{weekly_plays}        // Execuções da semana
{monthly_plays}       // Execuções do mês
{growth_rate}         // Taxa de crescimento
{favorite_genre}      // Gênero favorito
{listening_hours}     // Horas de escuta
{discovery_count}     // Novas descobertas
{peak_hour}           // Horário de pico
{weekend_vs_weekday}  // Comparação fim de semana vs dias úteis
{mood_analysis}       // Análise de humor musical
```

### 3. Backend - Rotas API

**Arquivo**: `server/routes/adminInsightRoutes.js`

#### Nova Rota: `POST /api/admin/insights/generate-custom`

**Payload**:
```json
{
  "targetType": "user|group",
  "targetId": "user_id|group_name",
  "subject": "Assunto do e-mail",
  "customPrompt": "Prompt com {variáveis}",
  "variables": ["array", "de", "variáveis"]
}
```

**Funcionalidades**:
- ✅ Validação de campos obrigatórios
- ✅ Busca de usuários específicos ou grupos
- ✅ Processamento em background
- ✅ Substituição automática de variáveis
- ✅ Geração via LLM
- ✅ Salvamento como rascunho

### 4. Serviço de Dados

**Arquivo**: `server/services/insightGeneratorService.js`

#### Novo Método: `fetchUserData(userId)`

**Funcionalidades**:
- ✅ Busca dados do usuário no Supabase
- ✅ Consultas otimizadas no PostgreSQL
- ✅ Cálculos estatísticos avançados
- ✅ Análise de comportamento musical
- ✅ Tratamento de erros robusto

**Dados Coletados**:
- Música e artista mais tocados
- Estatísticas de execução (total, semanal, mensal)
- Taxa de crescimento calculada
- Horário de pico de escuta
- Análise fim de semana vs dias úteis
- Contagem de descobertas musicais
- Estimativa de horas de escuta

### 5. Componentes UI Criados

**Arquivos**:
- `src/components/ui/textarea.tsx` - Campo de texto multilinha
- `src/components/ui/select.tsx` - Componente de seleção
- `src/components/ui/tabs.tsx` - Sistema de abas

## 🔧 Como Usar

### 1. Acesso ao Sistema
1. Faça login como administrador
2. Acesse "Inteligência Artificial" > "Painel de Insights"
3. Clique em "Insight Personalizado"

### 2. Criação de Insight para Usuário Específico
1. Selecione a aba "Usuário Específico"
2. Use a busca para encontrar o usuário
3. Clique no usuário desejado
4. Digite o assunto do e-mail
5. Escreva o prompt usando variáveis `{nome_variavel}`
6. Clique em "Gerar Insight"

### 3. Criação de Insight para Grupo
1. Selecione a aba "Grupo de Usuários"
2. Escolha o grupo (admin, ativo, trial, etc.)
3. Digite o assunto do e-mail
4. Escreva o prompt com variáveis
5. Clique em "Gerar Insight"

### 4. Exemplo de Prompt

```text
Olá {user_name}!

Aqui está seu relatório musical personalizado:

🎵 **Sua música favorita**: {top_song} de {top_artist}
📊 **Estatísticas da semana**: {weekly_plays} execuções
📈 **Crescimento**: {growth_rate}
⏰ **Seu horário de pico**: {peak_hour}
🎧 **Total de horas ouvindo**: {listening_hours}h
🔍 **Novas descobertas**: {discovery_count} músicas

**Análise comportamental**: {weekend_vs_weekday}

Continue explorando sua paixão pela música!

Equipe SongMetrix
```

## 🧪 Teste da Funcionalidade

**Script de Teste**: `scripts/test-custom-insights.js`

```bash
node scripts/test-custom-insights.js
```

**O que o teste faz**:
- ✅ Autentica como admin
- ✅ Busca usuários disponíveis
- ✅ Gera insight para usuário específico
- ✅ Gera insight para grupo
- ✅ Verifica rascunhos criados

## 🔄 Fluxo de Processamento

1. **Recebimento da Solicitação**
   - Validação dos dados
   - Identificação do target (usuário/grupo)

2. **Busca de Usuários**
   - Usuário específico: busca por ID
   - Grupo: busca por status

3. **Processamento em Background**
   - Para cada usuário:
     - Busca dados musicais
     - Substitui variáveis no prompt
     - Gera conteúdo via LLM
     - Salva como rascunho

4. **Revisão e Aprovação**
   - Admin revisa rascunhos
   - Aprova conteúdo
   - Envia e-mails

## 📊 Métricas e Monitoramento

- ✅ Logs detalhados de cada etapa
- ✅ Contagem de usuários processados
- ✅ Tempo de processamento
- ✅ Taxa de sucesso/erro
- ✅ Rastreamento por admin

## 🚀 Próximas Melhorias

1. **Templates Salvos**: Salvar prompts frequentes
2. **Agendamento**: Insights automáticos periódicos
3. **Análise A/B**: Testar diferentes prompts
4. **Métricas de Engajamento**: Taxa de abertura/clique
5. **Variáveis Avançadas**: Análise de sentimento, recomendações

## 🔒 Segurança

- ✅ Autenticação obrigatória de admin
- ✅ Validação de entrada
- ✅ Sanitização de dados
- ✅ Rate limiting implícito
- ✅ Logs de auditoria

## 📝 Dependências Adicionais

```json
{
  "@radix-ui/react-select": "^2.0.0",
  "@radix-ui/react-tabs": "^1.0.4"
}
```

## ✅ Status da Implementação

- [x] Interface de usuário completa
- [x] Backend API funcional
- [x] Sistema de variáveis dinâmicas
- [x] Busca e seleção de usuários
- [x] Processamento em background
- [x] Integração com LLM
- [x] Salvamento de rascunhos
- [x] Testes automatizados
- [x] Documentação completa

**🎉 Sistema pronto para uso em produção!**