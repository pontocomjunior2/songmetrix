# Guia Rápido - Painel de Insights

## ✅ Status Atual

- ✅ DOMPurify instalado e configurado
- ✅ Frontend rodando em http://localhost:5173
- ✅ Backend rodando em http://localhost:3001
- ✅ Rotas de admin configuradas e funcionando
- ✅ Componente InsightDashboardPage pronto

## 🚀 Como Acessar o Painel

### 1. Acesse o Sistema
```
http://localhost:5173/admin/insights
```

### 2. Pré-requisitos
- ✅ Estar logado no sistema
- ✅ Ter permissões de administrador
- ✅ Estar na tabela `public.admins`

### 3. Configurar Admin (se necessário)
```bash
# Obter seu user_id (faça login primeiro e verifique no DevTools)
npm run add-admin SEU_USER_ID_AQUI
```

## 🧪 Testando o Sistema

### 1. Criar Dados de Teste
```bash
npm run create-test-data
```

### 2. Gerar Insights de Teste
```bash
npm run test-insight-generator
```

### 3. Testar Rotas de Admin
```bash
npm run test-admin-routes
```

## 🎯 Funcionalidades do Painel

### Botão "Gerar Novos Insights"
- Inicia processo de geração em background
- Mostra toast informativo
- Recarrega automaticamente após 30 segundos

### Tabela de Rascunhos
- **Usuário**: Nome e e-mail do destinatário
- **Assunto**: Assunto gerado pelo LLM
- **Tipo**: Tipo de insight (growth_trend, etc.)
- **Criado Em**: Data/hora formatada
- **Status**: Badge colorido (draft, approved, sent, failed)
- **Ações**: Revisar, Aprovar, Enviar

### Modal de Revisão
- **Informações do Destinatário**: Dados completos
- **Dados do Insight**: Música, artista, crescimento
- **Preview HTML**: Conteúdo sanitizado com DOMPurify
- **Ações**: "Apenas Aprovar" ou "Aprovar e Enviar"

## 🔧 Troubleshooting

### "Acesso Negado"
- Verifique se você é admin: `SELECT * FROM admins WHERE user_id = 'SEU_ID';`
- Configure admin: `npm run add-admin SEU_USER_ID`

### "Nenhum Rascunho"
- Gere dados de teste: `npm run create-test-data`
- Execute geração: `npm run test-insight-generator`

### "Erro de API"
- Verifique se o backend está rodando: `npm run server`
- Teste as rotas: `npm run test-admin-routes`

### "Componente não carrega"
- Verifique se o frontend está rodando: `npm run dev`
- Teste acesso: `npm run test-dashboard`

## 📊 Fluxo de Trabalho

1. **Gerar Insights**: Clique em "Gerar Novos Insights"
2. **Aguardar**: Processo roda em background (30s)
3. **Revisar**: Clique em "Revisar" para ver o conteúdo
4. **Aprovar**: Use "Apenas Aprovar" ou "Aprovar e Enviar"
5. **Monitorar**: Acompanhe os status na tabela

## 🎉 Pronto para Usar!

O painel está totalmente funcional e pronto para uso em produção. Todas as funcionalidades especificadas foram implementadas:

- ✅ Geração de insights em background
- ✅ Listagem de rascunhos com filtros
- ✅ Modal de revisão com preview HTML
- ✅ Aprovação e envio de e-mails
- ✅ Feedback visual com toasts
- ✅ Tratamento de erros robusto
- ✅ Design responsivo e acessível

**Acesse agora:** http://localhost:5173/admin/insights