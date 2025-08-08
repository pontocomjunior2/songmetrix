#!/usr/bin/env node

/**
 * Script para testar autenticação do Supabase
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fetch from 'node-fetch';

// Carregar variáveis de ambiente
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;
const API_BASE_URL = process.env.VITE_API_BASE_URL || 'http://localhost:3001';

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ Variáveis do Supabase não configuradas');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testSupabaseAuth() {
  try {
    console.log('🔐 Testando autenticação do Supabase...\n');

    // 1. Tentar fazer login
    console.log('1️⃣ Fazendo login no Supabase...');
    const { data: loginData, error: loginError } = await supabase.auth.signInWithPassword({
      email: 'admin@songmetrix.com',
      password: 'Admin@@2024'
    });

    if (loginError) {
      console.error('❌ Erro no login:', loginError.message);
      return;
    }

    console.log('✅ Login bem-sucedido!');
    console.log('Usuário:', loginData.user?.email);
    console.log('Token disponível:', !!loginData.session?.access_token);

    if (!loginData.session?.access_token) {
      console.error('❌ Token não disponível');
      return;
    }

    const token = loginData.session.access_token;
    console.log(`Token (primeiros 30 chars): ${token.substring(0, 30)}...`);

    // 2. Testar token com a API
    console.log('\n2️⃣ Testando token com a API...');
    
    const testResponse = await fetch(`${API_BASE_URL}/api/admin/insights/drafts`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      }
    });

    console.log(`Status da API: ${testResponse.status}`);

    if (testResponse.ok) {
      const data = await testResponse.json();
      console.log(`✅ API funcionando! Drafts: ${data.count || 0}`);
    } else {
      const errorText = await testResponse.text();
      console.log('❌ Erro na API:', errorText);
    }

    // 3. Testar rota de insights personalizados
    console.log('\n3️⃣ Testando insights personalizados...');
    
    const customPayload = {
      targetType: 'user',
      targetId: '59ad79e3-9510-440c-bfc2-d10f48c8e276',
      subject: 'Teste Supabase Auth',
      customPrompt: 'Olá {user_name}! Este é um teste de autenticação.',
      variables: ['user_name']
    };

    const customResponse = await fetch(`${API_BASE_URL}/api/admin/insights/generate-custom`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(customPayload)
    });

    console.log(`Status do insight personalizado: ${customResponse.status}`);
    
    const customResponseText = await customResponse.text();
    console.log('Resposta:', customResponseText);

    if (customResponse.ok) {
      console.log('✅ Insight personalizado funcionando!');
    } else {
      console.log('❌ Erro no insight personalizado');
    }

    // 4. Fazer logout
    await supabase.auth.signOut();
    console.log('\n4️⃣ Logout realizado');

  } catch (error) {
    console.error('💥 Erro no teste:', error.message);
  }
}

// Executar teste
testSupabaseAuth().then(() => {
  console.log('\n🏁 Teste concluído!');
  process.exit(0);
}).catch(error => {
  console.error('💥 Erro fatal:', error);
  process.exit(1);
});