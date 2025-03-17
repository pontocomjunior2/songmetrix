import fetch from 'node-fetch';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';

// Configuração de caminhos e ambiente
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');

// Descobrir qual arquivo .env usar
const envProdPath = join(rootDir, '.env.production');
const envPath = join(rootDir, '.env');

let envFile = envPath;
if (process.argv.includes('--prod')) {
  envFile = fs.existsSync(envProdPath) ? envProdPath : envPath;
}

console.log(`Usando arquivo de configuração: ${envFile}`);
dotenv.config({ path: envFile });

const API_BASE_URL = process.env.VITE_API_BASE_URL || 'http://localhost:3001';
console.log(`Base URL da API: ${API_BASE_URL}`);

// Endpoints para testar
const endpoints = [
  { url: '/api/radios/status', method: 'GET', name: 'Status das Rádios' },
  { url: '/api/dashboard?includeAll=true', method: 'GET', name: 'Dashboard (Todas as Rádios)' },
  { url: '/api/dashboard?radio=Radio1&radio=Radio2', method: 'GET', name: 'Dashboard (Rádios Específicas)' },
  { url: '/api/diagnostico', method: 'GET', name: 'Diagnóstico do Sistema' }
];

// Função para obter um token Supabase (para testes autenticados)
async function getAuthToken() {
  // Usar credenciais de teste para obtenção de token
  // Apenas para uso em scripts de teste, não em produção!
  const testEmail = process.env.TEST_USER_EMAIL || 'test@example.com';
  const testPassword = process.env.TEST_USER_PASSWORD || 'password';
  
  try {
    const response = await fetch(`${process.env.VITE_SUPABASE_URL}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': process.env.VITE_SUPABASE_ANON_KEY
      },
      body: JSON.stringify({
        email: testEmail,
        password: testPassword
      })
    });
    
    if (!response.ok) {
      console.warn('Falha ao obter token de autenticação. Executando testes sem autenticação.');
      return null;
    }
    
    const data = await response.json();
    return data.access_token;
  } catch (error) {
    console.warn('Erro ao obter token:', error.message);
    return null;
  }
}

// Função para testar um endpoint específico
async function testEndpoint(endpoint, token) {
  console.log(`\nTestando ${endpoint.name}: ${endpoint.method} ${endpoint.url}`);
  
  try {
    const headers = {
      'Content-Type': 'application/json'
    };
    
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 segundos de timeout
    
    const response = await fetch(`${API_BASE_URL}${endpoint.url}`, {
      method: endpoint.method,
      headers,
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    
    console.log(`Status: ${response.status} ${response.statusText}`);
    
    if (!response.ok) {
      console.error(`❌ Erro: ${response.status} ${response.statusText}`);
      return false;
    }
    
    const data = await response.json();
    
    // Verificar se a resposta contém dados válidos
    if (data && typeof data === 'object') {
      if (Array.isArray(data)) {
        console.log(`✅ Sucesso! Resposta contém um array com ${data.length} itens.`);
      } else {
        console.log(`✅ Sucesso! Resposta contém um objeto com ${Object.keys(data).length} propriedades.`);
        
        // Verificações específicas por endpoint
        if (endpoint.url.includes('/api/dashboard')) {
          if (data.topSongs && Array.isArray(data.topSongs)) {
            console.log(`  - topSongs: ${data.topSongs.length} itens`);
          } else {
            console.warn('  - ⚠️ topSongs ausente ou não é um array');
          }
          
          if (data.artistData && Array.isArray(data.artistData)) {
            console.log(`  - artistData: ${data.artistData.length} itens`);
          } else {
            console.warn('  - ⚠️ artistData ausente ou não é um array');
          }
          
          if (data.genreData && Array.isArray(data.genreData)) {
            console.log(`  - genreData: ${data.genreData.length} itens`);
          } else {
            console.warn('  - ⚠️ genreData ausente ou não é um array');
          }
        }
      }
      return true;
    } else {
      console.error('❌ Resposta não contém dados válidos');
      return false;
    }
  } catch (error) {
    if (error.name === 'AbortError') {
      console.error('❌ Timeout: A requisição excedeu o tempo limite (10s)');
    } else {
      console.error(`❌ Erro: ${error.message}`);
    }
    return false;
  }
}

// Função principal
async function main() {
  console.log('=== VERIFICAÇÃO DE API DO SONGMETRIX ===');
  console.log(`Data/Hora: ${new Date().toLocaleString()}`);
  
  console.log('\nObtendo token de autenticação...');
  const token = await getAuthToken();
  
  if (token) {
    console.log('✅ Token obtido com sucesso');
  } else {
    console.warn('⚠️ Executando testes sem autenticação. Alguns endpoints podem falhar.');
  }
  
  let successes = 0;
  let failures = 0;
  
  for (const endpoint of endpoints) {
    const success = await testEndpoint(endpoint, token);
    if (success) {
      successes++;
    } else {
      failures++;
    }
  }
  
  console.log('\n=== RESUMO ===');
  console.log(`Total de endpoints testados: ${endpoints.length}`);
  console.log(`✅ Sucesso: ${successes}`);
  console.log(`❌ Falha: ${failures}`);
  
  if (failures > 0) {
    process.exit(1);
  } else {
    console.log('\n🎉 Todos os endpoints funcionaram corretamente!');
  }
}

main().catch(error => {
  console.error('Erro fatal durante a execução:', error);
  process.exit(1);
}); 