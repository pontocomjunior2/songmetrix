# Serviços de Geração de Insights

Este diretório contém os serviços responsáveis pela geração automática de insights musicais e e-mails personalizados para os usuários do SongMetrix.

## Arquivos

### `insightGeneratorService.ts`
Serviço principal que orquestra todo o processo de geração de insights:
- Busca usuários ativos no Supabase
- Executa queries analíticas no PostgreSQL
- Gera conteúdo de e-mail via LLM
- Salva e-mails gerados na tabela `generated_insight_emails`

### `llmService.ts`
Serviço responsável pela geração de conteúdo usando LLM (Large Language Model):
- Integração com OpenAI GPT ou outras APIs de LLM
- Templates de fallback quando LLM não está disponível
- Geração de e-mails personalizados baseados em dados analíticos

## Configuração

### Variáveis de Ambiente Necessárias

```env
# Supabase
VITE_SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# PostgreSQL
POSTGRES_USER=your_postgres_user
POSTGRES_HOST=your_postgres_host
POSTGRES_DB=your_postgres_db
POSTGRES_PASSWORD=your_postgres_password
POSTGRES_PORT=5432

# LLM (Opcional - usa fallback se não configurado)
OPENAI_API_KEY=your_openai_api_key
# ou
LLM_API_KEY=your_llm_api_key
LLM_API_URL=https://api.openai.com/v1/chat/completions
```

### Estrutura da Tabela `generated_insight_emails`

```sql
CREATE TABLE generated_insight_emails (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES users(id) NOT NULL,
  subject TEXT NOT NULL,
  content TEXT NOT NULL,
  insight_type TEXT NOT NULL,
  insight_data JSONB,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'failed')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  sent_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para performance
CREATE INDEX idx_generated_insight_emails_user_id ON generated_insight_emails(user_id);
CREATE INDEX idx_generated_insight_emails_status ON generated_insight_emails(status);
CREATE INDEX idx_generated_insight_emails_created_at ON generated_insight_emails(created_at);
```

## Uso

### Exemplo Básico

```typescript
import { InsightGeneratorService } from './services/insightGeneratorService';

// Instanciar o serviço
const insightGenerator = new InsightGeneratorService();

// Gerar insights para todos os usuários
await insightGenerator.generateInsightsForAllUsers();

// Ou gerar para um usuário específico
await insightGenerator.generateInsightsForUser('user-uuid-here');

// Fechar conexões quando terminar
await insightGenerator.close();
```

### Integração com Cron Job

```typescript
// scripts/generate-insights.js
import { InsightGeneratorService } from '../src/services/insightGeneratorService.js';

async function runInsightGeneration() {
  const service = new InsightGeneratorService();
  
  try {
    console.log('Iniciando geração de insights...');
    await service.generateInsightsForAllUsers();
    console.log('Geração de insights concluída com sucesso!');
  } catch (error) {
    console.error('Erro na geração de insights:', error);
    process.exit(1);
  } finally {
    await service.close();
  }
}

runInsightGeneration();
```

### Adição ao package.json

```json
{
  "scripts": {
    "generate-insights": "node scripts/generate-insights.js",
    "generate-insights:user": "node scripts/generate-insights.js --user-id"
  }
}
```

## Tipos de Insights Gerados

1. **Growth Trend**: Usuários com crescimento significativo na atividade musical
2. **Artist Focus**: Usuários com forte preferência por um artista específico
3. **Music Diversity**: Usuários com grande variedade musical
4. **General Activity**: Insights gerais sobre atividade musical

## Personalização

### Adicionando Novos Tipos de Insight

1. Modifique a query SQL em `findInsightsForUser()` para detectar novos padrões
2. Adicione novos casos no switch de `insightType`
3. Crie templates correspondentes no `LlmService`

### Customizando Templates de E-mail

Os templates de fallback podem ser customizados editando os métodos `build*Email()` no `LlmService`.

## Monitoramento e Logs

O serviço inclui logs detalhados para monitoramento:
- Início e fim do processamento
- Erros por usuário (sem interromper o processo geral)
- Estatísticas de insights gerados
- Falhas de API do LLM com fallback automático

## Considerações de Performance

- O processamento é feito usuário por usuário para evitar sobrecarga
- Conexões de banco são reutilizadas via pool
- Fallbacks garantem que o serviço funcione mesmo sem LLM
- Queries otimizadas com índices apropriados