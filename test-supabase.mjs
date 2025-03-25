import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Configuração do dotenv
dotenv.config();

// Informações do Supabase
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

console.log('URL do Supabase:', supabaseUrl);
console.log('Service Role Key disponível:', !!supabaseKey);

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
    console.log('🔍 Testando conexão com o Supabase...');
    
    // Buscar usuários
    const { data, error, count } = await supabase
      .from('users')
      .select('id, email, status, full_name', { count: 'exact' })
      .limit(5);
    
    if (error) {
      throw new Error(`Erro ao buscar usuários: ${error.message}`);
    }
    
    console.log(`✅ Conexão com o Supabase funcionando!`);
    console.log(`📊 Total de usuários: ${count}`);
    
    if (data && data.length > 0) {
      console.log('📋 Primeiros usuários encontrados:');
      data.forEach((user, index) => {
        console.log(`${index + 1}. ${user.email} (${user.status}) - ${user.full_name || 'Sem nome'}`);
      });
    } else {
      console.log('⚠️ Nenhum usuário encontrado na tabela');
    }
  } catch (error) {
    console.error('❌ Erro ao conectar com o Supabase:', error);
  }
}

// Executar teste
testConnection()
  .then(() => console.log('✅ Teste concluído'))
  .catch(err => console.error('❌ Erro durante o teste:', err)); 