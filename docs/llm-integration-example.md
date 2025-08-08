# Exemplo de Integração - LlmService

Este documento mostra como integrar o novo `LlmService` com o sistema existente de geração de insights.

## Antes vs Depois

### Antes (LlmService antigo)
```typescript
// Método antigo com configuração hardcoded
async generateInsightEmail(insightData: InsightData, user: User): Promise<EmailContent> {
  try {
    if (!this.apiKey) {
      return this.generateFallbackEmail(insightData, user);
    }

    const prompt = this.buildPrompt(insightData, user);
    const response = await this.callLlmApi(prompt);
    
    return this.parseResponse(response);
  } catch (error) {
    console.error('[LlmService] Erro ao gerar e-mail com LLM:', error);
    return this.generateFallbackEmail(insightData, user);
  }
}
```

### Depois (LlmService novo)
```typescript
// Método novo com configuração dinâmica do banco
public async generateEmailContent(insightData: any): Promise<EmailContent> {
  try {
    // Busca provedor ativo automaticamente
    const { data: providerSettings, error } = await supabase
      .from('llm_provider_settings')
      .select('provider_name, api_key, api_url, model_name, max_tokens, temperature')
      .eq('is_active', true)
      .single();

    if (error || !providerSettings) {
      throw new Error('Nenhum provedor LLM ativo encontrado');
    }

    // Switch baseado no provedor configurado
    switch (providerSettings.provider_name) {
      case 'OpenAI':
        return await this._callOpenAiApi(providerSettings.api_key, insightData, providerSettings);
      // Outros provedores...
    }
  } catch (error) {
    logger.error('[LlmService] Erro na geração de conteúdo', { error });
    throw error;
  }
}
```

## Integração com InsightGeneratorService

### Atualização do Método processUserInsights

```typescript
// src/services/insightGeneratorService.ts

export class InsightGeneratorService {
  private llmService: LlmService;

  constructor() {
    // ... outras inicializações
    this.llmService = new LlmService();
  }

  /**
   * Processar insights para um usuário específico
   */
  private async processUserInsights(user: User): Promise<void> {
    try {
      console.log(`[InsightGenerator] Processando insights para usuário ${user.id}`);

      // 1. Gerar dados de insight (lógica existente)
      const insightData = await this.generateInsightData(user);
      
      if (!insightData) {
        console.log(`[InsightGenerator] Nenhum insight gerado para usuário ${user.id}`);
        return;
      }

      // 2. NOVO: Usar LlmService para gerar conteúdo
      let emailContent;
      try {
        emailContent = await this.llmService.generateEmailContent(insightData);
        console.log(`[InsightGenerator] Conteúdo LLM gerado para usuário ${user.id}`);
      } catch (llmError) {
        console.error(`[InsightGenerator] Erro no LLM para usuário ${user.id}:`, llmError);
        // Fallback para template estático
        emailContent = this.generateStaticEmailContent(insightData);
      }

      // 3. Salvar na tabela generated_insight_emails
      const emailRecord: GeneratedInsightEmail = {
        user_id: user.id,
        subject: emailContent.subject,
        content: emailContent.body_html, // Novo campo body_html
        insight_type: insightData.insightType,
        insight_data: insightData,
        status: 'draft'
      };

      await this.saveGeneratedEmail(emailRecord);
      console.log(`[InsightGenerator] E-mail salvo para usuário ${user.id}`);

    } catch (error) {
      console.error(`[InsightGenerator] Erro ao processar usuário ${user.id}:`, error);
      throw error;
    }
  }

  /**
   * Fallback para conteúdo estático quando LLM falha
   */
  private generateStaticEmailContent(insightData: InsightData): { subject: string; body_html: string } {
    const { metrics, insightType } = insightData;
    
    switch (insightType) {
      case 'growth_trend':
        return {
          subject: `🚀 Sua atividade musical cresceu ${metrics.growthPercentage}%!`,
          body_html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h1 style="color: #1a365d;">Crescimento Musical Detectado! 🚀</h1>
              <p>Temos novidades incríveis sobre sua atividade musical!</p>
              <div style="background: #f7fafc; padding: 20px; border-radius: 8px; margin: 20px 0;">
                <h3 style="color: #2d3748;">Seus números impressionantes:</h3>
                <ul>
                  <li><strong>${metrics.totalPlays} reproduções</strong> nos últimos 30 dias</li>
                  <li>Crescimento de <strong style="color: #38a169;">${metrics.growthPercentage}%</strong></li>
                  <li>Artista favorito: <strong>${metrics.topArtist}</strong></li>
                </ul>
              </div>
              <p>Continue explorando sua paixão pela música com o SongMetrix! 🎵</p>
            </div>
          `
        };
      
      case 'artist_focus':
        return {
          subject: `🎵 Você é fã de ${metrics.topArtist}!`,
          body_html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h1 style="color: #1a365d;">Seu Artista Favorito! 🎵</h1>
              <p>Notamos que você tem um artista especial em seu coração!</p>
              <div style="background: #f7fafc; padding: 20px; border-radius: 8px; margin: 20px 0;">
                <h3 style="color: #2d3748;">Seu artista favorito:</h3>
                <p style="font-size: 18px;"><strong>${metrics.topArtist}</strong></p>
                <p>Com <strong>${metrics.artistPlays} reproduções</strong> de um total de ${metrics.totalPlays}!</p>
              </div>
              <p>O SongMetrix te ajuda a descobrir ainda mais sobre seus artistas favoritos! 🌟</p>
            </div>
          `
        };
      
      default:
        return {
          subject: `📊 Seus insights musicais chegaram!`,
          body_html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h1 style="color: #1a365d;">Seus Insights Musicais 📊</h1>
              <p>Aqui estão seus insights musicais dos últimos 30 dias:</p>
              <div style="background: #f7fafc; padding: 20px; border-radius: 8px; margin: 20px 0;">
                <h3 style="color: #2d3748;">Resumo da sua atividade:</h3>
                <ul>
                  <li><strong>${metrics.totalPlays} reproduções</strong> no total</li>
                  <li>Artista favorito: <strong>${metrics.topArtist}</strong></li>
                  <li>Música mais ouvida: <strong>"${metrics.topSong}"</strong></li>
                </ul>
              </div>
              <p>Continue acompanhando sua jornada musical com o SongMetrix! 🎵</p>
            </div>
          `
        };
    }
  }

  /**
   * Salvar e-mail gerado na tabela
   */
  private async saveGeneratedEmail(emailRecord: GeneratedInsightEmail): Promise<void> {
    const { error } = await this.supabase
      .from('generated_insight_emails')
      .insert(emailRecord);

    if (error) {
      console.error('[InsightGenerator] Erro ao salvar e-mail:', error);
      throw error;
    }
  }
}
```

## Atualização das Rotas de Admin

### Integração com as Rotas Existentes

```typescript
// server/routes/adminRoutes.js

// Rota para testar geração de conteúdo LLM
adminRouter.post('/test-llm', checkAdminAuth, async (req, res) => {
  try {
    const { insightData } = req.body;

    if (!insightData) {
      return res.status(400).json({ 
        error: 'insightData é obrigatório' 
      });
    }

    // Importar e usar o LlmService
    const { LlmService } = await import('../../src/services/llmService.js');
    const llmService = new LlmService();

    const result = await llmService.generateEmailContent(insightData);

    res.json({ 
      success: true,
      result: {
        subject: result.subject,
        body_html: result.body_html,
        generated_at: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('[AdminRoutes] Erro no teste LLM:', error);
    res.status(500).json({ 
      error: 'Erro ao testar LLM',
      details: error.message 
    });
  }
});

// Rota para regenerar conteúdo de um e-mail existente
adminRouter.post('/insight-emails/:id/regenerate', checkAdminAuth, async (req, res) => {
  try {
    const { id } = req.params;

    // Buscar e-mail existente
    const { data: existingEmail, error: fetchError } = await supabaseAdmin
      .from('generated_insight_emails')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !existingEmail) {
      return res.status(404).json({ error: 'E-mail não encontrado' });
    }

    // Regenerar conteúdo com LLM
    const { LlmService } = await import('../../src/services/llmService.js');
    const llmService = new LlmService();

    const newContent = await llmService.generateEmailContent(existingEmail.insight_data);

    // Atualizar e-mail
    const { data: updatedEmail, error: updateError } = await supabaseAdmin
      .from('generated_insight_emails')
      .update({
        subject: newContent.subject,
        content: newContent.body_html,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (updateError) {
      throw updateError;
    }

    console.log(`[AdminRoutes] E-mail ${id} regenerado por admin ${req.user.id}`);
    res.json({ 
      message: 'Conteúdo regenerado com sucesso',
      email: updatedEmail 
    });

  } catch (error) {
    console.error('[AdminRoutes] Erro ao regenerar e-mail:', error);
    res.status(500).json({ 
      error: 'Erro ao regenerar conteúdo',
      details: error.message 
    });
  }
});
```

## Script de Migração de Dados

### Migrar E-mails Existentes para Novo Formato

```javascript
// scripts/migrate-existing-emails.js

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Carregar variáveis de ambiente
dotenv.config();

const supabaseAdmin = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

async function migrateExistingEmails() {
  try {
    console.log('🔄 Iniciando migração de e-mails existentes...');

    // Buscar e-mails com conteúdo no formato antigo
    const { data: oldEmails, error: fetchError } = await supabaseAdmin
      .from('generated_insight_emails')
      .select('*')
      .is('insight_data', null); // E-mails sem insight_data estruturado

    if (fetchError) {
      throw fetchError;
    }

    console.log(`📧 Encontrados ${oldEmails.length} e-mails para migrar`);

    for (const email of oldEmails) {
      try {
        // Tentar extrair dados do conteúdo existente
        const migratedData = extractInsightDataFromContent(email.content);
        
        // Atualizar com dados estruturados
        const { error: updateError } = await supabaseAdmin
          .from('generated_insight_emails')
          .update({
            insight_data: migratedData,
            updated_at: new Date().toISOString()
          })
          .eq('id', email.id);

        if (updateError) {
          console.error(`❌ Erro ao migrar e-mail ${email.id}:`, updateError);
        } else {
          console.log(`✅ E-mail ${email.id} migrado com sucesso`);
        }

      } catch (error) {
        console.error(`❌ Erro ao processar e-mail ${email.id}:`, error);
      }
    }

    console.log('🎉 Migração concluída!');

  } catch (error) {
    console.error('❌ Erro na migração:', error);
  }
}

function extractInsightDataFromContent(content) {
  // Lógica para extrair dados do conteúdo HTML antigo
  // Esta é uma implementação simplificada
  return {
    insightType: 'general_activity',
    metrics: {
      totalPlays: 0,
      topArtist: 'Não disponível',
      topSong: 'Não disponível',
      growthPercentage: 0
    },
    migrated: true,
    originalContent: content
  };
}

// Executar migração
migrateExistingEmails();
```

## Testes de Integração

### Teste Completo do Fluxo

```javascript
// scripts/test-full-integration.js

import { InsightGeneratorService } from '../src/services/insightGeneratorService.js';

async function testFullIntegration() {
  try {
    console.log('🧪 Teste de Integração Completa - LlmService + InsightGenerator\n');

    const insightGenerator = new InsightGeneratorService();

    // Simular dados de um usuário
    const testUser = {
      id: 'test-user-integration',
      email: 'test@songmetrix.com',
      name: 'Usuário Teste',
      plan_id: 'ATIVO',
      status: 'ATIVO'
    };

    console.log('👤 Processando insights para usuário teste...');
    
    // Processar insights (isso vai usar o novo LlmService internamente)
    await insightGenerator.processUserInsights(testUser);

    console.log('✅ Integração testada com sucesso!');
    console.log('💡 Verifique a tabela generated_insight_emails para o resultado');

  } catch (error) {
    console.error('❌ Erro no teste de integração:', error);
  }
}

testFullIntegration();
```

## Checklist de Migração

### Para Desenvolvedores

- [ ] Executar migração da tabela `llm_provider_settings`
- [ ] Configurar primeiro provedor com `npm run setup-llm`
- [ ] Testar LlmService isoladamente com `npm run test-llm`
- [ ] Atualizar InsightGeneratorService para usar novo LlmService
- [ ] Implementar fallback para templates estáticos
- [ ] Adicionar logs apropriados
- [ ] Testar integração completa
- [ ] Migrar dados existentes se necessário

### Para Administradores

- [ ] Obter API key da OpenAI
- [ ] Executar script de configuração
- [ ] Testar geração de conteúdo via admin panel
- [ ] Monitorar logs de erro
- [ ] Configurar alertas para falhas de API
- [ ] Definir limites de uso/custo

## Benefícios da Nova Implementação

1. **Flexibilidade**: Suporte a múltiplos provedores LLM
2. **Configuração Dinâmica**: Mudanças sem redeploy
3. **Logs Estruturados**: Melhor observabilidade
4. **Segurança**: API keys protegidas por RLS
5. **Fallback**: Graceful degradation quando LLM falha
6. **Administração**: Interface web para configuração
7. **Escalabilidade**: Preparado para crescimento