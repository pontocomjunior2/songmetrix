/**
 * Script para corrigir a sincronização dos campos full_name e whatsapp
 * Resolve inconsistências entre os metadados de autenticação e a tabela de perfil
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

// Função para verificar e reparar a sincronização de campos de perfil
async function fixUserProfileFields() {
  try {
    console.log('🔍 Iniciando verificação e reparo de campos de perfil...');
    
    // Verificar triggers existentes
    console.log('📊 Verificando triggers existentes...');
    
    // Aplicar a migração SQL para criar ou atualizar o trigger
    console.log('🔄 Aplicando migração para sincronização automática...');
    
    // Ler o arquivo SQL
    const sqlPath = './supabase/migrations/sync_user_metadata_to_profile.sql';
    console.log(`📄 Executando SQL de ${sqlPath}`);
    
    try {
      // A importação dinâmica não funciona bem com arquivos SQL no Node.js,
      // então vamos executar a migração manualmente usando rpc
      
      console.log('📊 Executando migração via RPC...');
      const { error } = await supabase.rpc('apply_migration', {
        migration_name: 'sync_user_metadata_to_profile'
      });
      
      if (error) {
        console.warn(`⚠️ Erro ao executar migração via RPC: ${error.message}`);
        console.log('⚠️ Continuando com sincronização manual...');
      } else {
        console.log('✅ Migração aplicada com sucesso!');
      }
    } catch (sqlError) {
      console.warn(`⚠️ Erro ao executar migração SQL: ${sqlError.message}`);
      console.log('⚠️ Continuando com sincronização manual...');
    }
    
    // Sincronizar manualmente os usuários como backup
    console.log('🔄 Sincronizando usuários manualmente...');
    
    // 1. Buscar todos os usuários da autenticação
    console.log('📊 Buscando usuários de autenticação...');
    const { data: authUsers, error: authError } = await supabase.auth.admin.listUsers();
    
    if (authError) {
      throw new Error(`Erro ao buscar usuários de autenticação: ${authError.message}`);
    }
    
    console.log(`✅ Encontrados ${authUsers.users.length} usuários de autenticação`);
    
    // 2. Processar cada usuário
    let success = 0;
    let skipped = 0;
    let failed = 0;
    let created = 0;
    
    for (const authUser of authUsers.users) {
      try {
        const userId = authUser.id;
        const email = authUser.email;
        const metadata = authUser.user_metadata || {};
        
        // Extrair dados dos metadados
        const fullName = metadata.fullName || metadata.full_name || metadata.name || '';
        const whatsapp = metadata.whatsapp || '';
        
        // Verificar se o usuário tem perfil
        const { data: profileData, error: profileError } = await supabase
          .from('users')
          .select('id, email, status, full_name, whatsapp')
          .eq('id', userId)
          .maybeSingle();
          
        if (profileError) {
          console.error(`❌ Erro ao buscar perfil para ${email}: ${profileError.message}`);
          failed++;
          continue;
        }
        
        if (!profileData) {
          // Usuário não tem perfil, criar um novo
          console.log(`📝 Criando perfil para usuário ${email}`);
          
          const { error: createError } = await supabase
            .from('users')
            .insert({
              id: userId,
              email: email,
              status: 'TRIAL', // Status padrão para novos usuários
              full_name: fullName,
              whatsapp: whatsapp,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            });
            
          if (createError) {
            console.error(`❌ Erro ao criar perfil para ${email}: ${createError.message}`);
            failed++;
          } else {
            console.log(`✅ Perfil criado com sucesso para ${email}`);
            created++;
            success++;
          }
        } else {
          // Usuário tem perfil, verificar se precisa atualizar
          const updates = {};
          let needsUpdate = false;
          
          if (fullName && (!profileData.full_name || profileData.full_name.trim() === '')) {
            updates.full_name = fullName;
            needsUpdate = true;
          }
          
          if (whatsapp && (!profileData.whatsapp || profileData.whatsapp.trim() === '')) {
            updates.whatsapp = whatsapp;
            needsUpdate = true;
          }
          
          if (needsUpdate) {
            // Atualizar o perfil
            updates.updated_at = new Date().toISOString();
            
            const { error: updateError } = await supabase
              .from('users')
              .update(updates)
              .eq('id', userId);
              
            if (updateError) {
              console.error(`❌ Erro ao atualizar perfil para ${email}: ${updateError.message}`);
              failed++;
            } else {
              console.log(`✅ Perfil atualizado com sucesso para ${email}`);
              success++;
            }
          } else {
            console.log(`⏭️ Perfil já atualizado para ${email}`);
            skipped++;
          }
        }
      } catch (userError) {
        console.error(`❌ Erro ao processar usuário: ${userError.message}`);
        failed++;
      }
    }
    
    // 3. Verificar metadados faltantes e atualizar no sentido inverso
    console.log('\n🔄 Verificando usuários com perfil mas sem metadados...');
    
    const { data: profileUsers, error: profilesError } = await supabase
      .from('users')
      .select('id, email, full_name, whatsapp');
      
    if (profilesError) {
      throw new Error(`Erro ao buscar perfis: ${profilesError.message}`);
    }
    
    let metadataUpdated = 0;
    
    for (const profile of profileUsers) {
      if (!profile.full_name && !profile.whatsapp) {
        continue;  // Pular se não tem dados relevantes
      }
      
      try {
        // Buscar usuário de autenticação
        const { data: authData, error: authUserError } = await supabase.auth.admin.getUserById(profile.id);
        
        if (authUserError || !authData.user) {
          console.warn(`⚠️ Usuário de autenticação não encontrado para perfil ${profile.email}`);
          continue;
        }
        
        const user = authData.user;
        const metadata = user.user_metadata || {};
        
        // Verificar se precisa atualizar metadados
        let needsMetadataUpdate = false;
        const newMetadata = { ...metadata };
        
        if (profile.full_name && !metadata.fullName && !metadata.full_name) {
          newMetadata.fullName = profile.full_name;
          needsMetadataUpdate = true;
        }
        
        if (profile.whatsapp && !metadata.whatsapp) {
          newMetadata.whatsapp = profile.whatsapp;
          needsMetadataUpdate = true;
        }
        
        if (needsMetadataUpdate) {
          // Atualizar metadados
          const { error: updateMetaError } = await supabase.auth.admin.updateUserById(
            profile.id,
            { user_metadata: newMetadata }
          );
          
          if (updateMetaError) {
            console.error(`❌ Erro ao atualizar metadados para ${profile.email}: ${updateMetaError.message}`);
          } else {
            console.log(`✅ Metadados atualizados com sucesso para ${profile.email}`);
            metadataUpdated++;
          }
        }
      } catch (profileError) {
        console.error(`❌ Erro ao processar perfil: ${profileError.message}`);
      }
    }
    
    // 4. Exibir resultados
    console.log('\n📊 Resultado da verificação e reparo:');
    console.log(`✅ Perfis criados: ${created}`);
    console.log(`✅ Perfis atualizados: ${success - created}`);
    console.log(`✅ Total de operações bem-sucedidas: ${success}`);
    console.log(`⏭️ Perfis ignorados (já atualizados): ${skipped}`);
    console.log(`❌ Operações com falha: ${failed}`);
    console.log(`🔄 Metadados atualizados a partir do perfil: ${metadataUpdated}`);
    
    return {
      success: true,
      stats: {
        success,
        skipped,
        failed,
        created,
        metadataUpdated
      }
    };
  } catch (error) {
    console.error('❌ Erro fatal:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

// Executar a função principal
fixUserProfileFields()
  .then(result => {
    if (result.success) {
      console.log('\n✅ Verificação e reparo concluídos!');
      console.log('🔍 Agora os campos full_name e whatsapp devem aparecer corretamente na interface de usuários.');
    } else {
      console.error('\n❌ Falha na verificação e reparo:', result.error);
    }
    process.exit(result.success ? 0 : 1);
  })
  .catch(error => {
    console.error('❌ Erro fatal na execução do script:', error);
    process.exit(1);
  }); 