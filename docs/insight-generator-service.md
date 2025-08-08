# InsightGeneratorService - SongMetrix

Este documento descreve o serviço `InsightGeneratorService` implementado para análise de dados musicais e geração automática de insights personalizados.

## Visão Geral

O `InsightGeneratorService` é uma classe TypeScript que analisa dados de execução musical dos usuários, identifica padrões de crescimento e gera conteúdo personalizado de e-mails usando o `LlmService`.

## Arquitetura

### Injeção de Dependência

A classe utiliza injeção de dependência para receber uma instância do `LlmService`:

```typescript
constructor(private llmService: LlmService) {
  // Inicialização dos clientes Supabase e PostgreSQL
}
```

### Componentes Principais

1. **Cliente Supabase** - Para operações CRUD na tabela `users` e `generated_insight_emails`
2. **Pool PostgreSQL** - Para queries analíticas complexas
3. **LlmService** - Para geração de conteúdo personalizado
4. **Logger Winston** - Para logs estruturados

## Estrutura de Arquivos

```
src/services/insightGeneratorService.ts    # Classe principal
supabase/migrations/
  create_generated_insight_emails_table.sql    # Tabela principal
  add_deep_link_to_generated_insight_emails.sql # Campo deep_link
scripts/
  test-insight-generator.js                # Script de teste
  create-test-data.js                      # Criação de dados de teste
docs/insight-generator-service.md          # Esta documentação
```

## API da Classe

### Método Público Principal

#### `generateInsightsForAllUsers(): Promise<void>`

Processa todos os usuários da tabela `public.users` e gera insights personalizados.

**Fluxo de execução:**

1. **Log de início**: "Iniciando processo de geração de insights para todos os usuários."
2. **Busca usuários**: Query na tabela `public.users` selecionando `id` e `email`
3. **Loop de processamento**: Para cada usuário:
   - Chama `_findGrowthTrendInsight(user)`
   - Se insight encontrado, chama `llmService.generateEmailContent()`
   - Salva rascunho na tabela `generated_insight_emails`
   - Logs de sucesso/erro por usuário
4. **Tratamento de erros**: Erros individuais não interrompem o processo

**Exemplo de uso:**
```typescript
import { LlmService } from './llmService';
import { InsightGeneratorService } from './insightGeneratorService';

const llmService = new LlmService();
const insightGenerator = new InsightGeneratorService(llmService);

await insightGenerator.generateInsightsForAllUsers();
```

### Método Privado de Análise

#### `_findGrowthTrendInsight(user: { id: string, email: string }): Promise<GrowthTrendInsight | null>`

Executa query SQL analítica para encontrar músicas com maior crescimento de execuções.

**Query SQL implementada:**
```sql
-- Query para encontrar a música com maior crescimento
WITH weekly_plays AS (
  SELECT 
    song_id,
    EXTRACT(WEEK FROM played_at) as week_number,
    COUNT(*) as plays
  FROM music_plays
  WHERE played_at >= NOW() - INTERVAL '2 weeks'
    AND user_id = $1
  GROUP BY song_id, week_number
),
growth_calculation AS (
  SELECT 
    song_id,
    MAX(CASE WHEN week_number = EXTRACT(WEEK FROM NOW()) THEN plays END) as current_week_plays,
    MAX(CASE WHEN week_number = EXTRACT(WEEK FROM NOW()) - 1 THEN plays END) as previous_week_plays
  FROM weekly_plays
  GROUP BY song_id
)
SELECT 
  s.title,
  s.artist,
  gc.current_week_plays,
  gc.previous_week_plays
FROM growth_calculation gc
JOIN songs s ON s.id = gc.song_id
WHERE gc.previous_week_plays > 10 -- Evitar crescimento de músicas com pouquíssimas execuções
  AND gc.current_week_plays > gc.previous_week_plays -- Apenas crescimento positivo
ORDER BY (gc.current_week_plays::float / gc.previous_week_plays) DESC
LIMIT 1;
```

**Retorno:**
- `GrowthTrendInsight` com dados da música que mais cresceu
- `null` se nenhum insight for encontrado

## Estrutura de Dados

### Interface GrowthTrendInsight

```typescript
interface GrowthTrendInsight {
  title: string;                    // Nome da música
  artist: string;                   // Nome do artista
  current_week_plays: number;       // Execuções na semana atual
  previous_week_plays: number;      // Execuções na semana anterior
}
```

### Dados Enviados para o LLM

```typescript
const llmInsightData = {
  userId: string;                   // ID do usuário
  insightType: 'growth_trend';      // Tipo fixo do insight
  songTitle: string;                // Título da música
  artist: string;                   // Nome do artista
  currentWeekPlays: number;         // Execuções atuais
  previousWeekPlays: number;        // Execuções anteriores
  growthRate: string;               // Taxa de crescimento (ex: "3.00")
}
```

### Registro Salvo na Tabela

```typescript
{
  user_id: string;                  // ID do usuário
  subject: string;                  // Assunto gerado pelo LLM
  content: string;                  // HTML gerado pelo LLM
  insight_data: object;             // Dados do insight (JSON)
  insight_type: 'growth_trend';     // Tipo do insight
  deep_link: string;                // Link para a página do insight
  status: 'draft';                  // Status inicial
  created_at: string;               // Timestamp de criação
}
```

## Configuração e Setup

### 1. Executar Migrações

```sql
-- Execute no Supabase:
-- 1. supabase/migrations/create_generated_insight_emails_table.sql
-- 2. supabase/migrations/add_deep_link_to_generated_insight_emails.sql
```

### 2. Configurar LLM

```bash
npm run setup-llm
```

### 3. Criar Dados de Teste (Opcional)

```bash
npm run create-test-data
```

### 4. Testar o Serviço

```bash
npm run test-insight-generator
```

## Dependências de Banco de Dados

### Tabelas Necessárias

1. **`public.users`** - Tabela de usuários
   ```sql
   CREATE TABLE users (
     id UUID PRIMARY KEY,
     email TEXT NOT NULL
   );
   ```

2. **`public.songs`** - Tabela de músicas
   ```sql
   CREATE TABLE songs (
     id UUID PRIMARY KEY,
     title TEXT NOT NULL,
     artist TEXT NOT NULL
   );
   ```

3. **`public.music_plays`** - Tabela de execuções
   ```sql
   CREATE TABLE music_plays (
     id UUID PRIMARY KEY,
     song_id UUID REFERENCES songs(id),
     user_id UUID REFERENCES users(id),
     played_at TIMESTAMP WITH TIME ZONE
   );
   ```

4. **`public.generated_insight_emails`** - Tabela de insights gerados
   ```sql
   CREATE TABLE generated_insight_emails (
     id UUID PRIMARY KEY,
     user_id UUID REFERENCES users(id),
     subject TEXT NOT NULL,
     content TEXT NOT NULL,
     insight_type TEXT NOT NULL,
     insight_data JSONB,
     deep_link TEXT,
     status TEXT DEFAULT 'draft',
     created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
   );
   ```

### Índices Recomendados

```sql
-- Performance para queries de crescimento
CREATE INDEX idx_music_plays_user_played_at ON music_plays(user_id, played_at);
CREATE INDEX idx_music_plays_song_played_at ON music_plays(song_id, played_at);

-- Performance para busca de insights
CREATE INDEX idx_generated_insight_emails_user_status ON generated_insight_emails(user_id, status);
CREATE INDEX idx_generated_insight_emails_type_created ON generated_insight_emails(insight_type, created_at);
```

## Logs e Monitoramento

### Níveis de Log

- **INFO**: Início/fim de processos, usuários processados, insights encontrados
- **DEBUG**: Detalhes de queries SQL, dados de crescimento
- **ERROR**: Erros de usuários individuais, falhas de query, problemas de LLM
- **WARN**: Situações que merecem atenção

### Exemplos de Logs

```json
{
  "level": "info",
  "message": "Iniciando processo de geração de insights para todos os usuários.",
  "timestamp": "2024-01-15T10:00:00.000Z"
}

{
  "level": "info", 
  "message": "Insight encontrado para usuário user-123",
  "timestamp": "2024-01-15T10:00:05.000Z",
  "song": "Envolver",
  "artist": "Anitta",
  "growth": "45/15"
}

{
  "level": "info",
  "message": "Rascunho de insight criado com sucesso para o usuário user-123",
  "timestamp": "2024-01-15T10:00:10.000Z"
}
```

## Deep Links Gerados

### Formato do Deep Link

```
https://songmetrix.com.br/insights/growth-trend?song={songTitle}&artist={artist}&user={userId}
```

### Exemplo

```
https://songmetrix.com.br/insights/growth-trend?song=Envolver&artist=Anitta&user=user-123
```

## Tratamento de Erros

### Estratégias de Recuperação

1. **Erro individual**: Usuário com erro é logado e pulado
2. **Erro de query**: Conexão é liberada, erro é propagado
3. **Erro de LLM**: Erro é logado, processo continua
4. **Erro de salvamento**: Transação é revertida, erro é logado

### Tipos de Erro Comuns

1. **Usuário sem dados**: Nenhum insight encontrado (normal)
2. **Query timeout**: Conexão PostgreSQL lenta
3. **LLM indisponível**: Provedor não configurado ou API offline
4. **Tabela não existe**: Migração não executada

## Performance

### Otimizações Implementadas

1. **Pool de conexões**: Reutilização de conexões PostgreSQL
2. **Query otimizada**: Uso de CTEs e índices apropriados
3. **Processamento sequencial**: Evita sobrecarga do LLM
4. **Logs estruturados**: Facilita debugging

### Métricas Esperadas

- **Tempo por usuário**: 2-5 segundos (incluindo LLM)
- **Query de crescimento**: < 100ms com índices
- **Geração LLM**: 1-3 segundos por insight
- **Salvamento**: < 50ms por registro

## Exemplos de Uso

### Uso Básico

```typescript
import { LlmService } from './services/llmService';
import { InsightGeneratorService } from './services/insightGeneratorService';

async function runInsightGeneration() {
  const llmService = new LlmService();
  const insightGenerator = new InsightGeneratorService(llmService);
  
  try {
    await insightGenerator.generateInsightsForAllUsers();
    console.log('Insights gerados com sucesso!');
  } catch (error) {
    console.error('Erro na geração de insights:', error);
  } finally {
    await insightGenerator.close();
  }
}

runInsightGeneration();
```

### Integração com Cron Job

```javascript
// scripts/daily-insights.js
import cron from 'node-cron';
import { LlmService } from '../src/services/llmService.js';
import { InsightGeneratorService } from '../src/services/insightGeneratorService.js';

// Executar todos os dias às 9h
cron.schedule('0 9 * * *', async () => {
  console.log('Iniciando geração diária de insights...');
  
  const llmService = new LlmService();
  const insightGenerator = new InsightGeneratorService(llmService);
  
  try {
    await insightGenerator.generateInsightsForAllUsers();
    console.log('Geração diária concluída!');
  } catch (error) {
    console.error('Erro na geração diária:', error);
  } finally {
    await insightGenerator.close();
  }
});
```

### Integração com API

```typescript
// server/routes/insightRoutes.js
import { Router } from 'express';
import { LlmService } from '../../src/services/llmService.js';
import { InsightGeneratorService } from '../../src/services/insightGeneratorService.js';

const router = Router();

router.post('/generate-insights', async (req, res) => {
  try {
    const llmService = new LlmService();
    const insightGenerator = new InsightGeneratorService(llmService);
    
    await insightGenerator.generateInsightsForAllUsers();
    
    res.json({ 
      success: true, 
      message: 'Insights gerados com sucesso' 
    });
    
    await insightGenerator.close();
  } catch (error) {
    res.status(500).json({ 
      error: 'Erro na geração de insights',
      details: error.message 
    });
  }
});

export default router;
```

## Troubleshooting

### Problemas Comuns

#### "Nenhum insight encontrado para usuários"
- **Causa**: Dados insuficientes ou query muito restritiva
- **Solução**: Execute `npm run create-test-data` ou ajuste filtros da query

#### "Erro de conexão PostgreSQL"
- **Causa**: Variáveis de ambiente incorretas
- **Solução**: Verifique `POSTGRES_*` no `.env`

#### "LlmService não configurado"
- **Causa**: Nenhum provedor LLM ativo
- **Solução**: Execute `npm run setup-llm`

#### "Tabela não existe"
- **Causa**: Migrações não executadas
- **Solução**: Execute as migrações SQL no Supabase

### Verificação de Saúde

```sql
-- Verificar dados de teste
SELECT 
  COUNT(DISTINCT u.id) as users,
  COUNT(DISTINCT s.id) as songs,
  COUNT(*) as plays
FROM users u
CROSS JOIN songs s
CROSS JOIN music_plays mp ON mp.user_id = u.id AND mp.song_id = s.id;

-- Verificar insights gerados
SELECT 
  insight_type,
  status,
  COUNT(*) as count,
  MAX(created_at) as last_generated
FROM generated_insight_emails
GROUP BY insight_type, status
ORDER BY last_generated DESC;
```

## Roadmap

### Próximas Funcionalidades

1. **Múltiplos Tipos de Insight**: artist_focus, music_diversity, etc.
2. **Filtros Avançados**: Por gênero, período, região
3. **Insights Personalizados**: Baseados no perfil do usuário
4. **Batch Processing**: Processamento em lotes para melhor performance
5. **Cache de Resultados**: Evitar reprocessamento desnecessário

### Melhorias Planejadas

1. **Query Paralela**: Processar múltiplos usuários simultaneamente
2. **Fallback Inteligente**: Templates quando LLM falha
3. **Métricas Avançadas**: Dashboard de performance
4. **A/B Testing**: Diferentes tipos de insight por usuário
5. **Notificações**: Alertas para administradores sobre falhas