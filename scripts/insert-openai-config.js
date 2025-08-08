/**
 * Script para inserir configuração do OpenAI
 */

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

async function insertOpenAiConfig() {
  try {
    console.log('🤖 Inserindo configuração do OpenAI...\n');

    // Configurar Supabase
    const supabaseUrl = process.env.VITE_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('❌ Variáveis de ambiente do Supabase não configuradas');
      return;
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    // Primeiro, desativar qualquer provedor existente
    await supabase
      .from('llm_provider_settings')
      .update({ is_active: false })
      .neq('id', '00000000-0000-0000-0000-000000000000'); // Update all

    // Inserir nova configuração do OpenAI
    const { data: insertData, error: insertError } = await supabase
      .from('llm_provider_settings')
      .insert({
        provider_name: 'openai',
        api_key: process.env.OPENAI_API_KEY || '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',
        api_url: 'https://api.openai.com/v1/chat/completions',
        model_name: 'gpt-3.5-turbo',
        max_tokens: 1000,
        temperature: 0.7,
        is_active: true
      })
      .select();

    if (insertError) {
      console.error('❌ Erro ao inserir configuração:', insertError);
      return;
    }

    console.log('✅ Configuração do OpenAI inserida com sucesso!');
    console.log('📋 Dados inseridos:', insertData[0]);

    // Verificar se a configuração está ativa
    const { data: activeProvider, error: checkError } = await supabase
      .from('llm_provider_settings')
      .select('*')
      .eq('is_active', true)
      .single();

    if (checkError) {
      console.error('❌ Erro ao verificar configuração ativa:', checkError);
      return;
    }

    console.log('\n✅ Provedor ativo confirmado:');
    console.log(`   - ID: ${activeProvider.id}`);
    console.log(`   - Provider: ${activeProvider.provider_name}`);
    console.log(`   - Model: ${activeProvider.model_name}`);
    console.log(`   - API URL: ${activeProvider.api_url}`);
    console.log(`   - Max Tokens: ${activeProvider.max_tokens}`);
    console.log(`   - Temperature: ${activeProvider.temperature}`);

    console.log('\n🎉 Configuração do OpenAI concluída!');

  } catch (error) {
    console.error('❌ Erro geral:', error.message);
    console.error('Stack:', error.stack);
  }
}

// Executar inserção
insertOpenAiConfig();