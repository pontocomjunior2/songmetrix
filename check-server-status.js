#!/usr/bin/env node

import fetch from 'node-fetch';

const BASE_URL = 'https://songmetrix.com.br';

async function checkServerStatus() {
  console.log('🔍 Verificando status do servidor...\n');
  
  const endpoints = [
    '/api/diagnostico',
    '/api/dashboard',
    '/api/radios',
    '/api/admin/users',
    '/api/admin/insights/drafts',
    '/api/admin/insights/test'
  ];

  for (const endpoint of endpoints) {
    try {
      console.log(`\n📡 Testando: ${endpoint}`);
      const response = await fetch(`${BASE_URL}${endpoint}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer test-token'
        }
      });
      
      console.log(`   Status: ${response.status} ${response.statusText}`);
      
      if (response.status === 404) {
        console.log(`   ❌ Endpoint não encontrado`);
      } else if (response.status === 401) {
        console.log(`   🔐 Endpoint encontrado, mas requer autenticação`);
      } else if (response.status === 200) {
        console.log(`   ✅ Endpoint funcionando`);
      } else {
        console.log(`   ⚠️ Status inesperado`);
      }
      
    } catch (error) {
      console.log(`   ❌ Erro: ${error.message}`);
    }
  }
  
  console.log('\n🎯 Análise:');
  console.log('- Se todos os endpoints retornam 404: problema de roteamento no servidor');
  console.log('- Se alguns retornam 401: rotas existem mas precisam de autenticação');
  console.log('- Se alguns retornam 200: servidor funcionando parcialmente');
}

checkServerStatus().catch(console.error);
