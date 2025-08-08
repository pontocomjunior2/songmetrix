# Gerenciamento de Templates de Prompt

Este documento explica como usar o novo sistema de gerenciamento de templates de prompt para geração de insights de IA.

## 📋 Visão Geral

O sistema permite criar, editar e ativar templates de prompt personalizados que são usados pelo LlmService para gerar conteúdo de e-mails de insights.

### Principais Funcionalidades:
- ✅ CRUD completo de templates de prompt
- ✅ Sistema de ativação (apenas 1 prompt ativo por vez)
- ✅ Integração automática com o LlmService
- ✅ Placeholder `{{INSIGHT_DATA}}` para injeção de dados

## 🚀 Configuração Inicial

### 1. Aplicar a Função SQL
```bash
npm run setup-prompt-function
```

### 2. Testar o Sistema
```bash
npm run test-prompt-management
```

## 🔧 API Endpoints

### Listar Templates
```http
GET /api/admin/prompts
Authorization: Bearer <token>
```

**Resposta:**
```json
{
  "prompts": [
    {
      "id": "uuid",
      "name": "Nome do Template",
      "content": "Conteúdo do prompt...",
      "is_active": true,
      "created_at": "2024-01-01T00:00:00Z",
      "updated_at": "2024-01-01T00:00:00Z"
    }
  ]
}
```

### Criar Template
```http
POST /api/admin/prompts
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "Meu Novo Template",
  "content": "Você é um especialista... {{INSIGHT_DATA}} ..."
}
```

### Atualizar Template
```http
PUT /api/admin/prompts/:id
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "Nome Atualizado",
  "content": "Conteúdo atualizado..."
}
```

### Ativar Template
```http
POST /api/admin/prompts/:id/activate
Authorization: Bearer <token>
```

## 📝 Criando Templates de Prompt

### Estrutura Recomendada:

```text
Você é um especialista em marketing musical e análise de dados para rádios brasileiras.

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

### Placeholder Obrigatório:
- `{{INSIGHT_DATA}}`: Será substituído pelos dados do insight em JSON

### Dados Disponíveis no INSIGHT_DATA:
```json
{
  "userId": "string",
  "insightType": "trending_song|growth_analysis|...",
  "songTitle": "string",
  "artist": "string", 
  "currentWeekPlays": "number",
  "previousWeekPlays": "number",
  "growthRate": "string",
  "radioStation": "string",
  "timeframe": "string"
}
```

## 🔄 Integração com LlmService

O LlmService foi modificado para:

1. **Buscar template ativo** da tabela `prompt_templates`
2. **Injetar dados** substituindo `{{INSIGHT_DATA}}`
3. **Gerar conteúdo** usando o prompt personalizado

### Fluxo de Execução:
```
LlmService.generateEmailContent()
    ↓
Busca prompt ativo no banco
    ↓
Injeta dados do insight
    ↓
Chama API da OpenAI
    ↓
Retorna {subject, body_html}
```

## 🛡️ Segurança e Validações

### Middleware de Autenticação:
- Todas as rotas protegidas por `checkAdminAuth`
- Apenas administradores podem gerenciar prompts

### Validações:
- ✅ Campos obrigatórios: `name` e `content`
- ✅ Apenas 1 prompt ativo por vez (transação atômica)
- ✅ Verificação de existência antes de ativar/atualizar

### Tratamento de Erros:
- ❌ Prompt não encontrado → 404
- ❌ Nenhum prompt ativo → Erro no LlmService
- ❌ Dados inválidos → 400 Bad Request

## 🧪 Testes

### Teste Manual via API:
```bash
# 1. Criar prompt
curl -X POST http://localhost:3001/api/admin/prompts \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"name":"Teste","content":"Prompt com {{INSIGHT_DATA}}"}'

# 2. Ativar prompt
curl -X POST http://localhost:3001/api/admin/prompts/<id>/activate \
  -H "Authorization: Bearer <token>"

# 3. Testar geração
npm run test-llm
```

### Teste Automatizado:
```bash
npm run test-prompt-management
```

## 📊 Monitoramento

### Logs Importantes:
- `[LlmService] Template de prompt ativo encontrado`
- `[AdminRoutes] Template de prompt X ativado por admin Y`
- `[LlmService] Prompt criado com template do banco`

### Métricas:
- Número de templates criados
- Frequência de ativação de templates
- Taxa de sucesso na geração de conteúdo

## 🔧 Troubleshooting

### Erro: "Nenhum template de prompt ativo encontrado"
**Solução:** Ativar um template via API ou interface

### Erro: "Função activate_prompt_template não existe"
**Solução:** Executar `npm run setup-prompt-function`

### Erro: "Template de prompt não encontrado"
**Solução:** Verificar se o ID existe na tabela `prompt_templates`

## 🎯 Próximos Passos

1. **Interface Web** para gerenciar prompts
2. **Versionamento** de templates
3. **A/B Testing** de prompts
4. **Métricas** de performance por template
5. **Templates** pré-definidos por tipo de insight