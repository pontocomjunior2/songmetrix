/**
 * Script para adicionar colunas faltantes na tabela llm_provider_settings
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

async function addMissingColumns() {
  try {
    console.log('🔧 Adicionando colunas faltantes na tabela llm_provider_settings...\n');

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

    console.log('📝 Adicionando colunas faltantes...');

    // Adicionar colunas faltantes
    const alterTableResult = await supabase.rpc('exec_sql', {
      sql_query: `
        -- Adicionar colunas faltantes se não existirem
        DO $$ 
        BEGIN
            -- Adicionar api_url
            IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                          WHERE table_name = 'llm_provider_settings' AND column_name = 'api_url') THEN
                ALTER TABLE llm_provider_settings ADD COLUMN api_url TEXT;
            END IF;
            
            -- Adicionar model_name
            IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                          WHERE table_name = 'llm_provider_settings' AND column_name = 'model_name') THEN
                ALTER TABLE llm_provider_settings ADD COLUMN model_name VARCHAR(100);
            END IF;
            
            -- Adicionar max_tokens
            IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                          WHERE table_name = 'llm_provider_settings' AND column_name = 'max_tokens') THEN
                ALTER TABLE llm_provider_settings ADD COLUMN max_tokens INTEGER DEFAULT 1000;
            END IF;
            
            -- Adicionar temperature
            IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                          WHERE table_name = 'llm_provider_settings' AND column_name = 'temperature') THEN
                ALTER TABLE llm_provider_settings ADD COLUMN temperature DECIMAL(3,2) DEFAULT 0.7;
            END IF;
        END $$;
      `
    });

    if (alterTableResult.error) {
      console.error('❌ Erro ao adicionar colunas:', alterTableResult.error);
      return;
    }

    console.log('✅ Colunas adicionadas com sucesso!');

    // Atualizar o registro existente com os valores padrão
    console.log('📝 Atualizando registro existente...');

    const { data: updateData, error: updateError } = await supabase
      .from('llm_provider_settings')
      .update({
        api_url: 'https://api.openai.com/v1/chat/completions',
        model_name: 'gpt-3.5-turbo',
        max_tokens: 1000,
        temperature: 0.7,
        is_active: true
      })
      .eq('provider_name', 'OpenAI')
      .select();

    if (updateError) {
      console.error('❌ Erro ao atualizar registro:', updateError);
      return;
    }

    console.log('✅ Registro atualizado com sucesso!');

    // Verificar o resultado final
    const { data: finalCheck, error: finalError } = await supabase
      .from('llm_provider_settings')
      .select('*')
      .eq('is_active', true)
      .single();

    if (finalError) {
      console.error('❌ Erro na verificação final:', finalError);
      return;
    }

    console.log('\n✅ Configuração final do provedor ativo:');
    console.log(`   - ID: ${finalCheck.id}`);
    console.log(`   - Provider: ${finalCheck.provider_name}`);
    console.log(`   - Model: ${finalCheck.model_name}`);
    console.log(`   - API URL: ${finalCheck.api_url}`);
    console.log(`   - Max Tokens: ${finalCheck.max_tokens}`);
    console.log(`   - Temperature: ${finalCheck.temperature}`);
    console.log(`   - Is Active: ${finalCheck.is_active}`);

    console.log('\n🎉 Configuração da tabela LLM concluída com sucesso!');

  } catch (error) {
    console.error('❌ Erro geral:', error.message);
    console.error('Stack:', error.stack);
  }
}

// Executar adição de colunas
addMissingColumns();