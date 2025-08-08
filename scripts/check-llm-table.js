/**
 * Script para verificar a estrutura da tabela llm_provider_settings
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

async function checkLlmTable() {
  try {
    console.log('🔍 Verificando estrutura da tabela llm_provider_settings...\n');

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

    // Tentar buscar dados da tabela para ver que colunas existem
    console.log('📋 Tentando buscar dados da tabela...');
    
    const { data, error } = await supabase
      .from('llm_provider_settings')
      .select('*')
      .limit(1);

    if (error) {
      console.error('❌ Erro ao buscar dados:', error);
      
      // Tentar criar a tabela do zero
      console.log('\n🔧 Tentando criar tabela do zero...');
      
      const createResult = await supabase.rpc('exec_sql', {
        sql_query: `
          DROP TABLE IF EXISTS llm_provider_settings;
          
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
              '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',
              'https://api.openai.com/v1/chat/completions',
              'gpt-3.5-turbo',
              1000,
              0.7,
              true
          );
        `
      });

      if (createResult.error) {
        console.error('❌ Erro ao criar tabela:', createResult.error);
        return;
      }

      console.log('✅ Tabela criada e configurada com sucesso!');
    } else {
      console.log('✅ Tabela encontrada!');
      console.log('📊 Dados existentes:', data);
    }

    // Verificar novamente
    const { data: finalCheck, error: finalError } = await supabase
      .from('llm_provider_settings')
      .select('*');

    if (finalError) {
      console.error('❌ Erro na verificação final:', finalError);
    } else {
      console.log('\n✅ Verificação final - Registros encontrados:', finalCheck.length);
      if (finalCheck.length > 0) {
        console.log('📋 Primeiro registro:', finalCheck[0]);
      }
    }

    console.log('\n🎉 Verificação concluída!');

  } catch (error) {
    console.error('❌ Erro geral:', error.message);
    console.error('Stack:', error.stack);
  }
}

// Executar verificação
checkLlmTable();