#!/usr/bin/env node

/**
 * Script para testar as rotas melhoradas de insights
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

async function testImprovedRoutes() {
  try {
    console.log('🧪 Testando rotas melhoradas de insights...\n');

    // 1. Fazer login
    console.log('1️⃣ Fazendo login...');
    const { data: loginData, error: loginError } = await supabase.auth.signInWithPassword({
      email: 'admin@songmetrix.com',
      password: 'Admin@@2024'
    });

    if (loginError) {
      console.error('❌ Erro no login:', loginError.message);
      return;
    }

    const token = loginData.session.access_token;
    console.log('✅ Login bem-sucedido!');

    // 2. Testar validação de UUID inválido
    console.log('\n2️⃣ Testando validação de UUID inválido...');
    const invalidUuidResponse = await fetch(`${API_BASE_URL}/api/admin/insights/invalid-uuid/approve`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      }
    });

    console.log(`Status UUID inválido: ${invalidUuidResponse.status}`);
    if (invalidUuidResponse.status === 400) {
      const errorData = await invalidUuidResponse.json();
      console.log('✅ Validação de UUID funcionando:', errorData.code);
    } else {
      console.log('⚠️  Validação de UUID não funcionou como esperado');
    }

    // 3. Buscar um insight real para testar
    console.log('\n3️⃣ Buscando insight para teste...');
    const { data: insights, error: fetchError } = await supabaseAdmin
      .from('generated_insight_emails')
      .select('*')
      .eq('status', 'draft')
      .limit(1);

    let testInsightId;
    if (!insights || insights.length === 0) {
      console.log('⚠️  Nenhum insight draft encontrado. Criando um...');
      
      const { data: newInsight, error: createError } = await supabaseAdmin
        .from('generated_insight_emails')
        .insert({
          user_id: '59ad79e3-9510-440c-bfc2-d10f48c8e276',
          insight_type: 'custom_insight',
          subject: 'Teste Rotas Melhoradas',
          body_html: '<p>Teste das rotas melhoradas</p>',
          content: '<p>Teste das rotas melhoradas</p>',
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

      testInsightId = newInsight.id;
      console.log('✅ Insight de teste criado:', testInsightId);
    } else {
      testInsightId = insights[0].id;
      console.log('✅ Usando insight existente:', testInsightId);
    }

    // 4. Testar aprovação melhorada
    console.log('\n4️⃣ Testando aprovação melhorada...');
    const approveResponse = await fetch(`${API_BASE_URL}/api/admin/insights/${testInsightId}/approve`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      }
    });

    console.log(`Status da aprovação: ${approveResponse.status}`);
    const approveData = await approveResponse.json();
    console.log('Resposta da aprovação:', approveData.message);
    
    if (approveResponse.ok) {
      console.log('✅ Aprovação melhorada funcionando!');
    }

    // 5. Testar aprovação dupla (deve retornar "já aprovado")
    console.log('\n5️⃣ Testando aprovação dupla...');
    const doubleApproveResponse = await fetch(`${API_BASE_URL}/api/admin/insights/${testInsightId}/approve`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      }
    });

    const doubleApproveData = await doubleApproveResponse.json();
    console.log(`Status aprovação dupla: ${doubleApproveResponse.status}`);
    console.log('Resposta:', doubleApproveData.message);
    
    if (doubleApproveData.status === 'already_approved') {
      console.log('✅ Detecção de aprovação dupla funcionando!');
    }

    // 6. Testar envio melhorado
    console.log('\n6️⃣ Testando envio melhorado...');
    const sendResponse = await fetch(`${API_BASE_URL}/api/admin/insights/${testInsightId}/send`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      }
    });

    console.log(`Status do envio: ${sendResponse.status}`);
    const sendData = await sendResponse.json();
    console.log('Resposta do envio:', sendData.message);
    
    if (sendResponse.ok) {
      console.log('✅ Envio melhorado funcionando!');
      console.log('Destinatário:', sendData.recipient);
    }

    // 7. Testar envio duplo (deve retornar "já enviado")
    console.log('\n7️⃣ Testando envio duplo...');
    const doubleSendResponse = await fetch(`${API_BASE_URL}/api/admin/insights/${testInsightId}/send`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      }
    });

    const doubleSendData = await doubleSendResponse.json();
    console.log(`Status envio duplo: ${doubleSendResponse.status}`);
    console.log('Resposta:', doubleSendData.message);
    
    if (doubleSendData.status === 'already_sent') {
      console.log('✅ Detecção de envio duplo funcionando!');
    }

    // 8. Testar insight inexistente
    console.log('\n8️⃣ Testando insight inexistente...');
    const fakeUuid = '00000000-0000-0000-0000-000000000000';
    const notFoundResponse = await fetch(`${API_BASE_URL}/api/admin/insights/${fakeUuid}/approve`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      }
    });

    console.log(`Status insight inexistente: ${notFoundResponse.status}`);
    if (notFoundResponse.status === 404) {
      const notFoundData = await notFoundResponse.json();
      console.log('✅ Detecção de insight inexistente funcionando:', notFoundData.code);
    }

    // 9. Logout
    console.log('\n9️⃣ Logout realizado');
    await supabase.auth.signOut();

  } catch (error) {
    console.error('💥 Erro no teste:', error.message);
    console.error('Stack:', error.stack);
  }
}

// Executar teste
testImprovedRoutes().then(() => {
  console.log('\n🏁 Teste das rotas melhoradas concluído!');
  process.exit(0);
}).catch(error => {
  console.error('💥 Erro fatal:', error);
  process.exit(1);
});