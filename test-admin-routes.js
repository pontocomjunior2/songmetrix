#!/usr/bin/env node

import fetch from 'node-fetch';

const BASE_URL = 'https://songmetrix.com.br';

async function testRoute(endpoint, method = 'GET', body = null) {
  const url = `${BASE_URL}${endpoint}`;
  const options = {
    method,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer test-token' // Token de teste
    }
  };

  if (body) {
    options.body = JSON.stringify(body);
  }

  try {
    console.log(`\n🔍 Testando: ${method} ${url}`);
    const response = await fetch(url, options);
    console.log(`📊 Status: ${response.status} ${response.statusText}`);
    
    if (response.headers.get('content-type')?.includes('application/json')) {
      const data = await response.text();
      console.log(`📄 Response: ${data.substring(0, 500)}${data.length > 500 ? '...' : ''}`);
    } else {
      console.log(`📄 Response: ${await response.text()}`);
    }
    
    return response.status;
  } catch (error) {
    console.error(`❌ Erro: ${error.message}`);
    return null;
  }
}

async function main() {
  console.log('🚀 Iniciando testes das rotas de admin...\n');
  
  // Testar rotas que estão falhando
  await testRoute('/api/admin/users?limit=1000');
  await testRoute('/api/admin/insights/drafts');
  
  // Testar outras rotas para comparação
  await testRoute('/api/dashboard');
  await testRoute('/api/radios');
  
  console.log('\n✅ Testes concluídos!');
}

main().catch(console.error);
