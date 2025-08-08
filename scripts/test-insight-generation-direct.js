/**
 * Teste direto da geração de insights
 * Testa os serviços JavaScript diretamente sem passar pela API
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

async function testInsightGeneration() {
  try {
    console.log('🧪 Teste Direto da Geração de Insights - SongMetrix\n');

    // Instanciar serviços
    console.log('🔧 Instanciando serviços...');
    const llmService = new LlmService();
    const insightGenerator = new InsightGeneratorService(llmService);

    console.log('✅ Serviços instanciados com sucesso!');

    // Usar o admin como usuário de teste
    const testUserId = '962a2ae3-ebf1-4dcd-9f12-c9b41fda2d43';

    // Testar conexão com LLM usando dados de teste
    console.log('\n🤖 Testando conexão com LLM...');
    const testInsightData = {
      user_id: testUserId,
      insights: ['Teste de conexão com LLM'],
      user_name: 'Usuário Teste'
    };
    
    try {
      const llmResponse = await llmService.generateEmailContent(testInsightData);
      console.log('✅ LLM respondeu com subject:', llmResponse.subject);
    } catch (llmError) {
      console.log('❌ Erro no LLM:', llmError.message);
      return;
    }

    // Testar geração de insights para todos os usuários
    console.log('\n📊 Testando geração de insights para todos os usuários...');
    
    try {
      // Este método processa todos os usuários em background
      await insightGenerator.generateInsightsForAllUsers();
      console.log('✅ Processo de geração de insights iniciado com sucesso!');
      console.log('📝 Os insights serão salvos como rascunhos na base de dados.');
    } catch (insightError) {
      console.log('❌ Erro na geração de insights:', insightError.message);
    }

    // Fechar conexões
    await insightGenerator.close();
    console.log('\n🎉 Teste concluído!');

  } catch (error) {
    console.error('❌ Erro geral no teste:', error.message);
    console.error('Stack:', error.stack);
  }
}

// Executar teste
testInsightGeneration();