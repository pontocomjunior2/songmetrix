# Serviço LLM - SongMetrix

Este documento descreve o serviço LLM implementado para geração automática de conteúdo de e-mails de insights no SongMetrix.

## Visão Geral

O `LlmService` é um adaptador TypeScript que permite comunicação com diferentes APIs de LLM (Large Language Models) para gerar conteúdo personalizado de e-mails baseado em dados de insights musicais.

## Arquitetura

### Componentes Principais

1. **`LlmService`** - Classe principal do serviço
2. **Tabela `llm_provider_settings`** - Configurações dos provedores LLM
3. **Scripts de configuração** - Ferramentas para setup e teste
4. **Logger Winston** - Sistema de logs detalhado

### Fluxo de Funcionamento

```
1. generateEmailContent() chamado com insightData
2. Busca provedor ativo na tabela llm_provider_settings
3. Switch baseado no provider_name
4. Chama método específico do provedor (_callOpenAiApi)
5. Retorna { subject, body_html }
```

## Estrutura de Arquivos

```
src/services/llmService.ts          # Classe principal do serviço
supabase/migrations/
  create_llm_provider_settings_table.sql  # Migração da tabela
scripts/
  setup-llm-provider.js             # Script de configuração
  test-llm-service.js               # Script de teste
docs/llm-service.md                 # Esta documentação
```

## Configuração Inicial

### 1. Executar Migração

Execute o SQL no Supabase para criar a tabela:

```sql
-- Execute o conteúdo de:
-- supabase/migrations/create_llm_provider_settings_table.sql
```

### 2. Configurar Provedor

Use o script interativo para configurar o primeiro provedor:

```bash
npm run setup-llm
```

O script irá:
- Verificar provedores existentes
- Solicitar API key da OpenAI
- Configurar modelo, tokens e temperatura
- Testar a configuração

### 3. Testar Serviço

Execute os testes para verificar funcionamento:

```bash
npm run test-llm
```

## API da Classe LlmService

### Método Público

#### `generateEmailContent(insightData: any): Promise<EmailContent>`

Gera conteúdo de e-mail baseado em dados de insight.

**Parâmetros:**
- `insightData`: Objeto com dados do insight musical

**Retorno:**
```typescript
interface EmailContent {
  subject: string;      // Assunto do e-mail
  body_html: string;    // Corpo em HTML
}
```

**Exemplo de uso:**
```typescript
import { LlmService } from './services/llmService';

const llmService = new LlmService();

const insightData = {
  userId: 'user-123',
  insightType: 'growth_trend',
  metrics: {
    totalPlays: 250,
    topArtist: 'Anitta',
    topSong: 'Envolver',
    growthPercentage: 35,
    uniqueArtists: 35,
    uniqueSongs: 120,
    uniqueRadios: 8
  }
};

const emailContent = await llmService.generateEmailContent(insightData);
console.log('Assunto:', emailContent.subject);
console.log('HTML:', emailContent.body_html);
```

### Métodos Privados

#### `_callOpenAiApi(apiKey: string, insightData: any, settings: LlmProviderSettings)`

Método privado para comunicação com a API da OpenAI.

**Características:**
- Usa `response_format: { type: 'json_object' }` para garantir JSON válido
- Suporte a diferentes modelos (gpt-4o, gpt-3.5-turbo)
- Configurações personalizáveis (max_tokens, temperature)
- Logs detalhados de uso e performance

## Tabela llm_provider_settings

### Estrutura

```sql
CREATE TABLE llm_provider_settings (
  id UUID PRIMARY KEY,
  provider_name TEXT UNIQUE,           -- 'OpenAI', 'Anthropic', etc.
  api_key TEXT NOT NULL,               -- Chave da API
  api_url TEXT,                        -- URL da API (opcional)
  model_name TEXT,                     -- Nome do modelo
  max_tokens INTEGER DEFAULT 1000,    -- Máximo de tokens
  temperature DECIMAL(3,2) DEFAULT 0.7, -- Temperatura (0-2)
  is_active BOOLEAN DEFAULT FALSE,     -- Apenas um pode estar ativo
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id)
);
```

### Políticas de Segurança

- **RLS habilitado**: Apenas admins podem ver/modificar
- **Trigger de ativação**: Apenas um provedor pode estar ativo
- **Validações**: Temperature (0-2), max_tokens (1-8000)

### Provedores Suportados

| Provedor | Status | Modelos Suportados |
|----------|--------|-------------------|
| OpenAI | ✅ Implementado | gpt-4o, gpt-3.5-turbo |
| Anthropic | 🔄 Planejado | Claude-3 |
| Google | 🔄 Planejado | Gemini |
| Azure | 🔄 Planejado | Azure OpenAI |

## Logs e Monitoramento

### Níveis de Log

- **INFO**: Operações normais, início/fim de processos
- **DEBUG**: Detalhes de prompts e configurações
- **ERROR**: Erros de API, configuração ou parsing
- **WARN**: Situações que merecem atenção

### Exemplos de Logs

```json
{
  "level": "info",
  "message": "[LlmService] Iniciando geração de conteúdo de e-mail",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "insightType": "growth_trend",
  "userId": "user-123"
}

{
  "level": "info", 
  "message": "[LlmService] Resposta recebida da OpenAI",
  "timestamp": "2024-01-15T10:30:05.000Z",
  "usage": {
    "prompt_tokens": 150,
    "completion_tokens": 200,
    "total_tokens": 350
  },
  "model": "gpt-4o",
  "finishReason": "stop"
}
```

## Tratamento de Erros

### Tipos de Erro

1. **Provedor não encontrado**: Nenhum provedor ativo configurado
2. **Erro de API**: Problemas na comunicação com o LLM
3. **Parsing JSON**: Resposta inválida do LLM
4. **Validação**: Dados de entrada inválidos

### Estratégias de Recuperação

- **Logs detalhados**: Todos os erros são registrados com contexto
- **Propagação controlada**: Erros são re-lançados com mensagens claras
- **Fallback futuro**: Possibilidade de implementar fallback para templates estáticos

## Segurança

### Proteção de API Keys

- **Armazenamento**: API keys ficam na tabela protegida por RLS
- **Acesso**: Apenas admins podem ver/modificar configurações
- **Logs**: API keys nunca aparecem nos logs (apenas presença/ausência)

### Validação de Entrada

- **Sanitização**: Dados de insight são serializados como JSON
- **Limites**: max_tokens e temperature têm validações de range
- **Timeout**: Chamadas de API têm timeout implícito

## Performance

### Otimizações

- **Cache de configuração**: Configurações são buscadas uma vez por chamada
- **Logs estruturados**: Permitem análise de performance
- **Métricas de uso**: Tokens utilizados são registrados

### Limites Recomendados

- **max_tokens**: 1000-2000 para e-mails (balance qualidade/custo)
- **temperature**: 0.7 para criatividade moderada
- **timeout**: 30 segundos para chamadas de API

## Exemplos de Uso

### Configuração Básica

```bash
# 1. Executar migração no Supabase
# 2. Configurar provedor
npm run setup-llm

# 3. Testar configuração
npm run test-llm
```

### Integração com Outros Serviços

```typescript
// Em um serviço de e-mail
import { LlmService } from './llmService';

class EmailService {
  private llmService = new LlmService();
  
  async sendInsightEmail(userId: string, insightData: any) {
    try {
      // Gerar conteúdo com LLM
      const emailContent = await this.llmService.generateEmailContent(insightData);
      
      // Enviar e-mail
      await this.sendEmail({
        to: user.email,
        subject: emailContent.subject,
        html: emailContent.body_html
      });
      
    } catch (error) {
      console.error('Erro ao enviar insight:', error);
      // Fallback para template estático
    }
  }
}
```

### Administração via API

```javascript
// Listar provedores (admin)
fetch('/api/admin/llm-settings', {
  headers: { 'Authorization': `Bearer ${token}` }
})

// Atualizar configurações (admin)
fetch('/api/admin/llm-settings', {
  method: 'PUT',
  headers: { 
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    llm_model: 'gpt-4o',
    max_tokens: 1500,
    temperature: 0.8
  })
})
```

## Troubleshooting

### Problemas Comuns

#### "Nenhum provedor LLM ativo encontrado"
- **Causa**: Tabela vazia ou nenhum provedor marcado como ativo
- **Solução**: Execute `npm run setup-llm` para configurar

#### "Erro na API da OpenAI: 401 Unauthorized"
- **Causa**: API key inválida ou expirada
- **Solução**: Verifique a API key em https://platform.openai.com/api-keys

#### "Resposta da API não contém as chaves necessárias"
- **Causa**: LLM não retornou JSON no formato esperado
- **Solução**: Ajuste o prompt ou temperature

#### "Timeout na chamada da API"
- **Causa**: API lenta ou indisponível
- **Solução**: Verifique status da API ou ajuste timeout

### Logs de Debug

Para ativar logs detalhados:

```bash
export LOG_LEVEL=debug
npm run test-llm
```

### Verificação de Saúde

```sql
-- Verificar provedor ativo
SELECT provider_name, model_name, is_active, updated_at 
FROM llm_provider_settings 
WHERE is_active = true;

-- Verificar últimas configurações
SELECT * FROM llm_provider_settings 
ORDER BY updated_at DESC 
LIMIT 5;
```

## Roadmap

### Próximas Funcionalidades

1. **Múltiplos Provedores**: Anthropic, Google, Azure
2. **Fallback Automático**: Trocar provedor em caso de falha
3. **Cache de Respostas**: Evitar chamadas desnecessárias
4. **Templates Personalizados**: Prompts específicos por tipo de insight
5. **Métricas Avançadas**: Dashboard de uso e performance
6. **Rate Limiting**: Controle de chamadas por usuário/período

### Melhorias Planejadas

1. **Validação de Prompt**: Verificar qualidade antes do envio
2. **A/B Testing**: Testar diferentes prompts/modelos
3. **Personalização**: Prompts baseados no perfil do usuário
4. **Multilíngua**: Suporte a diferentes idiomas