/**
 * Script para forçar a sincronização de um usuário específico com o Brevo
 * Útil para testes ou quando for necessário mover manualmente um usuário entre listas
 * 
 * Uso: node scripts/force-sync-brevo.js <email> [status]
 * Exemplo: node scripts/force-sync-brevo.js usuario@exemplo.com ATIVO
 */
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import SibApiV3Sdk from 'sib-api-v3-sdk';

// Carregar variáveis de ambiente
dotenv.config();

// Obter argumentos da linha de comando
const userEmail = process.argv[2];
const forceStatus = process.argv[3];

if (!userEmail) {
  console.error('❌ Email do usuário não fornecido');
  console.log('Uso: node scripts/force-sync-brevo.js <email> [status]');
  console.log('Exemplo: node scripts/force-sync-brevo.js usuario@exemplo.com ATIVO');
  process.exit(1);
}

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

// Função para sincronizar diretamente via API REST em vez do SDK
async function syncUserToBrevoREST(email, status, attributes) {
  try {
    console.log('🔄 Usando API REST direta para sincronização...');
    
    // Determinar a lista alvo para o status
    const targetListId = statusListIds[status];
    
    // Verificar se o contato já existe
    console.log(`🔍 Verificando se o contato já existe: ${email}`);
    try {
      const existingContactResponse = await fetch(`https://api.brevo.com/v3/contacts/${encodeURIComponent(email)}`, {
        method: 'GET',
        headers: {
          'api-key': brevoApiKey,
          'Content-Type': 'application/json'
        }
      });
      
      if (existingContactResponse.ok) {
        const contactData = await existingContactResponse.json();
        console.log(`✅ Contato encontrado (ID: ${contactData.id})`);
        
        // Atualizar atributos
        console.log('📝 Atualizando atributos do contato...');
        const updateResponse = await fetch(`https://api.brevo.com/v3/contacts/${encodeURIComponent(email)}`, {
          method: 'PUT',
          headers: {
            'api-key': brevoApiKey,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            attributes: attributes
          })
        });
        
        if (!updateResponse.ok) {
          console.warn(`⚠️ Falha ao atualizar atributos: ${updateResponse.status}`);
          console.warn(await updateResponse.text());
        } else {
          console.log('✅ Atributos atualizados com sucesso');
        }
        
        // Remover de todas as listas
        console.log('🗑️ Removendo contato de todas as listas...');
        for (const listId of Object.values(statusListIds)) {
          try {
            const removeResponse = await fetch(`https://api.brevo.com/v3/contacts/lists/${listId}/contacts/remove`, {
              method: 'POST',
              headers: {
                'api-key': brevoApiKey,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                emails: [email]
              })
            });
            
            if (removeResponse.ok) {
              console.log(`✅ Contato removido da lista ${listId}`);
            } else {
              console.log(`⚠️ Nota: falha ao remover da lista ${listId} (provavelmente não estava nela)`);
            }
          } catch (err) {
            console.warn(`⚠️ Erro ao remover da lista ${listId}: ${err.message}`);
          }
          
          // Pequena pausa para evitar rate limits
          await new Promise(resolve => setTimeout(resolve, 100));
        }
        
        // Adicionar à lista correta
        console.log(`📋 Adicionando contato à lista ${targetListId} para status ${status}...`);
        const addResponse = await fetch(`https://api.brevo.com/v3/contacts/lists/${targetListId}/contacts/add`, {
          method: 'POST',
          headers: {
            'api-key': brevoApiKey,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            emails: [email]
          })
        });
        
        if (addResponse.ok) {
          console.log(`✅ Contato adicionado à lista ${targetListId} com sucesso`);
          return {
            success: true,
            message: `Usuário sincronizado com sucesso e adicionado à lista para status ${status}`,
            email: email,
            status: status,
            listId: targetListId
          };
        } else {
          const addError = await addResponse.text();
          throw new Error(`Falha ao adicionar à lista ${targetListId}: ${addResponse.status} - ${addError}`);
        }
      } else {
        // Contato não existe, vamos criar
        console.log(`⚠️ Contato não encontrado. Criando novo contato...`);
        
        const createResponse = await fetch('https://api.brevo.com/v3/contacts', {
          method: 'POST',
          headers: {
            'api-key': brevoApiKey,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            email: email,
            attributes: attributes,
            listIds: [targetListId],
            updateEnabled: true
          })
        });
        
        if (createResponse.ok) {
          const createResult = await createResponse.json();
          console.log(`✅ Novo contato criado com sucesso (ID: ${createResult.id})`);
          return {
            success: true,
            message: `Novo contato criado e adicionado à lista para status ${status}`,
            email: email,
            status: status,
            listId: targetListId
          };
        } else {
          const createError = await createResponse.text();
          throw new Error(`Falha ao criar contato: ${createResponse.status} - ${createError}`);
        }
      }
    } catch (error) {
      throw error;
    }
  } catch (error) {
    console.error(`❌ Erro na API REST do Brevo: ${error.message}`);
    return {
      success: false,
      error: error.message,
      email: email
    };
  }
}

// Função para sincronizar um usuário específico com o Brevo
async function syncUserToBrevo(email, forceStatus = null) {
  try {
    console.log(`🔍 Buscando dados do usuário: ${email}`);
    
    // Buscar dados do usuário no Supabase
    const { data: userData, error } = await supabase
      .from('users')
      .select('id, email, full_name, status, created_at, whatsapp')
      .eq('email', email)
      .single();
    
    if (error) {
      throw new Error(`Erro ao buscar usuário: ${error.message}`);
    }
    
    if (!userData) {
      throw new Error(`Usuário não encontrado: ${email}`);
    }
    
    console.log(`✅ Usuário encontrado: ${userData.full_name || userData.email}`);
    console.log(`📊 Status atual: ${userData.status}`);
    
    // Usar o status forçado se fornecido
    const userStatus = forceStatus || userData.status;
    
    if (forceStatus && forceStatus !== userData.status) {
      console.log(`⚠️ Usando status forçado: ${forceStatus} (diferente do status atual: ${userData.status})`);
    }
    
    // Determinar a lista alvo com base no status
    const targetListId = statusListIds[userStatus];
    
    if (!targetListId) {
      throw new Error(`Status inválido para gerenciamento de listas: ${userStatus}`);
    }
    
    console.log(`📋 Lista alvo para status ${userStatus}: ${targetListId}`);
    
    // Preparar atributos do contato
    const attributes = {};
    
    if (userData.full_name) {
      // Dividir nome completo em primeiro nome e sobrenome
      const nameParts = userData.full_name.split(' ');
      attributes.FNAME = nameParts[0] || '';
      attributes.LNAME = nameParts.slice(1).join(' ') || '';
      attributes.NOME = userData.full_name;
    }
    
    if (userData.whatsapp) {
      // Remover caracteres não numéricos e adicionar prefixo se necessário
      let whatsapp = userData.whatsapp.replace(/\D/g, '');
      if (!whatsapp.startsWith('+')) {
        // Se não começar com +, adicionar código do Brasil
        if (!whatsapp.startsWith('55')) {
          whatsapp = '55' + whatsapp;
        }
      }
      attributes.SMS = whatsapp;
      attributes.WHATSAPP = whatsapp;
    }
    
    // Adicionar o status atual aos atributos
    attributes.STATUS = userStatus;
    
    if (userData.created_at) {
      attributes.DATA_CADASTRO = new Date(userData.created_at).toISOString().split('T')[0];
    }
    
    // Sincronizar usando a API REST direta, que é mais confiável
    return await syncUserToBrevoREST(email, userStatus, attributes);
  } catch (error) {
    console.error(`❌ Erro ao sincronizar usuário com o Brevo: ${error.message}`);
    return {
      success: false,
      error: error.message,
      email
    };
  }
}

// Executar a função principal
syncUserToBrevo(userEmail, forceStatus)
  .then(result => {
    if (result.success) {
      console.log('\n✅ Operação concluída com sucesso:');
      console.log(`📧 Email: ${result.email}`);
      console.log(`📊 Status: ${result.status}`);
      console.log(`📋 Lista: ${result.listId}`);
    } else {
      console.error('\n❌ Falha na operação:');
      console.error(`📧 Email: ${result.email}`);
      console.error(`❌ Erro: ${result.error}`);
    }
    process.exit(result.success ? 0 : 1);
  })
  .catch(error => {
    console.error('❌ Erro fatal:', error);
    process.exit(1);
  }); 