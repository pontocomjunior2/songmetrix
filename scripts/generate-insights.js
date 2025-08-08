import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Configurar variáveis de ambiente
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Carregar .env do diretório raiz
dotenv.config({ path: join(__dirname, '..', '.env') });

// Importar o serviço após carregar as variáveis de ambiente
const { InsightGeneratorService } = await import('../src/services/insightGeneratorService.js');

/**
 * Script para gerar insights musicais para usuários
 * 
 * Uso:
 * - Todos os usuários: node scripts/generate-insights.js
 * - Usuário específico: node scripts/generate-insights.js --user-id=uuid-here
 */
async function main() {
  const args = process.argv.slice(2);
  const userIdArg = args.find(arg => arg.startsWith('--user-id='));
  const specificUserId = userIdArg ? userIdArg.split('=')[1] : null;

  console.log('🚀 Iniciando geração de insights musicais...');
  console.log('📅 Data/Hora:', new Date().toISOString());
  
  if (specificUserId) {
    console.log('👤 Usuário específico:', specificUserId);
  } else {
    console.log('👥 Processando todos os usuários ativos');
  }

  const service = new InsightGeneratorService();
  
  try {
    const startTime = Date.now();
    
    if (specificUserId) {
      await service.generateInsightsForUser(specificUserId);
      console.log(`✅ Insight gerado para usuário ${specificUserId}`);
    } else {
      await service.generateInsightsForAllUsers();
      console.log('✅ Insights gerados para todos os usuários');
    }
    
    const endTime = Date.now();
    const duration = ((endTime - startTime) / 1000).toFixed(2);
    
    console.log(`⏱️  Tempo total de execução: ${duration}s`);
    console.log('🎉 Geração de insights concluída com sucesso!');
    
  } catch (error) {
    console.error('❌ Erro na geração de insights:', error);
    console.error('Stack trace:', error.stack);
    process.exit(1);
  } finally {
    try {
      await service.close();
      console.log('🔌 Conexões fechadas');
    } catch (closeError) {
      console.error('⚠️  Erro ao fechar conexões:', closeError);
    }
  }
}

// Tratamento de erros não capturados
process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  process.exit(1);
});

// Executar o script
main();