#!/usr/bin/env node

/**
 * Script para debugar especificamente a rota de envio
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

async function debugSendRoute() {
  try {
    console.log('🔍 Debugando rota de envio...\n');

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

    // 2. Buscar um insight aprovado para testar
    console.log('📋 Buscando insight aprovado para teste...');
    
    const { data: insights, error: fetchError } = await supabaseAdmin
      .from('generated_insight_emails')
      .select(`
        *,
        users (
          email,
          full_name
        )
      `)
      .eq('status', 'approved')
      .limit(1);

    let testInsightId;
    if (!insights || insights.length === 0) {
      console.log('⚠️  Nenhum insight aprovado encontrado. Criando e aprovando um...');
      
      // Criar um insight de teste
      const { data: newInsight, error: createError } = await supabaseAdmin
        .from('generated_insight_emails')
        .insert({
          user_id: '59ad79e3-9510-440c-bfc2-d10f48c8e276',
          insight_type: 'custom_insight',
          subject: 'Teste Debug Envio',
          body_html: '<p>Teste de envio de e-mail</p>',
          content: '<p>Teste de envio de e-mail</p>',
          status: 'approved',
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

      testInsightId = newInsight.id;
      console.log('✅ Insight de teste criado e aprovado:', testInsightId);
    } else {
      testInsightId = insights[0].id;
      console.log('✅ Usando insight aprovado existente:', testInsightId);
      console.log('   Destinatário:', insights[0].users?.email);
    }

    // 3. Testar envio via API com logs detalhados
    console.log('\n📡 Testando envio via API...');
    
    try {
      const sendResponse = await fetch(`${API_BASE_URL}/api/admin/insights/${testInsightId}/send`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        }
      });

      console.log(`Status do envio: ${sendResponse.status}`);
      console.log('Headers da resposta:', Object.fromEntries(sendResponse.headers.entries()));
      
      const responseText = await sendResponse.text();
      console.log('Resposta bruta:', responseText);

      if (sendResponse.ok) {
        try {
          const responseData = JSON.parse(responseText);
          console.log('✅ Envio via API funcionou!');
          console.log('Dados da resposta:', responseData);
        } catch (parseError) {
          console.log('⚠️  Resposta não é JSON válido');
        }
      } else {
        console.log('❌ Erro na API de envio');
        try {
          const errorData = JSON.parse(responseText);
          console.log('Dados do erro:', errorData);
        } catch (parseError) {
          console.log('Erro não é JSON válido');
        }
      }

    } catch (fetchError) {
      console.error('💥 Erro na requisição:', fetchError.message);
    }

    // 4. Verificar status no banco após tentativa
    console.log('\n🔍 Verificando status no banco...');
    const { data: updatedInsight, error: checkError } = await supabaseAdmin
      .from('generated_insight_emails')
      .select('status, updated_at')
      .eq('id', testInsightId)
      .single();

    if (checkError) {
      console.error('❌ Erro ao verificar status:', checkError.message);
    } else {
      console.log('Status atual:', updatedInsight.status);
      console.log('Última atualização:', updatedInsight.updated_at);
    }

    // 5. Fazer logout
    await supabase.auth.signOut();

  } catch (error) {
    console.error('💥 Erro no debug:', error.message);
    console.error('Stack:', error.stack);
  }
}

// Executar debug
debugSendRoute().then(() => {
  console.log('\n🏁 Debug do envio concluído!');
  process.exit(0);
}).catch(error => {
  console.error('💥 Erro fatal:', error);
  process.exit(1);
});