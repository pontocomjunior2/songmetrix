// Script para testar a função Edge do Brevo diretamente
const fetch = require('node-fetch');

// Configurações
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://aylxcqaddelwxfukerhr.supabase.co';
const ANON_KEY = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF5bHhjcWFkZGVsd3hmdWtlcmhyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDAwMTc2NTksImV4cCI6MjA1NTU5MzY1OX0.YqQAdHMeGMmPAfKFtZPTovJ8szJi_iiUwkEnnLk1Cg8';

// Funções auxiliares
async function testEdgeFunction(payload) {
  console.log('Testando função Edge com payload:', JSON.stringify(payload, null, 2));
  
  try {
    // Chamar a função Edge diretamente
    const response = await fetch(`${SUPABASE_URL}/functions/v1/user-webhook`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${ANON_KEY}`
      },
      body: JSON.stringify(payload)
    });
    
    // Capturar resposta
    const responseStatus = response.status;
    let responseData;
    
    try {
      responseData = await response.json();
    } catch (e) {
      responseData = await response.text();
    }
    
    // Exibir resultados
    console.log('Status da resposta:', responseStatus);
    console.log('Dados da resposta:', typeof responseData === 'string' ? responseData : JSON.stringify(responseData, null, 2));
    
    return { status: responseStatus, data: responseData };
  } catch (error) {
    console.error('Erro ao chamar função Edge:', error);
    return { status: 500, error: error.message };
  }
}

// Testar diferentes cenários
async function runTests() {
  console.log('====== INICIANDO TESTES DA FUNÇÃO EDGE DO BREVO ======');
  
  // Teste 1: Inserção de usuário (TRIAL)
  console.log('\n=== TESTE 1: Novo usuário com status TRIAL ===');
  await testEdgeFunction({
    type: 'INSERT',
    table: 'users',
    schema: 'public',
    record: {
      id: 'b1ff0803-c597-41fb-b5d1-47d7f73bf52f',
      email: 'teste@example.com',
      status: 'TRIAL',
      full_name: 'Usuário Teste',
      whatsapp: '5511999999999',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }
  });
  
  // Teste 2: Atualização de status de TRIAL para ATIVO
  console.log('\n=== TESTE 2: Atualização de status de TRIAL para ATIVO ===');
  await testEdgeFunction({
    type: 'UPDATE',
    table: 'users',
    schema: 'public',
    record: {
      id: 'b1ff0803-c597-41fb-b5d1-47d7f73bf52f',
      email: 'teste@example.com',
      status: 'ATIVO',
      full_name: 'Usuário Teste',
      whatsapp: '5511999999999',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    },
    old_record: {
      id: 'b1ff0803-c597-41fb-b5d1-47d7f73bf52f',
      email: 'teste@example.com',
      status: 'TRIAL',
      full_name: 'Usuário Teste',
      whatsapp: '5511999999999',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }
  });
  
  // Teste 3: Atualização comum (sem mudança de status)
  console.log('\n=== TESTE 3: Atualização sem mudança de status ===');
  await testEdgeFunction({
    type: 'UPDATE',
    table: 'users',
    schema: 'public',
    record: {
      id: 'b1ff0803-c597-41fb-b5d1-47d7f73bf52f',
      email: 'teste@example.com',
      status: 'ATIVO',
      full_name: 'Usuário Teste Atualizado',
      whatsapp: '5511999999999',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    },
    old_record: {
      id: 'b1ff0803-c597-41fb-b5d1-47d7f73bf52f',
      email: 'teste@example.com',
      status: 'ATIVO',
      full_name: 'Usuário Teste',
      whatsapp: '5511999999999',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }
  });
  
  // Teste 4: Exclusão de usuário
  console.log('\n=== TESTE 4: Exclusão de usuário ===');
  await testEdgeFunction({
    type: 'DELETE',
    table: 'users',
    schema: 'public',
    record: null,
    old_record: {
      id: 'b1ff0803-c597-41fb-b5d1-47d7f73bf52f',
      email: 'teste@example.com',
      status: 'ATIVO',
      full_name: 'Usuário Teste',
      whatsapp: '5511999999999',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }
  });
  
  console.log('\n====== TESTES CONCLUÍDOS ======');
}

// Executar os testes
runTests().catch(error => {
  console.error('Erro durante os testes:', error);
}); 