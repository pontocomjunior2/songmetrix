import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Configuração do dotenv
dotenv.config();

// Informações do Supabase
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

console.log('URL do Supabase:', supabaseUrl);
console.log('SUPABASE_SERVICE_ROLE_KEY disponível:', !!supabaseKey);
console.log('SUPABASE_SERVICE_ROLE_KEY começa com:', supabaseKey ? supabaseKey.substring(0, 15) + '...' : 'N/A');

// Decodificar o JWT para verificar o payload
function decodeJWT(token) {
  try {
    if (!token) return null;
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    return JSON.parse(jsonPayload);
  } catch (e) {
    console.error('Erro ao decodificar JWT:', e);
    return null;
  }
}

// Função para decodificar base64 no Node.js
function atob(str) {
  return Buffer.from(str, 'base64').toString('binary');
}

// Verificar o JWT
const jwt = decodeJWT(supabaseKey);
console.log('JWT Payload:', jwt);

if (jwt && jwt.role !== 'service_role') {
  console.error('❌ AVISO: A chave fornecida não é uma service_role! Role:', jwt.role);
  console.error('❌ Isso explica por que não conseguimos acessar tabelas e usuários.');
  console.error('❌ Você precisa usar a Service Role Key do Supabase, não a Anon Key.');
}

// Verificar ambiente
if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Variáveis de ambiente do Supabase não configuradas');
  process.exit(1);
}

// Criar cliente Supabase
const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

// Função para testar conexão
async function testConnection() {
  try {
    console.log('\n🔍 Testando conexão com o Supabase...');
    
    // Buscar usuários
    console.log('📊 Tentando buscar usuários de autenticação...');
    try {
      const { data: authUsers, error: authError } = await supabase.auth.admin.listUsers();
      
      if (authError) {
        console.log('❌ Erro ao acessar usuários de autenticação:', authError.message);
      } else {
        console.log(`✅ Acessou usuários de autenticação! Total: ${authUsers.users.length}`);
        
        if (authUsers.users.length > 0) {
          console.log(`📑 Encontrou ${authUsers.users.length} usuários de autenticação!`);
          
          // Mostrar dados dos usuários
          console.log('📑 Usuários encontrados:');
          authUsers.users.forEach((user, index) => {
            console.log(`${index + 1}. ${user.email} (criado em: ${new Date(user.created_at).toLocaleDateString()})`);
          });
        }
      }
    } catch (authError) {
      console.log('❌ Erro ao acessar autenticação:', authError.message);
    }
  } catch (error) {
    console.error('❌ Erro ao conectar com o Supabase:', error);
  }
}

// Executar teste
testConnection()
  .then(() => console.log('\n✅ Teste concluído'))
  .catch(err => console.error('❌ Erro durante o teste:', err)); 