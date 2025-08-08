/**
 * Script para criar e configurar a tabela llm_provider_settings
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { readFileSync } from 'fs';

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

async function setupLlmTable() {
  try {
    console.log('🔧 Configurando tabela LLM Provider Settings...\n');

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

    // Ler o arquivo SQL
    const sqlPath = path.join(__dirname, 'create-llm-provider-table.sql');
    const sqlContent = readFileSync(sqlPath, 'utf8');

    console.log('📝 Executando SQL para criar tabela...');

    // Executar o SQL
    const { data, error } = await supabase.rpc('exec_sql', {
      sql_query: sqlContent
    });

    if (error) {
      console.error('❌ Erro ao executar SQL:', error);
      
      // Tentar método alternativo - criar tabela manualmente
      console.log('🔄 Tentando método alternativo...');
      
      // Primeiro, tentar criar a tabela
      const createTableResult = await supabase.rpc('exec_sql', {
        sql_query: `
          CREATE TABLE IF NOT EXISTS llm_provider_settings (
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
        `
      });

      if (createTableResult.error) {
        console.error('❌ Erro ao criar tabela:', createTableResult.error);
        return;
      }

      console.log('✅ Tabela criada com sucesso!');

      // Inserir configuração padrão
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
        });

      if (insertError) {
        console.error('❌ Erro ao inserir configuração padrão:', insertError);
        return;
      }

      console.log('✅ Configuração padrão inserida!');
    } else {
      console.log('✅ SQL executado com sucesso!');
    }

    // Verificar se a configuração foi criada
    const { data: providers, error: checkError } = await supabase
      .from('llm_provider_settings')
      .select('*')
      .eq('is_active', true);

    if (checkError) {
      console.error('❌ Erro ao verificar configuração:', checkError);
      return;
    }

    if (providers && providers.length > 0) {
      console.log('✅ Provedor LLM ativo encontrado:');
      console.log(`   - Provider: ${providers[0].provider_name}`);
      console.log(`   - Model: ${providers[0].model_name}`);
      console.log(`   - API URL: ${providers[0].api_url}`);
    } else {
      console.log('⚠️  Nenhum provedor ativo encontrado');
    }

    console.log('\n🎉 Configuração da tabela LLM concluída!');

  } catch (error) {
    console.error('❌ Erro geral:', error.message);
    console.error('Stack:', error.stack);
  }
}

// Executar setup
setupLlmTable();