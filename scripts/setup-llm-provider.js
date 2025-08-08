import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import readline from 'readline';

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

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Variáveis de ambiente necessárias não encontradas: VITE_SUPABASE_URL ou SUPABASE_SERVICE_KEY');
  process.exit(1);
}

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

// Interface para entrada do usuário
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function askQuestion(question) {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer);
    });
  });
}

async function setupLlmProvider() {
  try {
    console.log('🤖 Configuração de Provedor LLM - SongMetrix\n');

    // Verificar se a tabela existe
    const { data: tableCheck, error: tableError } = await supabaseAdmin
      .from('llm_provider_settings')
      .select('count', { count: 'exact', head: true });

    if (tableError && tableError.code === '42P01') {
      console.log('⚠️  Tabela llm_provider_settings não existe. Execute a migração primeiro:');
      console.log('   Execute o SQL em: supabase/migrations/create_llm_provider_settings_table.sql');
      process.exit(1);
    }

    // Verificar provedores existentes
    const { data: existingProviders, error: listError } = await supabaseAdmin
      .from('llm_provider_settings')
      .select('provider_name, is_active, model_name')
      .order('created_at', { ascending: false });

    if (listError) {
      console.error('❌ Erro ao listar provedores existentes:', listError);
      process.exit(1);
    }

    if (existingProviders && existingProviders.length > 0) {
      console.log('📋 Provedores existentes:');
      existingProviders.forEach((provider, index) => {
        const status = provider.is_active ? '🟢 ATIVO' : '🔴 INATIVO';
        console.log(`   ${index + 1}. ${provider.provider_name} (${provider.model_name}) - ${status}`);
      });
      console.log('');
    }

    // Perguntar qual provedor configurar
    console.log('🔧 Provedores disponíveis:');
    console.log('   1. OpenAI (GPT-4, GPT-3.5)');
    console.log('   2. Anthropic (Claude) - Em breve');
    console.log('   3. Google (Gemini) - Em breve');
    console.log('   4. Azure OpenAI - Em breve');
    console.log('');

    const providerChoice = await askQuestion('Qual provedor deseja configurar? (1-4): ');

    if (providerChoice !== '1') {
      console.log('❌ Apenas OpenAI está disponível no momento.');
      rl.close();
      return;
    }

    // Configurar OpenAI
    console.log('\n🔑 Configuração da OpenAI');
    console.log('Para obter sua API key, visite: https://platform.openai.com/api-keys\n');

    const apiKey = await askQuestion('Digite sua API key da OpenAI: ');
    if (!apiKey || !apiKey.startsWith('sk-')) {
      console.log('❌ API key inválida. Deve começar com "sk-"');
      rl.close();
      return;
    }

    const modelChoice = await askQuestion('Escolha o modelo (1=gpt-4o, 2=gpt-3.5-turbo) [1]: ') || '1';
    const modelName = modelChoice === '2' ? 'gpt-3.5-turbo' : 'gpt-4o';

    const maxTokens = parseInt(await askQuestion('Máximo de tokens [1000]: ') || '1000');
    const temperature = parseFloat(await askQuestion('Temperature (0-2) [0.7]: ') || '0.7');

    const makeActive = await askQuestion('Tornar este provedor ativo? (s/n) [s]: ') || 's';
    const isActive = makeActive.toLowerCase() === 's' || makeActive.toLowerCase() === 'sim';

    console.log('\n⏳ Salvando configuração...');

    // Inserir ou atualizar provedor
    const { data: savedProvider, error: saveError } = await supabaseAdmin
      .from('llm_provider_settings')
      .upsert({
        provider_name: 'OpenAI',
        api_key: apiKey,
        api_url: 'https://api.openai.com/v1/chat/completions',
        model_name: modelName,
        max_tokens: maxTokens,
        temperature: temperature,
        is_active: isActive,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'provider_name'
      })
      .select()
      .single();

    if (saveError) {
      console.error('❌ Erro ao salvar configuração:', saveError);
      rl.close();
      return;
    }

    console.log('✅ Provedor OpenAI configurado com sucesso!');
    console.log(`📊 Modelo: ${modelName}`);
    console.log(`🎯 Max Tokens: ${maxTokens}`);
    console.log(`🌡️  Temperature: ${temperature}`);
    console.log(`🔄 Status: ${isActive ? 'ATIVO' : 'INATIVO'}`);

    if (isActive) {
      console.log('\n🧪 Testando configuração...');
      
      // Testar a configuração
      try {
        const { LlmService } = await import('../src/services/llmService.js');
        const llmService = new LlmService();
        
        const testInsight = {
          userId: 'test-user',
          insightType: 'test',
          metrics: {
            totalPlays: 150,
            topArtist: 'Artista Teste',
            topSong: 'Música Teste',
            growthPercentage: 25
          }
        };

        const result = await llmService.generateEmailContent(testInsight);
        
        console.log('✅ Teste realizado com sucesso!');
        console.log(`📧 Assunto gerado: "${result.subject}"`);
        console.log(`📝 Tamanho do conteúdo: ${result.body_html.length} caracteres`);
        
      } catch (testError) {
        console.log('⚠️  Erro no teste:', testError.message);
        console.log('   A configuração foi salva, mas pode haver problemas na API key.');
      }
    }

    console.log('\n🎉 Configuração concluída!');
    console.log('💡 Para testar o serviço, use: npm run test-llm');

  } catch (error) {
    console.error('❌ Erro inesperado:', error);
  } finally {
    rl.close();
  }
}

// Executar o script
setupLlmProvider();