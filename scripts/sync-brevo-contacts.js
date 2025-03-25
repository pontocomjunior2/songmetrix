/**
 * Script para sincronizar todos os usuários existentes com o Brevo
 * Adiciona todos os usuários do banco de dados como contatos no Brevo
 */
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import SibApiV3Sdk from 'sib-api-v3-sdk';
import { logInfo, logError } from '../server/logger.js';

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

// Configurar cliente Brevo
const defaultClient = SibApiV3Sdk.ApiClient.instance;
const apiKey = defaultClient.authentications['api-key'];
const brevoApiKey = process.env.BREVO_API_KEY;

if (!brevoApiKey) {
  console.error('❌ BREVO_API_KEY não configurada no .env');
  process.exit(1);
}

apiKey.apiKey = brevoApiKey;
console.log('🔑 API Key do Brevo configurada');

// ID da lista principal de contatos
const mainListId = process.env.BREVO_MAIN_LIST_ID;

if (!mainListId) {
  console.warn('⚠️ BREVO_MAIN_LIST_ID não configurado no .env. Os contatos não serão adicionados a nenhuma lista.');
}

// Função para criar ou atualizar contato no Brevo
async function createOrUpdateContact(contactData) {
  try {
    console.log(`📧 Processando contato: ${contactData.email}`);
    
    // Instanciar API de contatos
    const contactsApi = new SibApiV3Sdk.ContactsApi();
    
    // Preparar atributos do contato
    const attributes = {};
    
    if (contactData.fullName) {
      // Dividir nome completo em primeiro nome e sobrenome
      const nameParts = contactData.fullName.split(' ');
      attributes.FNAME = nameParts[0] || '';
      attributes.LNAME = nameParts.slice(1).join(' ') || '';
      attributes.NOME = contactData.fullName;
    }
    
    if (contactData.whatsapp) {
      // Remover caracteres não numéricos e adicionar prefixo se necessário
      let whatsapp = contactData.whatsapp.replace(/\D/g, '');
      if (!whatsapp.startsWith('+')) {
        // Se não começar com +, adicionar código do Brasil
        if (!whatsapp.startsWith('55')) {
          whatsapp = '55' + whatsapp;
        }
      }
      attributes.SMS = whatsapp;
      attributes.WHATSAPP = whatsapp;
    }
    
    if (contactData.status) {
      attributes.STATUS = contactData.status;
    }
    
    if (contactData.createdAt) {
      attributes.DATA_CADASTRO = new Date(contactData.createdAt).toISOString().split('T')[0];
    }
    
    // Definir parâmetros para criar/atualizar contato
    const createContactParams = new SibApiV3Sdk.CreateContact();
    createContactParams.email = contactData.email;
    createContactParams.attributes = attributes;
    createContactParams.listIds = contactData.listIds || [];
    createContactParams.updateEnabled = true; // Atualizar se já existir
    
    // Enviar requisição para criar/atualizar contato
    const result = await contactsApi.createContact(createContactParams);
    
    console.log(`✅ Contato criado/atualizado com sucesso: ${contactData.email}`);
    
    return { 
      success: true, 
      id: result.id,
      email: contactData.email
    };
  } catch (error) {
    console.error(`❌ Erro ao criar/atualizar contato ${contactData.email}:`, error.message);
    
    // Se o erro for específico de contato já existente, tentar adicionar à lista
    if (error.response && error.response.body && error.response.body.code === 'duplicate_parameter') {
      console.log(`⚠️ Contato ${contactData.email} já existe, tentando adicionar à lista...`);
      
      try {
        // Se temos uma lista definida, adicionar o contato à lista
        if (contactData.listIds && contactData.listIds.length > 0) {
          const listId = contactData.listIds[0];
          const contactsApi = new SibApiV3Sdk.ContactsApi();
          
          // Criar objeto para adicionar à lista
          const addContactToList = new SibApiV3Sdk.AddContactToList();
          addContactToList.emails = [contactData.email];
          
          // Adicionar à lista
          await contactsApi.addContactToList(listId, addContactToList);
          console.log(`✅ Contato ${contactData.email} adicionado à lista ${listId}`);
          
          return {
            success: true,
            email: contactData.email,
            addedToList: true
          };
        }
      } catch (listError) {
        console.error(`❌ Erro ao adicionar contato ${contactData.email} à lista:`, listError.message);
      }
    }
    
    return { 
      success: false, 
      error: error.message,
      email: contactData.email
    };
  }
}

// Função principal para sincronizar todos os usuários
async function syncAllUsersToBrevo() {
  try {
    console.log('🔄 Iniciando sincronização de usuários com Brevo...');
    
    // Testar conexão com o Supabase
    console.log('🔍 Testando conexão com o Supabase...');
    try {
      // Forma correta de fazer uma contagem no Supabase
      const { count, error: countError } = await supabase
        .from('users')
        .select('*', { count: 'exact', head: true });
      
      if (countError) {
        throw new Error(`Teste de conexão falhou: ${countError.message}`);
      }
      console.log(`✅ Conexão com o Supabase funcionando corretamente. Total de usuários: ${count}`);
    } catch (testError) {
      console.error('❌ Erro ao testar conexão com o Supabase:', testError);
      throw new Error(`Falha na conexão com o Supabase: ${testError.message}`);
    }
    
    // Buscar todos os usuários ativos no banco
    console.log('🔍 Buscando usuários no Supabase...');
    const { data: users, error } = await supabase
      .from('users')
      .select('id, email, full_name, whatsapp, status, created_at, updated_at')
      .order('created_at', { ascending: false });
    
    if (error) {
      throw new Error(`Erro ao buscar usuários: ${error.message}`);
    }
    
    if (!users || users.length === 0) {
      console.log('Nenhum usuário encontrado para sincronizar.');
      return;
    }
    
    console.log(`🔍 Encontrados ${users.length} usuários para sincronizar`);
    
    // Lista para armazenar resultados
    const results = {
      total: users.length,
      success: 0,
      failed: 0,
      errors: []
    };
    
    // Array de IDs de lista para adicionar os contatos
    const listIds = mainListId ? [parseInt(mainListId)] : [];
    
    // Processar cada usuário
    for (const user of users) {
      try {
        console.log(`📧 Sincronizando usuário: ${user.email}`);
        
        // Ignorar usuários sem email
        if (!user.email) {
          console.warn(`⚠️ Usuário ${user.id} não possui email válido. Ignorando.`);
          continue;
        }
        
        // Criar/atualizar contato no Brevo
        const result = await createOrUpdateContact({
          email: user.email,
          fullName: user.full_name,
          whatsapp: user.whatsapp,
          status: user.status,
          createdAt: user.created_at,
          listIds: listIds
        });
        
        if (result.success) {
          console.log(`✅ Usuário sincronizado com sucesso: ${user.email}`);
          results.success++;
        } else {
          console.error(`❌ Erro ao sincronizar usuário ${user.email}: ${result.error}`);
          results.failed++;
          results.errors.push({
            email: user.email,
            error: result.error
          });
        }
      } catch (userError) {
        console.error(`❌ Exceção ao processar usuário ${user.email}:`, userError);
        results.failed++;
        results.errors.push({
          email: user.email,
          error: userError.message
        });
      }
    }
    
    // Exibir resultados
    console.log('\n📊 Resumo da sincronização:');
    console.log(`✅ Sucesso: ${results.success} de ${results.total}`);
    console.log(`❌ Falhas: ${results.failed} de ${results.total}`);
    
    if (results.errors.length > 0) {
      console.log('\n❌ Erros encontrados:');
      results.errors.forEach((err, index) => {
        console.log(`${index + 1}. ${err.email}: ${err.error}`);
      });
    }
    
    console.log('\n✅ Sincronização concluída!');
  } catch (error) {
    console.error('❌ Erro durante a sincronização de usuários:', error);
  }
}

// Executar o script
syncAllUsersToBrevo()
  .then(() => {
    console.log('Script finalizado.');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Erro fatal durante a execução do script:', error);
    process.exit(1);
  }); 