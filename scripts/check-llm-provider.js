#!/usr/bin/env node

/**
 * Script para verificar provedor LLM ativo
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

async function checkLLMProvider() {
  try {
    console.log('🤖 Verificando provedor LLM ativo...\n');

    // Verificar provedores LLM
    const { data: providers, error: providersError } = await supabase
      .from('llm_provider_settings')
      .select('*')
      .order('created_at', { ascending: false });

    if (providersError) {
      console.error('❌ Erro ao buscar provedores:', providersError.message);
      return;
    }

    console.log(`📊 Total de provedores: ${providers?.length || 0}`);

    if (!providers || providers.length === 0) {
      console.log('⚠️  Nenhum provedor LLM configurado!');
      console.log('💡 Você precisa configurar um provedor em Admin → Configurações dos Provedores de IA');
      return;
    }

    // Mostrar todos os provedores
    console.log('\n📋 Provedores configurados:');
    providers.forEach((provider, index) => {
      console.log(`\n${index + 1}. ${provider.provider_name}`);
      console.log(`   Status: ${provider.is_active ? '✅ ATIVO' : '❌ Inativo'}`);
      console.log(`   Modelo: ${provider.model_name}`);
      console.log(`   API URL: ${provider.api_url}`);
      console.log(`   API Key: ${provider.api_key ? `${provider.api_key.substring(0, 8)}...` : 'Não configurada'}`);
      console.log(`   Criado em: ${new Date(provider.created_at).toLocaleString('pt-BR')}`);
    });

    // Verificar provedor ativo
    const activeProviders = providers.filter(p => p.is_active);
    console.log(`\n🎯 Provedores ativos: ${activeProviders.length}`);

    if (activeProviders.length === 0) {
      console.log('❌ PROBLEMA ENCONTRADO: Nenhum provedor ativo!');
      console.log('💡 Solução: Ative um provedor em Admin → Configurações dos Provedores de IA');
      return;
    }

    if (activeProviders.length > 1) {
      console.log('⚠️  Múltiplos provedores ativos (apenas um deveria estar ativo):');
      activeProviders.forEach(provider => {
        console.log(`   - ${provider.provider_name}`);
      });
    }

    const activeProvider = activeProviders[0];
    console.log(`\n✅ Provedor ativo encontrado: ${activeProvider.provider_name}`);
    console.log(`   Modelo: ${activeProvider.model_name}`);
    console.log(`   Max Tokens: ${activeProvider.max_tokens}`);
    console.log(`   Temperature: ${activeProvider.temperature}`);

    // Verificar se a API key está configurada
    if (!activeProvider.api_key || activeProvider.api_key.trim() === '') {
      console.log('❌ PROBLEMA: API Key não configurada para o provedor ativo!');
      return;
    }

    console.log('✅ Provedor LLM configurado corretamente!');

  } catch (error) {
    console.error('💥 Erro ao verificar provedor LLM:', error.message);
  }
}

// Executar verificação
checkLLMProvider().then(() => {
  console.log('\n🏁 Verificação concluída!');
  process.exit(0);
}).catch(error => {
  console.error('💥 Erro fatal:', error);
  process.exit(1);
});