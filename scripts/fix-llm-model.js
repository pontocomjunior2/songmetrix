#!/usr/bin/env node

/**
 * Script para corrigir o modelo LLM inválido
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Carregar variáveis de ambiente
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Variáveis de ambiente do Supabase não configuradas');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function fixLLMModel() {
  try {
    console.log('🔧 Corrigindo modelo LLM inválido...\n');

    // 1. Encontrar o provedor ativo com modelo inválido
    const { data: activeProvider, error: findError } = await supabase
      .from('llm_provider_settings')
      .select('*')
      .eq('is_active', true)
      .eq('model_name', 'gpt-5')
      .single();

    if (findError) {
      console.error('❌ Erro ao buscar provedor ativo:', findError.message);
      return;
    }

    if (!activeProvider) {
      console.log('ℹ️  Nenhum provedor com modelo gpt-5 encontrado');
      return;
    }

    console.log(`📍 Provedor encontrado: ${activeProvider.provider_name}`);
    console.log(`   Modelo atual: ${activeProvider.model_name} ❌`);
    console.log(`   ID: ${activeProvider.id}`);

    // 2. Atualizar para um modelo válido
    const newModel = 'gpt-4o-mini'; // Modelo válido e eficiente
    
    console.log(`\n🔄 Atualizando modelo para: ${newModel}`);

    const { data: updatedProvider, error: updateError } = await supabase
      .from('llm_provider_settings')
      .update({
        model_name: newModel,
        updated_at: new Date().toISOString()
      })
      .eq('id', activeProvider.id)
      .select()
      .single();

    if (updateError) {
      console.error('❌ Erro ao atualizar provedor:', updateError.message);
      return;
    }

    console.log('✅ Modelo atualizado com sucesso!');
    console.log(`   Novo modelo: ${updatedProvider.model_name}`);
    console.log(`   Provedor: ${updatedProvider.provider_name}`);
    console.log(`   Status: ${updatedProvider.is_active ? 'Ativo' : 'Inativo'}`);

    console.log('\n🎉 Correção concluída! Agora tente gerar o insight personalizado novamente.');

  } catch (error) {
    console.error('💥 Erro ao corrigir modelo LLM:', error.message);
  }
}

// Executar correção
fixLLMModel().then(() => {
  console.log('\n🏁 Correção concluída!');
  process.exit(0);
}).catch(error => {
  console.error('💥 Erro fatal:', error);
  process.exit(1);
});