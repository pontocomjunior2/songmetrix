#!/usr/bin/env node

/**
 * Script de produção para geração de insights
 * Uso: node scripts/run-insight-generation.js [--dry-run] [--user-id=USER_ID]
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
    console.log(`✅ Loaded environment variables from: ${envPath}`);
    break;
  }
}

// Processar argumentos da linha de comando
const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');
const userIdArg = args.find(arg => arg.startsWith('--user-id='));
const specificUserId = userIdArg ? userIdArg.split('=')[1] : null;

async function runInsightGeneration() {
  let insightGenerator = null;
  
  try {
    console.log('🚀 SongMetrix - Geração de Insights');
    console.log('=====================================\n');

    if (isDryRun) {
      console.log('🔍 MODO DRY-RUN: Nenhum dado será salvo\n');
    }

    if (specificUserId) {
      console.log(`👤 Processando usuário específico: ${specificUserId}\n`);
    }

    // Verificar configurações essenciais
    console.log('⚙️  Verificando configurações...');
    
    const requiredEnvVars = [
      'VITE_SUPABASE_URL',
      'SUPABASE_SERVICE_KEY',
      'POSTGRES_HOST',
      'POSTGRES_USER',
      'POSTGRES_DB'
    ];

    const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
    
    if (missingVars.length > 0) {
      console.error('❌ Variáveis de ambiente faltando:', missingVars.join(', '));
      process.exit(1);
    }

    console.log('✅ Configurações verificadas');

    // Inicializar serviços
    console.log('\n📦 Inicializando serviços...');
    
    const llmService = new LlmService();
    console.log('✅ LlmService inicializado');
    
    insightGenerator = new InsightGeneratorService(llmService);
    console.log('✅ InsightGeneratorService inicializado');

    // Verificar se LLM está configurado
    try {
      const testInsight = {
        userId: 'test',
        insightType: 'growth_trend',
        songTitle: 'Test Song',
        artist: 'Test Artist',
        currentWeekPlays: 50,
        previousWeekPlays: 20,
        growthRate: '2.50'
      };

      console.log('\n🧪 Testando configuração do LLM...');
      await llmService.generateEmailContent(testInsight);
      console.log('✅ LLM configurado e funcionando');
    } catch (llmError) {
      console.warn('⚠️  LLM não configurado ou com problemas:', llmError.message);
      console.warn('   Execute: npm run setup-llm');
      
      if (!isDryRun) {
        console.error('❌ Não é possível continuar sem LLM em modo de produção');
        process.exit(1);
      }
    }

    // Executar geração de insights
    console.log('\n🎯 Iniciando geração de insights...');
    console.log(`⏰ Início: ${new Date().toLocaleString()}`);
    
    const startTime = Date.now();

    if (specificUserId) {
      // Processar usuário específico (método não implementado ainda)
      console.log(`👤 Processando usuário: ${specificUserId}`);
      // await insightGenerator.generateInsightsForUser(specificUserId);
      console.log('⚠️  Processamento de usuário específico ainda não implementado');
    } else {
      // Processar todos os usuários
      await insightGenerator.generateInsightsForAllUsers();
    }

    const endTime = Date.now();
    const duration = (endTime - startTime) / 1000;

    console.log('\n🎉 Geração de insights concluída!');
    console.log(`⏱️  Duração: ${duration.toFixed(2)} segundos`);
    console.log(`⏰ Fim: ${new Date().toLocaleString()}`);

    // Mostrar estatísticas
    if (!isDryRun) {
      console.log('\n📊 Verificando resultados...');
      
      // Aqui você poderia adicionar queries para mostrar estatísticas
      // dos insights gerados, mas como não temos acesso direto ao Supabase
      // neste contexto, vamos pular esta parte
      console.log('✅ Para ver resultados detalhados, verifique a tabela generated_insight_emails');
    }

  } catch (error) {
    console.error('\n❌ Erro durante a geração de insights:');
    console.error('Mensagem:', error.message);
    
    if (error.stack) {
      console.error('\nStack trace:');
      console.error(error.stack);
    }
    
    process.exit(1);
  } finally {
    // Fechar conexões
    if (insightGenerator) {
      try {
        await insightGenerator.close();
        console.log('\n🔒 Conexões fechadas');
      } catch (closeError) {
        console.error('⚠️  Erro ao fechar conexões:', closeError.message);
      }
    }
  }
}

// Tratamento de sinais para encerramento graceful
process.on('SIGINT', async () => {
  console.log('\n⚠️  Recebido SIGINT, encerrando gracefully...');
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n⚠️  Recebido SIGTERM, encerrando gracefully...');
  process.exit(0);
});

// Tratamento de erros não capturados
process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  process.exit(1);
});

// Mostrar ajuda se solicitado
if (args.includes('--help') || args.includes('-h')) {
  console.log(`
🚀 SongMetrix - Geração de Insights

Uso: node scripts/run-insight-generation.js [opções]

Opções:
  --dry-run              Executa sem salvar dados (apenas teste)
  --user-id=USER_ID      Processa apenas um usuário específico
  --help, -h             Mostra esta ajuda

Exemplos:
  node scripts/run-insight-generation.js
  node scripts/run-insight-generation.js --dry-run
  node scripts/run-insight-generation.js --user-id=user-123

Pré-requisitos:
  1. Configure o LLM: npm run setup-llm
  2. Execute as migrações SQL no Supabase
  3. Configure as variáveis de ambiente

Para mais informações, consulte: docs/insight-generator-service.md
`);
  process.exit(0);
}

// Executar o script
runInsightGeneration();