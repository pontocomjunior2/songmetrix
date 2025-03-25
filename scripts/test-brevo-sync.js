/**
 * Script para testar manualmente a sincronização de usuários com o Brevo
 * Este script sincroniza um usuário específico ou todos os usuários TRIAL
 */
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import SibApiV3Sdk from 'sib-api-v3-sdk';

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

// Função para criar ou atualizar contato no Brevo
async function createOrUpdateContact({ email, fullName, status }) {
  try {
    console.log(`📧 Criando/atualizando contato: ${email}`);
    
    // Instanciar API de contatos
    const contactsApi = new SibApiV3Sdk.ContactsApi();
    
    // Preparar atributos do contato
    const attributes = {};
    
    if (fullName) {
      // Dividir nome completo em primeiro nome e sobrenome
      const nameParts = fullName.split(' ');
      attributes.FNAME = nameParts[0] || '';
      attributes.LNAME = nameParts.slice(1).join(' ') || '';
      attributes.NOME = fullName;
    }
    
    if (status) {
      attributes.STATUS = status;
    }
    
    // Definir parâmetros para criar/atualizar contato
    const createContactParams = new SibApiV3Sdk.CreateContact();
    createContactParams.email = email;
    createContactParams.attributes = attributes;
    
    // Adicionar à lista correta com base no status
    if (status && statusListIds[status]) {
      createContactParams.listIds = [statusListIds[status]];
      console.log(`📋 Adicionando à lista ${statusListIds[status]} para status ${status}`);
    }
    
    createContactParams.updateEnabled = true; // Atualizar se já existir
    
    // Enviar requisição para criar/atualizar contato
    const result = await contactsApi.createContact(createContactParams);
    
    console.log(`✅ Contato criado/atualizado com sucesso: ${email}`);
    
    return { 
      success: true, 
      id: result.id,
      email
    };
  } catch (error) {
    console.error(`❌ Erro ao criar/atualizar contato: ${error.message}`);
    return { 
      success: false, 
      error: error.message,
      email
    };
  }
}

// Função principal para testar a sincronização
async function testBrevoSync() {
  try {
    console.log('🔄 Iniciando teste de sincronização com Brevo...');
    
    // Buscar usuários TRIAL para sincronizar
    console.log('🔍 Buscando usuários TRIAL no Supabase...');
    const { data: users, error } = await supabase
      .from('users')
      .select('id, email, full_name, status')
      .eq('status', 'TRIAL')
      .limit(5); // Limitar a 5 usuários para teste
    
    if (error) {
      throw new Error(`Erro ao buscar usuários: ${error.message}`);
    }
    
    if (!users || users.length === 0) {
      console.log('⚠️ Nenhum usuário TRIAL encontrado para sincronizar.');
      return;
    }
    
    console.log(`🔍 Encontrados ${users.length} usuários TRIAL para teste`);
    
    // Lista para armazenar resultados
    const results = {
      total: users.length,
      success: 0,
      failed: 0,
      errors: []
    };
    
    // Processar cada usuário
    for (const user of users) {
      try {
        console.log(`📧 Sincronizando usuário: ${user.email}`);
        
        // Criar/atualizar contato no Brevo
        const result = await createOrUpdateContact({
          email: user.email,
          fullName: user.full_name,
          status: user.status
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
    console.log('\n📊 Resumo do teste de sincronização:');
    console.log(`✅ Sucesso: ${results.success} de ${results.total}`);
    console.log(`❌ Falhas: ${results.failed} de ${results.total}`);
    
    if (results.errors.length > 0) {
      console.log('\n❌ Erros encontrados:');
      results.errors.forEach((err, index) => {
        console.log(`${index + 1}. ${err.email}: ${err.error}`);
      });
    }
    
    console.log('\n✅ Teste de sincronização concluído!');
  } catch (error) {
    console.error('❌ Erro durante o teste de sincronização:', error);
  }
}

// Executar o teste
testBrevoSync(); 