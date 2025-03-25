// Script para testar o endpoint de atualização de status
const fetch = require('node-fetch');

// Configurações
const API_URL = 'http://localhost:5173'; // URL do ambiente de desenvolvimento
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://aylxcqaddelwxfukerhr.supabase.co';

// Credenciais admin (substitua por credenciais válidas)
const ADMIN_EMAIL = 'admin@example.com';
const ADMIN_PASSWORD = 'senha_secreta';

// Função para fazer login e obter token
async function getAdminToken() {
  console.log('Obtendo token de acesso admin...');
  
  try {
    const { createClient } = require('@supabase/supabase-js');
    const supabase = createClient(SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
    
    const { data, error } = await supabase.auth.signInWithPassword({
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD
    });
    
    if (error) {
      console.error('Erro ao fazer login:', error);
      throw new Error('Falha na autenticação');
    }
    
    console.log('Login bem-sucedido!');
    return data.session.access_token;
  } catch (error) {
    console.error('Erro durante o login:', error);
    throw error;
  }
}

// Função para testar a atualização de status
async function testStatusUpdate(userId, newStatus, token) {
  console.log(`Testando atualização de status do usuário ${userId} para ${newStatus}...`);
  
  try {
    // Chamar a API
    const response = await fetch(`${API_URL}/api/users/update-status`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        userId,
        newStatus
      })
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
    console.error('Erro ao chamar API:', error);
    return { status: 500, error: error.message };
  }
}

// Verificar status do usuário
async function checkUserStatus(userId, token) {
  console.log(`Verificando status atual do usuário ${userId}...`);
  
  try {
    const response = await fetch(`${API_URL}/api/users/check-status/${userId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    if (!response.ok) {
      throw new Error(`Falha ao verificar status: ${response.status}`);
    }
    
    const data = await response.json();
    console.log('Status atual:', data);
    return data;
  } catch (error) {
    console.error('Erro ao verificar status:', error);
    throw error;
  }
}

// Testar o fluxo completo
async function runTests() {
  console.log('====== INICIANDO TESTES DO ENDPOINT DE ATUALIZAÇÃO DE STATUS ======');
  
  try {
    // Obter token de acesso
    const token = await getAdminToken();
    
    // ID de usuário para teste (substitua por um ID válido do seu sistema)
    const testUserId = 'b1ff0803-c597-41fb-b5d1-47d7f73bf52f';
    
    // Verificar status atual
    await checkUserStatus(testUserId, token).catch(e => {
      console.warn('Não foi possível verificar o status atual, continuando com os testes...');
    });
    
    // Teste 1: Atualizar para TRIAL
    console.log('\n=== TESTE 1: Atualizar para TRIAL ===');
    await testStatusUpdate(testUserId, 'TRIAL', token);
    
    // Breve pausa
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Teste 2: Atualizar para ATIVO
    console.log('\n=== TESTE 2: Atualizar para ATIVO ===');
    await testStatusUpdate(testUserId, 'ATIVO', token);
    
    // Verificar status final
    await checkUserStatus(testUserId, token).catch(e => {
      console.warn('Não foi possível verificar o status final, continuando...');
    });
    
    console.log('\n====== TESTES CONCLUÍDOS ======');
  } catch (error) {
    console.error('Erro durante os testes:', error);
  }
}

// Executar os testes (descomente para executar)
// runTests();

// Exportar funções para uso via linha de comando
module.exports = {
  testStatusUpdate,
  checkUserStatus,
  getAdminToken,
  runTests
};

// Executar se chamado diretamente
if (require.main === module) {
  // Verificar argumentos da linha de comando
  const args = process.argv.slice(2);
  
  if (args.length >= 2) {
    const userId = args[0];
    const newStatus = args[1];
    
    console.log(`Executando atualização de status para usuário ${userId} para ${newStatus}...`);
    
    getAdminToken()
      .then(token => testStatusUpdate(userId, newStatus, token))
      .catch(error => console.error('Falha:', error));
  } else {
    console.log('Uso: node test_api_endpoint.js <userId> <newStatus>');
    console.log('Exemplo: node test_api_endpoint.js b1ff0803-c597-41fb-b5d1-47d7f73bf52f ATIVO');
  }
} 