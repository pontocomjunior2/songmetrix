#!/usr/bin/env node

/**
 * Script para testar a API de drafts especificamente
 */

import { createClient } from '@supabase/supabase-js';
import fetch from 'node-fetch';
import dotenv from 'dotenv';

// Carregar variáveis de ambiente
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;
const API_BASE_URL = process.env.VITE_API_BASE_URL || 'http://localhost:3001';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testDraftsAPI() {
  try {
    console.log('📋 Testando API de drafts...\n');

    // 1. Fazer login
    const { data: loginData, error: loginError } = await supabase.auth.signInWithPassword({
      email: 'admin@songmetrix.com',
      password: 'Admin@@2024'
    });

    if (loginError) {
      console.error('❌ Erro no login:', loginError.message);
      return;
    }

    const token = loginData.session.access_token;

    // 2. Testar API de drafts
    console.log('📡 Chamando API /api/admin/insights/drafts...');
    
    const response = await fetch(`${API_BASE_URL}/api/admin/insights/drafts`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      }
    });

    console.log(`Status: ${response.status}`);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Erro na API:', errorText);
      return;
    }

    const data = await response.json();
    console.log(`✅ API funcionando! Total de drafts: ${data.count || 0}`);

    if (data.drafts && data.drafts.length > 0) {
      console.log('\n📋 Drafts retornados pela API:');
      
      // Separar por tipo
      const customInsights = data.drafts.filter(d => d.insight_type === 'custom_insight');
      const autoInsights = data.drafts.filter(d => d.insight_type !== 'custom_insight');

      console.log(`🎯 Insights personalizados: ${customInsights.length}`);
      console.log(`🤖 Insights automáticos: ${autoInsights.length}`);

      if (customInsights.length > 0) {
        console.log('\n✅ Insights personalizados encontrados:');
        customInsights.forEach((insight, index) => {
          console.log(`${index + 1}. ${insight.subject || insight.email_subject}`);
          console.log(`   Para: ${insight.users?.email}`);
          console.log(`   Tipo: ${insight.insight_type}`);
          console.log(`   Status: ${insight.status}`);
          console.log(`   ID: ${insight.id}`);
          console.log(`   Criado: ${new Date(insight.created_at).toLocaleString('pt-BR')}`);
        });
      } else {
        console.log('⚠️  Nenhum insight personalizado retornado pela API');
      }

      // Mostrar alguns automáticos para comparação
      if (autoInsights.length > 0) {
        console.log('\n🤖 Primeiros insights automáticos:');
        autoInsights.slice(0, 2).forEach((insight, index) => {
          console.log(`${index + 1}. ${insight.subject || insight.email_subject}`);
          console.log(`   Para: ${insight.users?.email}`);
          console.log(`   Tipo: ${insight.insight_type}`);
        });
      }
    } else {
      console.log('📭 Nenhum draft retornado pela API');
    }

    // 3. Fazer logout
    await supabase.auth.signOut();

  } catch (error) {
    console.error('💥 Erro no teste:', error.message);
  }
}

// Executar teste
testDraftsAPI().then(() => {
  console.log('\n🏁 Teste da API de drafts concluído!');
  process.exit(0);
}).catch(error => {
  console.error('💥 Erro fatal:', error);
  process.exit(1);
});