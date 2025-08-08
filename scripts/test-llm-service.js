import { createClient } from '@supabase/supabase-js';
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

async function testLlmService() {
  try {
    console.log('🧪 Teste do Serviço LLM - SongMetrix\n');

    // Importar o serviço LLM
    const { LlmService } = await import('../server/services/llmService.js');
    const llmService = new LlmService();

    // Dados de teste para diferentes tipos de insight
    const testCases = [
      {
        name: 'Growth Trend',
        data: {
          userId: 'test-user-1',
          insightType: 'growth_trend',
          metrics: {
            totalPlays: 250,
            topArtist: 'Anitta',
            topSong: 'Envolver',
            songArtist: 'Anitta',
            artistPlays: 45,
            songPlays: 12,
            uniqueArtists: 35,
            uniqueSongs: 120,
            uniqueRadios: 8,
            growthPercentage: 35
          }
        }
      },
      {
        name: 'Artist Focus',
        data: {
          userId: 'test-user-2',
          insightType: 'artist_focus',
          metrics: {
            totalPlays: 180,
            topArtist: 'Jorge & Mateus',
            topSong: 'Pode Chorar',
            songArtist: 'Jorge & Mateus',
            artistPlays: 85,
            songPlays: 25,
            uniqueArtists: 15,
            uniqueSongs: 60,
            uniqueRadios: 5,
            growthPercentage: 12
          }
        }
      },
      {
        name: 'Music Diversity',
        data: {
          userId: 'test-user-3',
          insightType: 'music_diversity',
          metrics: {
            totalPlays: 320,
            topArtist: 'Diversos',
            topSong: 'Mix Variado',
            songArtist: 'Vários',
            artistPlays: 15,
            songPlays: 8,
            uniqueArtists: 85,
            uniqueSongs: 280,
            uniqueRadios: 12,
            growthPercentage: 8
          }
        }
      }
    ];

    console.log(`🎯 Executando ${testCases.length} casos de teste...\n`);

    for (let i = 0; i < testCases.length; i++) {
      const testCase = testCases[i];
      console.log(`📊 Teste ${i + 1}: ${testCase.name}`);
      console.log(`   Dados: ${testCase.data.metrics.totalPlays} plays, ${testCase.data.metrics.uniqueArtists} artistas`);
      
      try {
        const startTime = Date.now();
        const result = await llmService.generateEmailContent(testCase.data);
        const endTime = Date.now();
        
        console.log(`   ✅ Sucesso (${endTime - startTime}ms)`);
        console.log(`   📧 Assunto: "${result.subject}"`);
        console.log(`   📝 Tamanho HTML: ${result.body_html.length} caracteres`);
        
        // Validar estrutura da resposta
        if (!result.subject || !result.body_html) {
          console.log(`   ⚠️  Aviso: Resposta incompleta`);
        }
        
        // Verificar se é HTML válido (básico)
        if (!result.body_html.includes('<') || !result.body_html.includes('>')) {
          console.log(`   ⚠️  Aviso: Conteúdo pode não ser HTML válido`);
        }
        
        console.log(`   📄 Preview do HTML:`);
        console.log(`   ${result.body_html.substring(0, 150)}...`);
        
      } catch (error) {
        console.log(`   ❌ Erro: ${error.message}`);
      }
      
      console.log(''); // Linha em branco
      
      // Aguardar um pouco entre as chamadas para não sobrecarregar a API
      if (i < testCases.length - 1) {
        console.log('   ⏳ Aguardando 2 segundos...\n');
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    console.log('🎉 Testes concluídos!');
    console.log('\n💡 Dicas:');
    console.log('   - Se todos os testes passaram, o serviço está funcionando corretamente');
    console.log('   - Verifique os logs para mais detalhes sobre cada chamada');
    console.log('   - Para configurar um novo provedor, use: npm run setup-llm');

  } catch (error) {
    console.error('❌ Erro inesperado no teste:', error);
    console.error('Stack:', error.stack);
  }
}

// Executar o teste
testLlmService();