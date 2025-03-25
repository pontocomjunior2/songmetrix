/**
 * Script de teste para a sincronização de metadados de usuário
 * Cria um usuário de teste e verifica se os campos full_name e whatsapp são sincronizados corretamente
 */
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';

// Carregar variáveis de ambiente
dotenv.config();

// Configurar cliente Supabase
const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Variáveis de ambiente do Supabase não configuradas');
  process.exit(1);
}

console.log('🔑 Conectando ao Supabase:', supabaseUrl);

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

// Função para criar um usuário de teste e verificar a sincronização
async function testUserMetadataSync() {
  try {
    console.log('🧪 Iniciando teste de sincronização de metadados de usuário...');

    // Gerar dados de teste aleatórios
    const testId = randomUUID().substring(0, 6);
    const testEmail = `teste.${testId}@exemplo.com`;
    const testPassword = `Senha@${testId}`;
    const testFullName = `Usuário Teste ${testId}`;
    const testWhatsapp = `+5511${Math.floor(10000000 + Math.random() * 90000000)}`;

    console.log('📝 Dados de teste:');
    console.log(`   Email: ${testEmail}`);
    console.log(`   Nome: ${testFullName}`);
    console.log(`   WhatsApp: ${testWhatsapp}`);

    // Criar usuário com metadados
    console.log('👤 Criando usuário de teste...');
    const { data: userData, error: createError } = await supabase.auth.admin.createUser({
      email: testEmail,
      password: testPassword,
      email_confirm: true,
      user_metadata: {
        fullName: testFullName,
        whatsapp: testWhatsapp
      }
    });

    if (createError) {
      throw new Error(`Erro ao criar usuário: ${createError.message}`);
    }

    console.log('✅ Usuário criado com sucesso!');
    console.log(`   ID: ${userData.user.id}`);
    
    // Aguardar para garantir que o trigger tenha tempo de executar
    console.log('⏳ Aguardando processamento do trigger (3 segundos)...');
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Consultar o perfil do usuário
    console.log('🔍 Verificando dados do usuário na tabela users...');
    const { data: profileData, error: profileError } = await supabase
      .from('users')
      .select('*')
      .eq('id', userData.user.id)
      .single();

    if (profileError) {
      throw new Error(`Erro ao consultar perfil: ${profileError.message}`);
    }

    console.log('📋 Dados do perfil:');
    console.log(`   ID: ${profileData.id}`);
    console.log(`   Nome completo: ${profileData.full_name || 'NÃO DEFINIDO'}`);
    console.log(`   WhatsApp: ${profileData.whatsapp || 'NÃO DEFINIDO'}`);

    // Verificar sincronização
    const fullNameSync = profileData.full_name === testFullName;
    const whatsappSync = profileData.whatsapp === testWhatsapp;

    console.log('🔄 Resultado da sincronização:');
    console.log(`   Nome completo: ${fullNameSync ? '✅ SINCRONIZADO' : '❌ NÃO SINCRONIZADO'}`);
    console.log(`   WhatsApp: ${whatsappSync ? '✅ SINCRONIZADO' : '❌ NÃO SINCRONIZADO'}`);

    // Consultar metadados na tabela auth.users
    console.log('🔍 Verificando metadados na tabela auth.users...');
    
    const { data: authUserData, error: authUserError } = await supabase.rpc('get_auth_user', { user_id: userData.user.id });
    
    if (authUserError) {
      console.warn(`⚠️ Erro ao consultar auth.users: ${authUserError.message}`);
      console.log('Tentando método alternativo...');
      
      // Alternativa: executar SQL diretamente
      const { data: sqlData, error: sqlError } = await supabase.rpc('exec_sql', { 
        sql: `SELECT raw_user_meta_data FROM auth.users WHERE id = '${userData.user.id}';` 
      });
      
      if (sqlError) {
        console.warn(`⚠️ Erro ao executar SQL: ${sqlError.message}`);
      } else {
        console.log('📋 Metadados na tabela auth.users:');
        console.log(sqlData || 'Nenhum dado retornado');
      }
    } else {
      console.log('📋 Metadados na tabela auth.users:');
      console.log(authUserData);
    }

    // Resultado final
    if (fullNameSync && whatsappSync) {
      console.log('✅ TESTE PASSOU: Todos os campos foram sincronizados corretamente!');
      return { success: true };
    } else {
      console.log('⚠️ TESTE FALHOU: Alguns campos não foram sincronizados.');
      return { success: false };
    }
  } catch (error) {
    console.error('❌ Erro durante o teste:', error);
    return { success: false, error: error.message };
  }
}

// Executar o teste
testUserMetadataSync()
  .then(result => {
    if (result.success) {
      console.log('\n✅ Processo concluído com sucesso!');
    } else {
      console.error('\n❌ Processo falhou:', result.error || 'Campos não sincronizados');
    }
    process.exit(result.success ? 0 : 1);
  })
  .catch(error => {
    console.error('❌ Erro fatal na execução do script:', error);
    process.exit(1);
  }); 