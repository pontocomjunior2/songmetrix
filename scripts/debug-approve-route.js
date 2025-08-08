#!/usr/bin/env node

/**
 * Script para debugar especificamente a rota de aprovação
 */

import { createClient } from '@supabase/supabase-js';
import fetch from 'node-fetch';
import dotenv from 'dotenv';

// Carregar variáveis de ambiente
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
const API_BASE_URL = process.env.VITE_API_BASE_URL || 'http://localhost:3001';

const supabase = createClient(supabaseUrl, supabaseAnonKey);
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function debugApproveRoute() {
  try {
    console.log('🔍 Debugando rota de aprovação...\n');

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

    // 2. Buscar um insight de teste
    console.log('📋 Buscando insights de teste...');
    
    const { data: insights, error: fetchError } = await supabaseAdmin
      .from('generated_insight_emails')
      .select('*')
      .eq('insight_type', 'custom_insight')
      .eq('status', 'draft')
      .limit(1);

    if (fetchError || !insights || insights.length === 0) {
      console.log('⚠️  Nenhum insight de teste encontrado. Criando um...');
      
      // Criar um insight de teste
      const { data: newInsight, error: createError } = await supabaseAdmin
        .from('generated_insight_emails')
        .insert({
          user_id: '59ad79e3-9510-440c-bfc2-d10f48c8e276',
          insight_type: 'custom_insight',
          subject: 'Teste Debug Aprovação',
          body_html: '<p>Teste de aprovação</p>',
          content: '<p>Teste de aprovação</p>',
          status: 'draft',
          insight_data: { test: true },
          deep_link: 'https://songmetrix.com.br/dashboard',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select()
        .single();

      if (createError) {
        console.error('❌ Erro ao criar insight de teste:', createError.message);
        return;
      }

      insights.push(newInsight);
      console.log('✅ Insight de teste criado:', newInsight.id);
    }

    const testInsight = insights[0];
    console.log(`📊 Testando com insight: ${testInsight.id}`);
    console.log(`   Status atual: ${testInsight.status}`);

    // 3. Testar aprovação diretamente no banco
    console.log('\n🔧 Testando atualização direta no banco...');
    
    const { data: directUpdate, error: directError } = await supabaseAdmin
      .from('generated_insight_emails')
      .update({ 
        status: 'approved',
        updated_at: new Date().toISOString()
      })
      .eq('id', testInsight.id)
      .select()
      .single();

    if (directError) {
      console.error('❌ Erro na atualização direta:', directError.message);
      console.error('Detalhes:', directError);
    } else {
      console.log('✅ Atualização direta funcionou!');
      console.log('Status atualizado:', directUpdate.status);
    }

    // 4. Testar via API
    console.log('\n📡 Testando via API...');
    
    // Primeiro, voltar para draft
    await supabaseAdmin
      .from('generated_insight_emails')
      .update({ status: 'draft' })
      .eq('id', testInsight.id);

    const approveResponse = await fetch(`${API_BASE_URL}/api/admin/insights/${testInsight.id}/approve`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      }
    });

    console.log(`Status da API: ${approveResponse.status}`);
    
    const responseText = await approveResponse.text();
    console.log('Resposta:', responseText);

    if (approveResponse.ok) {
      console.log('✅ Aprovação via API funcionou!');
    } else {
      console.log('❌ Erro na aprovação via API');
    }

    // 5. Fazer logout
    await supabase.auth.signOut();

  } catch (error) {
    console.error('💥 Erro no debug:', error.message);
    console.error('Stack:', error.stack);
  }
}

// Executar debug
debugApproveRoute().then(() => {
  console.log('\n🏁 Debug da aprovação concluído!');
  process.exit(0);
}).catch(error => {
  console.error('💥 Erro fatal:', error);
  process.exit(1);
});