#!/usr/bin/env node

/**
 * Script para testar o acesso ao painel de insights
 * Verifica se a página está acessível e se os componentes carregam corretamente
 */

import fetch from 'node-fetch';

const FRONTEND_URL = 'http://localhost:5173';
const BACKEND_URL = 'http://localhost:3001';

async function testInsightDashboard() {
  console.log('🧪 Testando Painel de Insights - SongMetrix\n');

  try {
    // Teste 1: Verificar se o frontend está respondendo
    console.log('1️⃣ Testando acesso ao frontend...');
    try {
      const frontendResponse = await fetch(FRONTEND_URL, { 
        method: 'HEAD',
        timeout: 5000 
      });
      
      if (frontendResponse.ok) {
        console.log('✅ Frontend acessível em http://localhost:5173');
      } else {
        console.log(`❌ Frontend retornou status: ${frontendResponse.status}`);
      }
    } catch (error) {
      console.log('❌ Frontend não está acessível:', error.message);
      console.log('💡 Execute: npm run dev');
    }

    // Teste 2: Verificar se o backend está respondendo
    console.log('\n2️⃣ Testando acesso ao backend...');
    try {
      const backendResponse = await fetch(`${BACKEND_URL}/api/diagnostico`, {
        method: 'GET',
        timeout: 5000
      });
      
      if (backendResponse.ok) {
        console.log('✅ Backend acessível em http://localhost:3001');
        const data = await backendResponse.json();
        console.log(`   Status: ${data.status}`);
        console.log(`   Timestamp: ${data.timestamp}`);
      } else {
        console.log(`❌ Backend retornou status: ${backendResponse.status}`);
      }
    } catch (error) {
      console.log('❌ Backend não está acessível:', error.message);
      console.log('💡 Execute: npm run server');
    }

    // Teste 3: Verificar se as rotas de admin existem (sem autenticação)
    console.log('\n3️⃣ Testando rotas de admin de insights...');
    try {
      const adminResponse = await fetch(`${BACKEND_URL}/api/admin/insights/drafts`, {
        method: 'GET',
        timeout: 5000
      });
      
      // Esperamos 401 (não autenticado) ou 403 (não autorizado), não 404
      if (adminResponse.status === 401) {
        console.log('✅ Rotas de admin configuradas (requer autenticação)');
      } else if (adminResponse.status === 403) {
        console.log('✅ Rotas de admin configuradas (requer permissões de admin)');
      } else if (adminResponse.status === 404) {
        console.log('❌ Rotas de admin não encontradas');
        console.log('💡 Verifique se server/routes/adminInsightRoutes.js está registrado');
      } else {
        console.log(`ℹ️  Rota de admin retornou status: ${adminResponse.status}`);
      }
    } catch (error) {
      console.log('❌ Erro ao testar rotas de admin:', error.message);
    }

    // Informações de acesso
    console.log('\n📋 Informações de Acesso:');
    console.log('🌐 Frontend: http://localhost:5173');
    console.log('🔧 Backend: http://localhost:3001');
    console.log('👤 Painel de Insights: http://localhost:5173/admin/insights');
    console.log('');
    console.log('📝 Pré-requisitos para acessar o painel:');
    console.log('   1. Estar logado no sistema');
    console.log('   2. Ter permissões de administrador');
    console.log('   3. Estar na tabela public.admins');
    console.log('');
    console.log('🛠️  Para configurar um admin:');
    console.log('   npm run add-admin SEU_USER_ID');
    console.log('');
    console.log('🧪 Para testar com dados:');
    console.log('   npm run create-test-data');
    console.log('   npm run test-insight-generator');

  } catch (error) {
    console.error('❌ Erro geral no teste:', error);
  }
}

// Executar o teste
testInsightDashboard();