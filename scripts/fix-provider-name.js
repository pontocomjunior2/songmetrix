/**
 * Script para corrigir o nome do provedor na tabela
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

async function fixProviderName() {
  try {
    console.log('🔧 Corrigindo nome do provedor...\n');

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

    // Atualizar o nome do provedor para a capitalização correta
    const { data: updateData, error: updateError } = await supabase
      .from('llm_provider_settings')
      .update({
        provider_name: 'OpenAI'  // Capitalizado como esperado pelo serviço
      })
      .eq('provider_name', 'openai')  // Buscar pelo nome em minúscula
      .select();

    if (updateError) {
      console.error('❌ Erro ao atualizar nome do provedor:', updateError);
      return;
    }

    if (updateData && updateData.length > 0) {
      console.log('✅ Nome do provedor atualizado com sucesso!');
      console.log('📋 Registro atualizado:', updateData[0]);
    } else {
      console.log('⚠️  Nenhum registro foi atualizado');
    }

    // Verificar o resultado final
    const { data: finalCheck, error: finalError } = await supabase
      .from('llm_provider_settings')
      .select('*')
      .eq('is_active', true);

    if (finalError) {
      console.error('❌ Erro na verificação final:', finalError);
      return;
    }

    console.log('\n✅ Configuração final dos provedores ativos:');
    finalCheck.forEach((provider, index) => {
      console.log(`   ${index + 1}. Provider: ${provider.provider_name}`);
      console.log(`      Model: ${provider.model_name}`);
      console.log(`      API URL: ${provider.api_url}`);
      console.log(`      Is Active: ${provider.is_active}`);
    });

    console.log('\n🎉 Correção do nome do provedor concluída!');

  } catch (error) {
    console.error('❌ Erro geral:', error.message);
    console.error('Stack:', error.stack);
  }
}

// Executar correção
fixProviderName();