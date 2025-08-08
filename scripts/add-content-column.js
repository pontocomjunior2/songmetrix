/**
 * Script para adicionar a coluna 'content' na tabela generated_insight_emails
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

async function addContentColumn() {
  try {
    console.log('🔧 Adicionando coluna content na tabela generated_insight_emails...\n');

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

    console.log('📝 Executando SQL para adicionar coluna content...');

    // Adicionar coluna content
    const { data, error } = await supabase.rpc('exec_sql', {
      sql_query: `
        ALTER TABLE generated_insight_emails 
        ADD COLUMN IF NOT EXISTS content TEXT;
      `
    });

    if (error) {
      console.error('❌ Erro ao executar SQL:', error);
      return;
    }

    console.log('✅ Coluna content adicionada com sucesso!');

    // Verificar se a coluna foi criada
    const { data: tableInfo, error: checkError } = await supabase
      .from('generated_insight_emails')
      .select('*')
      .limit(1);

    if (checkError) {
      console.error('❌ Erro ao verificar tabela:', checkError);
    } else {
      console.log('✅ Verificação da tabela bem-sucedida');
    }

    console.log('\n🎉 Coluna content adicionada com sucesso!');

  } catch (error) {
    console.error('❌ Erro geral:', error.message);
    console.error('Stack:', error.stack);
  }
}

// Executar adição da coluna
addContentColumn();