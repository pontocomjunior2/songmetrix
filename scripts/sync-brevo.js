/**
 * Script para sincronizar todos os usuários TRIAL com o Brevo
 * Este script encapsula a funcionalidade de sincronização manual 
 * para ser usada como utilitário de linha de comando
 */
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import SibApiV3Sdk from 'sib-api-v3-sdk';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// Configurar o __dirname para módulos ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Carregar variáveis de ambiente 
dotenv.config({ path: path.join(dirname(__dirname), '.env') });

// Configurações do Supabase
const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ VITE_SUPABASE_URL e VITE_SUPABASE_SERVICE_ROLE_KEY precisam estar configurados no .env');
  process.exit(1);
}

// Inicializar cliente Supabase
const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

// Configurações do Brevo
const defaultClient = SibApiV3Sdk.ApiClient.instance;
const apiKey = defaultClient.authentications['api-key'];
const brevoApiKey = process.env.VITE_BREVO_API_KEY || process.env.BREVO_API_KEY;
const trialListId = parseInt(process.env.VITE_BREVO_TRIAL_LIST_ID || process.env.BREVO_TRIAL_LIST_ID || '7');

if (!brevoApiKey) {
  console.error('❌ VITE_BREVO_API_KEY não configurada no .env');
  process.exit(1);
}

apiKey.apiKey = brevoApiKey;
console.log('🔑 API Key do Brevo configurada');

// Inicializar a API de contatos do Brevo
const contactsApi = new SibApiV3Sdk.ContactsApi();

/**
 * Sincroniza um usuário com o Brevo
 * @param {Object} user - O usuário a ser sincronizado
 * @returns {Promise<Object>} - Resultado da sincronização
 */
async function syncUserToBrevo(user) {
  try {
    // Preparar dados do contato
    const contactData = {
      email: user.email,
      attributes: {
        STATUS: user.status,
        NAME: user.name || '',
        ID: user.id
      },
      listIds: [trialListId],  // Lista para usuários TRIAL
      updateEnabled: true
    };

    // Verificar se o contato já existe
    const existingContact = await contactsApi.getContactInfo(user.email).catch(() => null);

    if (existingContact) {
      // Atualizar contato existente
      const updateData = {
        attributes: contactData.attributes,
        listIds: contactData.listIds
      };
      
      await contactsApi.updateContact(user.email, updateData);
      return { success: true, message: `Contato ${user.email} atualizado no Brevo` };
    } else {
      // Criar novo contato
      await contactsApi.createContact(contactData);
      return { success: true, message: `Contato ${user.email} criado no Brevo` };
    }
  } catch (error) {
    console.error(`❌ Erro ao sincronizar ${user.email}:`, error.message);
    return { success: false, error: error.message, email: user.email };
  }
}

/**
 * Função principal para sincronizar todos os usuários TRIAL
 */
async function syncAllTrialUsersToBrevo() {
  console.log('🔄 Iniciando sincronização de usuários TRIAL com o Brevo...');
  
  try {
    // Buscar todos os usuários com status TRIAL
    const { data: users, error } = await supabase
      .from('users')
      .select('*')
      .eq('status', 'TRIAL');
    
    if (error) {
      throw new Error(`Erro ao buscar usuários: ${error.message}`);
    }
    
    if (!users || users.length === 0) {
      console.log('ℹ️ Nenhum usuário TRIAL encontrado para sincronizar');
      return;
    }
    
    console.log(`📊 Encontrados ${users.length} usuários TRIAL para sincronizar`);
    
    // Contadores para estatísticas
    let successCount = 0;
    let errorCount = 0;
    const errors = [];
    
    // Sincronizar cada usuário
    for (let i = 0; i < users.length; i++) {
      const user = users[i];
      console.log(`🔄 Sincronizando ${i + 1}/${users.length}: ${user.email}`);
      
      const result = await syncUserToBrevo(user);
      
      if (result.success) {
        successCount++;
        console.log(`✅ ${result.message}`);
      } else {
        errorCount++;
        errors.push(result);
        console.error(`❌ Falha: ${result.error}`);
      }
    }
    
    // Exibir estatísticas finais
    console.log('\n📋 Resumo da sincronização:');
    console.log(`✅ Sucessos: ${successCount}`);
    console.log(`❌ Falhas: ${errorCount}`);
    
    if (errorCount > 0) {
      console.log('\n❗ Detalhes das falhas:');
      errors.forEach((err, index) => {
        console.log(`${index + 1}. ${err.email}: ${err.error}`);
      });
    }
    
    console.log('\n🏁 Sincronização concluída!');
    
  } catch (error) {
    console.error('❌ Erro geral durante a sincronização:', error.message);
    process.exit(1);
  }
}

// Executar a sincronização
syncAllTrialUsersToBrevo()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('❌ Erro fatal:', error);
    process.exit(1);
  }); 