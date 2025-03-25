/**
 * Script para sincronizar todos os usuários existentes com as listas corretas no Brevo
 * Adiciona usuários às listas específicas baseado no status:
 * - TRIAL: Lista 7
 * - ATIVO: Lista 8
 * - INATIVO: Lista 9
 */
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import SibApiV3Sdk from 'sib-api-v3-sdk';
import { logInfo, logError, logWarn } from '../server/logger.js';

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

// IDs das listas do Brevo conforme status
const statusListIds = {
  TRIAL: 7,   // Lista para usuários Trial
  ATIVO: 8,   // Lista para usuários Ativos
  INATIVO: 9, // Lista para usuários Inativos
};

// Exibir configuração das listas
console.log('📋 Listas configuradas:');
console.log(`- Lista TRIAL: ID ${statusListIds.TRIAL}`);
console.log(`- Lista ATIVO: ID ${statusListIds.ATIVO}`);
console.log(`- Lista INATIVO: ID ${statusListIds.INATIVO}`);

// Função para atualizar listas de um contato baseado no status
async function updateContactListsByStatus(email, status) {
  try {
    console.log(`📧 Atualizando listas para contato ${email} com status ${status}`);
    
    // Validar se o status é válido
    if (!status || !statusListIds[status]) {
      console.warn(`⚠️ Status inválido para gerenciamento de listas: ${status}`);
      return { 
        success: false, 
        error: `Status inválido: ${status}`,
        email
      };
    }
    
    // Instanciar API de contatos
    const contactsApi = new SibApiV3Sdk.ContactsApi();
    
    // Primeiro verificar se o contato existe
    try {
      const contactInfo = await contactsApi.getContactInfo(email);
      console.log(`✅ Contato encontrado no Brevo: ${email} (ID: ${contactInfo.id})`);
      
      // Remover o contato de todas as listas de status primeiro
      const allStatusLists = Object.values(statusListIds);
      for (const listId of allStatusLists) {
        try {
          const removeContactFromList = new SibApiV3Sdk.RemoveContactFromList();
          removeContactFromList.emails = [email];
          
          await contactsApi.removeContactFromList(listId, removeContactFromList);
          console.log(`✅ Contato removido da lista ${listId}`);
        } catch (removeError) {
          // Ignorar erros ao remover da lista (pode não estar na lista)
          console.warn(`⚠️ Erro ao remover contato da lista ${listId} (ignorando): ${removeError.message}`);
        }
      }
      
      // Adicionar o contato à lista correta para seu status atual
      const targetListId = statusListIds[status];
      const contactEmails = new SibApiV3Sdk.AddContactToList();
      contactEmails.emails = [email];
      
      const result = await contactsApi.addContactToList(targetListId, contactEmails);
      
      console.log(`✅ Contato adicionado à lista ${targetListId} para status ${status}`);
      
      return { 
        success: true, 
        contacts: result.contacts,
        email,
        status,
        listId: targetListId
      };
    } catch (contactError) {
      // Se o contato não existir, criar primeiro
      console.warn(`⚠️ Contato não encontrado no Brevo: ${email}. Criando novo contato...`);
      
      // Criar contato com atributos básicos
      try {
        // Preparar atributos do contato
        const attributes = {
          STATUS: status
        };
        
        // Definir parâmetros para criar contato
        const createContactParams = new SibApiV3Sdk.CreateContact();
        createContactParams.email = email;
        createContactParams.attributes = attributes;
        createContactParams.listIds = [statusListIds[status]];
        
        // Enviar requisição para criar contato
        const result = await contactsApi.createContact(createContactParams);
        
        console.log(`✅ Novo contato criado e adicionado à lista ${statusListIds[status]} para status ${status}`);
        
        return { 
          success: true, 
          id: result.id,
          email,
          status,
          listId: statusListIds[status]
        };
      } catch (createError) {
        console.error(`❌ Erro ao criar contato no Brevo: ${createError.message}`);
        return { 
          success: false, 
          error: createError.message,
          email
        };
      }
    }
  } catch (error) {
    console.error(`❌ Erro ao gerenciar listas para contato ${email}: ${error.message}`);
    return { 
      success: false, 
      error: error.message,
      email,
      status
    };
  }
}

// Função principal para sincronizar todos os usuários com as listas corretas
async function syncUsersToLists() {
  try {
    console.log('🔄 Iniciando sincronização de usuários com listas baseadas em status...');
    
    // Testar conexão com o Supabase
    console.log('🔍 Testando conexão com o Supabase...');
    try {
      const { count, error: countError } = await supabase
        .from('users')
        .select('*', { count: 'exact', head: true });
      
      if (countError) {
        throw new Error(`Teste de conexão falhou: ${countError.message}`);
      }
      console.log(`✅ Conexão com o Supabase funcionando. Total de usuários: ${count}`);
    } catch (testError) {
      console.error('❌ Erro ao testar conexão com o Supabase:', testError);
      throw new Error(`Falha na conexão com o Supabase: ${testError.message}`);
    }
    
    // Buscar todos os usuários no banco
    console.log('🔍 Buscando usuários no Supabase...');
    const { data: users, error } = await supabase
      .from('users')
      .select('id, email, status, full_name')
      .order('created_at', { ascending: false });
    
    if (error) {
      throw new Error(`Erro ao buscar usuários: ${error.message}`);
    }
    
    if (!users || users.length === 0) {
      console.log('⚠️ Nenhum usuário encontrado para sincronizar.');
      return;
    }
    
    console.log(`🔍 Encontrados ${users.length} usuários para sincronizar`);
    
    // Estatísticas por status
    const statusStats = {
      TRIAL: 0,
      ATIVO: 0,
      INATIVO: 0,
      ADMIN: 0,
      outros: 0
    };
    
    // Contar usuários por status
    users.forEach(user => {
      if (!user.status) {
        statusStats.outros++;
      } else if (statusStats[user.status] !== undefined) {
        statusStats[user.status]++;
      } else {
        statusStats.outros++;
      }
    });
    
    // Exibir estatísticas de status
    console.log('📊 Distribuição de usuários por status:');
    Object.entries(statusStats).forEach(([status, count]) => {
      console.log(`- ${status}: ${count} usuários`);
    });
    
    // Lista para armazenar resultados
    const results = {
      total: users.length,
      success: 0,
      failed: 0,
      byStatus: {
        TRIAL: { success: 0, failed: 0 },
        ATIVO: { success: 0, failed: 0 },
        INATIVO: { success: 0, failed: 0 },
        outros: { success: 0, failed: 0 }
      },
      errors: []
    };
    
    // Processar cada usuário
    for (const user of users) {
      try {
        // Ignorar usuários sem email
        if (!user.email) {
          console.warn(`⚠️ Usuário ${user.id} não possui email válido. Ignorando.`);
          continue;
        }
        
        // Ignorar usuários ADMIN (tratar como outros)
        const userStatus = user.status === 'ADMIN' ? 'ATIVO' : user.status;
        
        // Se não tem status válido para listas, ignorar
        if (!userStatus || !statusListIds[userStatus]) {
          console.warn(`⚠️ Usuário ${user.email} com status inválido para listas: ${userStatus}. Ignorando.`);
          continue;
        }
        
        console.log(`📧 Processando usuário: ${user.email} (Status: ${userStatus})`);
        
        // Atualizar listas do usuário baseado no status
        const result = await updateContactListsByStatus(user.email, userStatus);
        
        if (result.success) {
          console.log(`✅ Usuário ${user.email} adicionado à lista para status ${userStatus}`);
          results.success++;
          
          // Contabilizar por status
          const statusKey = statusListIds[userStatus] ? userStatus : 'outros';
          results.byStatus[statusKey].success++;
        } else {
          console.error(`❌ Erro ao adicionar usuário ${user.email} à lista: ${result.error}`);
          results.failed++;
          
          // Contabilizar por status
          const statusKey = statusListIds[userStatus] ? userStatus : 'outros';
          results.byStatus[statusKey].failed++;
          
          results.errors.push({
            email: user.email,
            status: userStatus,
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
    
    console.log('\n📊 Detalhes por status:');
    Object.entries(results.byStatus).forEach(([status, counts]) => {
      console.log(`- ${status}: ✅ ${counts.success} sucessos | ❌ ${counts.failed} falhas`);
    });
    
    if (results.errors.length > 0) {
      console.log('\n❌ Erros encontrados:');
      results.errors.forEach((err, index) => {
        console.log(`${index + 1}. ${err.email} (${err.status || 'sem status'}): ${err.error}`);
      });
    }
    
    return results;
  } catch (error) {
    console.error('❌ Erro na sincronização:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

// Executar a função principal
syncUsersToLists()
  .then(results => {
    console.log('✅ Processo de sincronização concluído!');
    process.exit(0);
  })
  .catch(error => {
    console.error('❌ Erro fatal na execução do script:', error);
    process.exit(1);
  }); 