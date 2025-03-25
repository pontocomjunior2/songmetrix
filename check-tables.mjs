import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

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

// Função para verificar tabelas existentes
async function checkTablesAndUsers() {
  try {
    console.log('📋 Verificando tabelas no Supabase...');
    
    // Lista de tabelas que podemos consultar
    const tables = [
      'users',
      'User',
      'Users',
      'profile',
      'profiles',
      'auth.users'
    ];
    
    console.log('🔍 Testando tabelas conhecidas:');
    
    for (const table of tables) {
      try {
        console.log(`\n📊 Testando tabela: ${table}`);
        
        const { data, error, count } = await supabase
          .from(table)
          .select('*', { count: 'exact' })
          .limit(1);
        
        if (error) {
          console.log(`❌ Erro ao acessar tabela ${table}: ${error.message}`);
        } else {
          console.log(`✅ Tabela ${table} existe! Total de registros: ${count}`);
          
          if (count > 0) {
            // Obter a estrutura de um registro para ver os campos
            console.log(`📑 Estrutura da tabela ${table}:`);
            console.log(JSON.stringify(data[0], null, 2));
          }
        }
      } catch (tableError) {
        console.log(`❌ Erro ao verificar tabela ${table}: ${tableError.message}`);
      }
    }
    
    // Tentar listar diretamente no banco via SQL as tabelas públicas
    console.log('\n🔍 Listando todas as tabelas públicas via SQL...');
    
    const { data: sqlTables, error: sqlError } = await supabase
      .rpc('list_tables');
    
    if (sqlError) {
      console.log('❌ Erro ao listar tabelas via SQL:', sqlError.message);
      
      // Tentativa alternativa com consulta direta
      const { data: tables2, error: tablesError } = await supabase
        .from('pg_tables')
        .select('schemaname, tablename')
        .eq('schemaname', 'public');
      
      if (tablesError) {
        console.log('❌ Também não foi possível listar tabelas via pg_tables:', tablesError.message);
      } else {
        console.log('📋 Tabelas encontradas via pg_tables:', tables2);
      }
    } else {
      console.log('📋 Tabelas encontradas via SQL:', sqlTables);
    }
    
    // Verificar se temos acesso à tabela de autenticação
    console.log('\n🔍 Tentando acessar tabela de autenticação...');
    
    try {
      const { data: authUsers, error: authError } = await supabase.auth.admin.listUsers();
      
      if (authError) {
        console.log('❌ Erro ao acessar usuários de autenticação:', authError.message);
      } else {
        console.log(`✅ Acessou usuários de autenticação! Total: ${authUsers.users.length}`);
        
        if (authUsers.users.length > 0) {
          console.log('📑 Exemplo de usuário de autenticação:');
          // Limitar informações sensíveis
          const userExample = authUsers.users[0];
          console.log({
            id: userExample.id,
            email: userExample.email,
            created_at: userExample.created_at,
            role: userExample.role,
            has_metadata: !!userExample.user_metadata
          });
        }
      }
    } catch (authError) {
      console.log('❌ Erro ao acessar autenticação:', authError.message);
    }
  } catch (error) {
    console.error('❌ Erro ao verificar tabelas:', error);
  }
}

// Executar verificação
checkTablesAndUsers()
  .then(() => console.log('\n✅ Verificação concluída'))
  .catch(err => console.error('❌ Erro durante a verificação:', err)); 