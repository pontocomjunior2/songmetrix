/**
 * Script para verificar os metadados dos usuários no Supabase
 * Use para diagnosticar por que os campos full_name e whatsapp não estão aparecendo
 */
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

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

// Função para verificar os metadados dos usuários
async function checkUserMetadata() {
  try {
    console.log('🔍 Verificando metadados dos usuários...');
    
    // 1. Buscar todos os usuários da tabela auth.users para obter os metadados
    console.log('📊 Buscando usuários do sistema de autenticação...');
    const { data: authUsers, error: authError } = await supabase.auth.admin.listUsers();
    
    if (authError) {
      throw new Error(`Erro ao buscar usuários de autenticação: ${authError.message}`);
    }
    
    console.log(`✅ Encontrados ${authUsers.users.length} usuários na autenticação`);
    
    // 2. Buscar usuários da tabela public.users
    console.log('📊 Buscando usuários da tabela de perfis...');
    const { data: profileUsers, error: profileError } = await supabase
      .from('users')
      .select('id, email, full_name, whatsapp, status, created_at');
      
    if (profileError) {
      throw new Error(`Erro ao buscar perfis de usuários: ${profileError.message}`);
    }
    
    console.log(`✅ Encontrados ${profileUsers.length} perfis de usuários`);
    
    // 3. Comparar os dados
    console.log('\n📝 Análise dos dados:');
    
    // Verificar usuários com nome completo e whatsapp no perfil
    const usersWithFullName = profileUsers.filter(user => user.full_name && user.full_name.trim() !== '');
    const usersWithWhatsapp = profileUsers.filter(user => user.whatsapp && user.whatsapp.trim() !== '');
    
    console.log(`- Usuários com nome completo no perfil: ${usersWithFullName.length}/${profileUsers.length} (${Math.round(usersWithFullName.length/profileUsers.length*100)}%)`);
    console.log(`- Usuários com WhatsApp no perfil: ${usersWithWhatsapp.length}/${profileUsers.length} (${Math.round(usersWithWhatsapp.length/profileUsers.length*100)}%)`);
    
    // Verificar usuários com metadados na autenticação
    const usersWithFullNameMeta = authUsers.users.filter(user => 
      (user.user_metadata?.fullName && user.user_metadata.fullName.trim() !== '') || 
      (user.user_metadata?.full_name && user.user_metadata.full_name.trim() !== '')
    );
    
    const usersWithWhatsappMeta = authUsers.users.filter(user => 
      user.user_metadata?.whatsapp && user.user_metadata.whatsapp.trim() !== ''
    );
    
    console.log(`- Usuários com nome completo nos metadados: ${usersWithFullNameMeta.length}/${authUsers.users.length} (${Math.round(usersWithFullNameMeta.length/authUsers.users.length*100)}%)`);
    console.log(`- Usuários com WhatsApp nos metadados: ${usersWithWhatsappMeta.length}/${authUsers.users.length} (${Math.round(usersWithWhatsappMeta.length/authUsers.users.length*100)}%)`);
    
    // Verificar se há discrepância entre metadados e perfil
    console.log('\n🔍 Verificando discrepâncias:');
    
    let metaNotInProfile = 0;
    let needsMigration = 0;
    
    // Criar mapa de IDs para perfis
    const profileMap = {};
    profileUsers.forEach(user => {
      profileMap[user.id] = user;
    });
    
    for (const authUser of authUsers.users) {
      const userId = authUser.id;
      const profileUser = profileMap[userId];
      
      if (!profileUser) {
        metaNotInProfile++;
        continue;
      }
      
      // Verificar se tem metadados que precisam ser migrados
      const hasFullNameMeta = (authUser.user_metadata?.fullName && authUser.user_metadata.fullName.trim() !== '') || 
                             (authUser.user_metadata?.full_name && authUser.user_metadata.full_name.trim() !== '');
                             
      const hasWhatsappMeta = authUser.user_metadata?.whatsapp && authUser.user_metadata.whatsapp.trim() !== '';
      
      const needsFullNameMigration = hasFullNameMeta && (!profileUser.full_name || profileUser.full_name.trim() === '');
      const needsWhatsappMigration = hasWhatsappMeta && (!profileUser.whatsapp || profileUser.whatsapp.trim() === '');
      
      if (needsFullNameMigration || needsWhatsappMigration) {
        needsMigration++;
      }
    }
    
    console.log(`- Usuários com conta mas sem perfil: ${metaNotInProfile}`);
    console.log(`- Usuários que precisam de migração de metadados: ${needsMigration}`);
    
    // Mostrar alguns exemplos de usuários para análise
    if (usersWithFullName.length > 0) {
      console.log('\n📋 Exemplo de usuário com nome completo:');
      console.log(usersWithFullName[0]);
    }
    
    if (usersWithWhatsapp.length > 0) {
      console.log('\n📋 Exemplo de usuário com WhatsApp:');
      console.log(usersWithWhatsapp[0]);
    }
    
    // Mostrar exemplos de metadados para verificar o formato
    if (usersWithFullNameMeta.length > 0) {
      console.log('\n📋 Exemplo de metadados com nome completo:');
      const exampleUser = usersWithFullNameMeta[0];
      console.log({
        id: exampleUser.id,
        email: exampleUser.email,
        metadata: {
          fullName: exampleUser.user_metadata?.fullName,
          full_name: exampleUser.user_metadata?.full_name
        }
      });
    }
    
    if (usersWithWhatsappMeta.length > 0) {
      console.log('\n📋 Exemplo de metadados com WhatsApp:');
      const exampleUser = usersWithWhatsappMeta[0];
      console.log({
        id: exampleUser.id,
        email: exampleUser.email,
        metadata: {
          whatsapp: exampleUser.user_metadata?.whatsapp
        }
      });
    }
    
    // Sugerir solução
    if (needsMigration > 0) {
      console.log('\n🛠️ Solução recomendada:');
      console.log('Executar o script de migração de metadados para atualizar os perfis com os dados dos metadados:');
      console.log('node scripts/migrate_user_metadata.js');
    } else if (usersWithFullNameMeta.length === 0 && usersWithWhatsappMeta.length === 0) {
      console.log('\n🛠️ Diagnóstico:');
      console.log('Não há dados de nome completo ou WhatsApp nos metadados dos usuários.');
      console.log('Isso indica que esses dados nunca foram coletados durante o cadastro ou login.');
    } else {
      console.log('\n✅ Diagnóstico:');
      console.log('Os dados estão presentes nos perfis, mas podem estar vazios para a maioria dos usuários.');
      console.log('Verifique a tabela users via Supabase Studio para confirmar os dados.');
    }
    
  } catch (error) {
    console.error('❌ Erro:', error);
  }
}

// Executar a função principal
checkUserMetadata()
  .then(() => {
    console.log('\n✅ Verificação concluída!');
    process.exit(0);
  })
  .catch(error => {
    console.error('❌ Erro fatal:', error);
    process.exit(1);
  }); 