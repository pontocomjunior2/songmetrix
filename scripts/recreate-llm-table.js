/**
 * Script para recriar completamente a tabela llm_provider_settings
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

async function recreateLlmTable() {
  try {
    console.log('🔧 Recriando tabela llm_provider_settings...\n');

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

    console.log('🗑️  Removendo tabela existente...');

    // Remover tabela existente e recriar
    const recreateResult = await supabase.rpc('exec_sql', {
      sql_query: `
        -- Remover tabela existente
        DROP TABLE IF EXISTS llm_provider_settings CASCADE;
        
        -- Criar nova tabela com estrutura completa
        CREATE TABLE llm_provider_settings (
            id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
            provider_name VARCHAR(50) NOT NULL,
            api_key TEXT NOT NULL,
            api_url TEXT NOT NULL,
            model_name VARCHAR(100) NOT NULL,
            max_tokens INTEGER DEFAULT 1000,
            temperature DECIMAL(3,2) DEFAULT 0.7,
            is_active BOOLEAN DEFAULT false,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
        
        -- Inserir configuração padrão do OpenAI
        INSERT INTO llm_provider_settings (
            provider_name, 
            api_key, 
            api_url, 
            model_name, 
            max_tokens, 
            temperature, 
            is_active
        ) VALUES (
            'openai',
            '${process.env.OPENAI_API_KEY || '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'}',
            'https://api.openai.com/v1/chat/completions',
            'gpt-3.5-turbo',
            1000,
            0.7,
            true
        );
      `
    });

    if (recreateResult.error) {
      console.error('❌ Erro ao recriar tabela:', recreateResult.error);
      return;
    }

    console.log('✅ Tabela recriada com sucesso!');

    // Aguardar um pouco para o cache atualizar
    console.log('⏳ Aguardando cache atualizar...');
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Verificar o resultado
    const { data: finalCheck, error: finalError } = await supabase
      .from('llm_provider_settings')
      .select('*');

    if (finalError) {
      console.error('❌ Erro na verificação final:', finalError);
      
      // Tentar novamente após mais tempo
      console.log('🔄 Tentando novamente após aguardar...');
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      const { data: retryCheck, error: retryError } = await supabase
        .from('llm_provider_settings')
        .select('*');
        
      if (retryError) {
        console.error('❌ Erro na segunda tentativa:', retryError);
        return;
      }
      
      console.log('✅ Dados encontrados na segunda tentativa:', retryCheck);
    } else {
      console.log('✅ Verificação final - Registros encontrados:', finalCheck.length);
      if (finalCheck.length > 0) {
        const provider = finalCheck[0];
        console.log('\n📋 Configuração do provedor:');
        console.log(`   - ID: ${provider.id}`);
        console.log(`   - Provider: ${provider.provider_name}`);
        console.log(`   - Model: ${provider.model_name}`);
        console.log(`   - API URL: ${provider.api_url}`);
        console.log(`   - Max Tokens: ${provider.max_tokens}`);
        console.log(`   - Temperature: ${provider.temperature}`);
        console.log(`   - Is Active: ${provider.is_active}`);
      }
    }

    console.log('\n🎉 Recriação da tabela LLM concluída!');

  } catch (error) {
    console.error('❌ Erro geral:', error.message);
    console.error('Stack:', error.stack);
  }
}

// Executar recriação
recreateLlmTable();