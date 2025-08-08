#!/usr/bin/env node

/**
 * Script para debugar problemas de autenticação nos insights personalizados
 */

import fetch from 'node-fetch';
import dotenv from 'dotenv';

// Carregar variáveis de ambiente
dotenv.config();

const API_BASE_URL = process.env.VITE_API_BASE_URL || 'http://localhost:3001';

async function debugAuth() {
  try {
    console.log('🔐 Debugando autenticação para insights personalizados...\n');

    // 1. Tentar fazer login
    console.log('1️⃣ Tentando fazer login...');
    const loginResponse = await fetch(`${API_BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: 'admin@songmetrix.com.br',
        password: 'admin123'
      })
    });

    console.log(`Status do login: ${loginResponse.status}`);

    if (!loginResponse.ok) {
      const loginError = await loginResponse.text();
      console.log('❌ Erro no login:', loginError);
      return;
    }

    const loginData = await loginResponse.json();
    console.log('✅ Login bem-sucedido!');
    console.log('Token recebido:', loginData.access_token ? 'SIM' : 'NÃO');

    if (!loginData.access_token) {
      console.log('❌ Token não encontrado na resposta do login');
      return;
    }

    const token = loginData.access_token;
    console.log(`Token (primeiros 20 chars): ${token.substring(0, 20)}...`);

    // 2. Testar rota de drafts (que sabemos que funciona)
    console.log('\n2️⃣ Testando rota de drafts...');
    const draftsResponse = await fetch(`${API_BASE_URL}/api/admin/insights/drafts`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      }
    });

    console.log(`Status dos drafts: ${draftsResponse.status}`);

    if (draftsResponse.ok) {
      const draftsData = await draftsResponse.json();
      console.log(`✅ Drafts funcionando! Encontrados: ${draftsData.count || 0} rascunhos`);
    } else {
      const draftsError = await draftsResponse.text();
      console.log('❌ Erro nos drafts:', draftsError);
      return;
    }

    // 3. Testar rota de insights personalizados
    console.log('\n3️⃣ Testando rota de insights personalizados...');
    
    const customPayload = {
      targetType: 'user',
      targetId: '59ad79e3-9510-440c-bfc2-d10f48c8e276',
      subject: 'Teste Debug',
      customPrompt: 'Olá {user_name}! Este é um teste.',
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
    console.log('Resposta completa:', customResponseText);

    if (customResponse.ok) {
      console.log('✅ Insight personalizado funcionando!');
      const customData = JSON.parse(customResponseText);
      console.log('Dados:', customData);
    } else {
      console.log('❌ Erro no insight personalizado');
      
      if (customResponse.status === 401) {
        console.log('🔐 Problema de autenticação - token pode estar inválido');
      } else if (customResponse.status === 500) {
        console.log('💥 Erro interno do servidor - verifique logs do backend');
      }
    }

    // 4. Aguardar e verificar se foi salvo
    console.log('\n4️⃣ Aguardando 10 segundos e verificando banco...');
    await new Promise(resolve => setTimeout(resolve, 10000));

    // Verificar novamente no banco
    console.log('Verificando banco novamente...');
    // Aqui você pode executar o script de verificação do banco

  } catch (error) {
    console.error('💥 Erro no debug:', error.message);
  }
}

// Executar debug
debugAuth().then(() => {
  console.log('\n🏁 Debug concluído!');
}).catch(error => {
  console.error('💥 Erro fatal:', error);
});