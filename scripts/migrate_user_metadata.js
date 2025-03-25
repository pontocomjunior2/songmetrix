/**
 * Script para migrar metadados dos usuários para os campos full_name e whatsapp na tabela users
 * Isso resolve o problema de dados não exibidos na interface de administração
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

// Função para migrar metadados dos usuários
async function migrateUserMetadata() {
  try {
    console.log('🔄 Iniciando migração de metadados de usuários...');
    
    // 1. Buscar todos os usuários da tabela auth.users para obter os metadados
    console.log('📊 Buscando usuários do sistema de autenticação...');
    const { data: authUsers, error: authError } = await supabase.auth.admin.listUsers();
    
    if (authError) {
      throw new Error(`Erro ao buscar usuários de autenticação: ${authError.message}`);
    }
    
    console.log(`✅ Encontrados ${authUsers.users.length} usuários na autenticação`);
    
    // Contar quantos usuários têm metadados relevantes
    const usersWithMetadata = authUsers.users.filter(user => 
      user.user_metadata && (
        user.user_metadata.fullName || 
        user.user_metadata.full_name || 
        user.user_metadata.whatsapp
      )
    );
    
    console.log(`📊 ${usersWithMetadata.length} usuários têm metadados relevantes`);
    
    // 2. Processar cada usuário e migrar seus metadados
    console.log('🔄 Iniciando processo de migração...');
    
    let success = 0;
    let failed = 0;
    let skipped = 0;
    
    for (const authUser of usersWithMetadata) {
      try {
        const userId = authUser.id;
        const metadata = authUser.user_metadata || {};
        
        // Extrair nome completo (pode estar em diferentes campos)
        const fullName = metadata.fullName || metadata.full_name || '';
        const whatsapp = metadata.whatsapp || '';
        
        // Se não tem dados para migrar, pular
        if (!fullName && !whatsapp) {
          skipped++;
          continue;
        }
        
        // Verificar se o usuário já tem perfil
        const { data: profile, error: profileError } = await supabase
          .from('users')
          .select('id, full_name, whatsapp')
          .eq('id', userId)
          .single();
          
        if (profileError) {
          console.error(`❌ Erro ao buscar perfil para ${authUser.email}: ${profileError.message}`);
          failed++;
          continue;
        }
        
        // Determinar quais campos precisam ser atualizados
        const updates = {};
        
        if (fullName && (!profile.full_name || profile.full_name.trim() === '')) {
          updates.full_name = fullName;
        }
        
        if (whatsapp && (!profile.whatsapp || profile.whatsapp.trim() === '')) {
          updates.whatsapp = whatsapp;
        }
        
        // Se não há campos para atualizar, pular
        if (Object.keys(updates).length === 0) {
          skipped++;
          continue;
        }
        
        // Atualizar o perfil do usuário
        const { error: updateError } = await supabase
          .from('users')
          .update(updates)
          .eq('id', userId);
          
        if (updateError) {
          console.error(`❌ Erro ao atualizar perfil para ${authUser.email}: ${updateError.message}`);
          failed++;
        } else {
          console.log(`✅ Metadados migrados com sucesso para ${authUser.email}`);
          console.log(`   Campos atualizados: ${Object.keys(updates).join(', ')}`);
          success++;
        }
      } catch (userError) {
        console.error(`❌ Erro ao processar usuário: ${userError.message}`);
        failed++;
      }
    }
    
    // 3. Exibir resultado
    console.log('\n📊 Resultado da migração:');
    console.log(`✅ Sucesso: ${success} usuários`);
    console.log(`❌ Falha: ${failed} usuários`);
    console.log(`⏭️ Ignorados: ${skipped} usuários`);
    
    if (success > 0) {
      console.log('\n🔍 Os dados estão agora disponíveis na tabela users e serão exibidos na interface de administração.');
    }
    
    if (failed > 0) {
      console.log('\n⚠️ Alguns usuários não puderam ser migrados. Verifique os erros acima.');
    }
    
  } catch (error) {
    console.error('❌ Erro fatal:', error);
  }
}

// Executar a função principal
migrateUserMetadata()
  .then(() => {
    console.log('\n✅ Migração concluída!');
    process.exit(0);
  })
  .catch(error => {
    console.error('❌ Erro fatal:', error);
    process.exit(1);
  }); 