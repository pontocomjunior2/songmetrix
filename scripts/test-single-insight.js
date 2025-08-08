/**
 * Teste simples para um único usuário
 */

import { LlmService } from '../server/services/llmService.js';
import { InsightGeneratorService } from '../server/services/insightGeneratorService.js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Carregar variáveis de ambiente
const envPaths = [
  path.join(dirname(__dirname), '.env.production'),
  path.join(dirname(__dirname), '.env'),
];

for (const envPath of envPaths) {
  const result = dotenv.config({ path: envPath });
  if (result.error === undefined) {
    console.log('✅ Loaded environment variables from:', envPath);
    break;
  }
}

async function testSingleInsight() {
  try {
    console.log('🧪 Teste de Insight para Usuário Único\n');

    // Instanciar serviços
    const llmService = new LlmService();
    const insightGenerator = new InsightGeneratorService(llmService);

    // Testar com apenas um usuário
    const testUser = {
      id: '962a2ae3-ebf1-4dcd-9f12-c9b41fda2d43',
      email: 'admin@test.com'
    };

    console.log(`🔍 Testando insight para usuário: ${testUser.email}`);

    // Buscar insight
    const insightData = await insightGenerator._findGrowthTrendInsight(testUser);

    if (!insightData) {
      console.log('❌ Nenhum insight encontrado');
      return;
    }

    console.log('✅ Insight encontrado:', {
      song: insightData.song_title,
      artist: insightData.artist,
      growth: `${insightData.current_week_plays}/${insightData.previous_week_plays}`
    });

    // Preparar dados para o LLM
    const llmInsightData = {
      userId: testUser.id,
      insightType: 'growth_trend',
      songTitle: insightData.song_title,
      artist: insightData.artist,
      currentWeekPlays: insightData.current_week_plays,
      previousWeekPlays: insightData.previous_week_plays,
      growthRate: (insightData.current_week_plays / insightData.previous_week_plays).toFixed(2)
    };

    // Gerar conteúdo usando LLM
    const emailContent = await llmService.generateEmailContent(llmInsightData);

    console.log('✅ Conteúdo LLM gerado:', {
      subject: emailContent.subject,
      bodyLength: emailContent.body_html.length
    });

    // Fechar conexões
    await insightGenerator.close();
    console.log('\n🎉 Teste concluído com sucesso!');

  } catch (error) {
    console.error('❌ Erro no teste:', error.message);
  }
}

// Executar teste
testSingleInsight();