/**
 * Definição das listas no SendPulse por status
 */
export const SENDPULSE_LIST_IDS = {
  TRIAL: '1',    // Lista para usuários Trial (substitua pelo ID real da lista)
  ATIVO: '2',    // Lista para usuários Ativos (substitua pelo ID real da lista)
  INATIVO: '3',  // Lista para usuários Inativos (substitua pelo ID real da lista)
  ADMIN: '2'     // Admins usam a mesma lista dos usuários ativos
};

/**
 * Obtém a configuração do SendPulse
 */
export function getSendPulseConfig() {
  const clientId = process.env.SENDPULSE_CLIENT_ID || 'a0a1382e3277ea7e04b1e532aa967541';
  const clientSecret = process.env.SENDPULSE_CLIENT_SECRET || '9d6c11ce51069ac1a7a5afe3ef1fcead';
  
  if (!clientId || !clientSecret) {
    throw new Error('API ID ou API Secret do SendPulse não configurados');
  }
  
  return {
    clientId,
    clientSecret,
    trialListId: SENDPULSE_LIST_IDS.TRIAL,
    activeListId: SENDPULSE_LIST_IDS.ATIVO,
    inactiveListId: SENDPULSE_LIST_IDS.INATIVO,
  };
}

/**
 * Obtém um token de acesso para a API do SendPulse
 */
export async function getAccessToken() {
  try {
    const { clientId, clientSecret } = getSendPulseConfig();
    
    const response = await fetch('https://api.sendpulse.com/oauth/access_token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        grant_type: 'client_credentials',
        client_id: clientId,
        client_secret: clientSecret,
      }),
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      console.error('❌ Erro ao obter token de acesso do SendPulse:', errorData);
      throw new Error(`Erro na API do SendPulse: ${errorData.message || 'Erro desconhecido'}`);
    }
    
    const tokenData = await response.json();
    return tokenData.access_token;
  } catch (error) {
    console.error('❌ Exceção ao obter token de acesso do SendPulse:', error);
    throw error;
  }
}

/**
 * Verifica se um contato existe no SendPulse
 */
export async function checkContactExists(email) {
  try {
    const accessToken = await getAccessToken();
    
    // Não existe endpoint direto para verificar se um contato existe no SendPulse
    // Vamos procurar o contato nos livros de endereços
    const response = await fetch(`https://api.sendpulse.com/addressbooks/emails/${encodeURIComponent(email)}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });
    
    if (!response.ok) {
      // Se o status for 404, significa que o contato não existe
      if (response.status === 404) {
        return false;
      }
      
      const errorData = await response.json();
      console.error('❌ Erro ao verificar contato no SendPulse:', errorData);
      return false;
    }
    
    const contactData = await response.json();
    return contactData && contactData.email === email;
  } catch (error) {
    console.error('❌ Exceção ao verificar contato no SendPulse:', error);
    return false;
  }
}

/**
 * Cria um novo contato no SendPulse
 */
export async function createContact(userData) {
  try {
    const accessToken = await getAccessToken();
    const { trialListId, activeListId, inactiveListId } = getSendPulseConfig();
    
    // Determinar qual listId usar baseado no status
    let listId;
    switch (userData.status) {
      case 'TRIAL':
        listId = trialListId;
        break;
      case 'ATIVO':
        listId = activeListId;
        break;
      case 'INATIVO':
        listId = inactiveListId;
        break;
      default:
        return { 
          success: false, 
          error: `Status inválido: ${userData.status}` 
        };
    }
    
    // Preparar variáveis
    const variables = {
      STATUS: userData.status,
      ID: userData.id,
    };
    
    if (userData.name) {
      variables.NOME = userData.name;
      
      // Dividir nome completo em primeiro nome e sobrenome
      const nameParts = userData.name.split(' ');
      variables.FNAME = nameParts[0] || '';
      variables.LNAME = nameParts.slice(1).join(' ') || '';
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
      variables.SMS = whatsapp;
      variables.WHATSAPP = whatsapp;
    }
    
    // Dados para o SendPulse
    const contactData = {
      emails: [
        {
          email: userData.email,
          variables
        }
      ]
    };
    
    // Primeiro, adicionar o contato ao SendPulse
    const createResponse = await fetch('https://api.sendpulse.com/addressbooks/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
      body: JSON.stringify(contactData),
    });
    
    if (!createResponse.ok) {
      const errorData = await createResponse.json();
      console.error('❌ Erro ao criar contato no SendPulse:', errorData);
      return { 
        success: false, 
        error: `Erro na API do SendPulse: ${errorData.message || 'Erro desconhecido'}` 
      };
    }
    
    // Agora, adicionar o contato à lista apropriada
    const addToListResponse = await fetch(`https://api.sendpulse.com/addressbooks/${listId}/emails`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
      body: JSON.stringify(contactData),
    });
    
    if (!addToListResponse.ok) {
      const errorData = await addToListResponse.json();
      console.error('❌ Erro ao adicionar contato à lista no SendPulse:', errorData);
      return { 
        success: false, 
        error: `Erro ao adicionar à lista: ${errorData.message || 'Erro desconhecido'}` 
      };
    }
    
    return { 
      success: true, 
      message: 'Contato criado com sucesso',
      data: await addToListResponse.json() 
    };
  } catch (error) {
    console.error('❌ Exceção ao criar contato no SendPulse:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Erro desconhecido' 
    };
  }
}

/**
 * Atualiza um contato existente no SendPulse
 */
export async function updateContact(userData) {
  try {
    const accessToken = await getAccessToken();
    
    // Preparar variáveis
    const variables = {
      STATUS: userData.status,
      ID: userData.id,
    };
    
    if (userData.name) {
      variables.NOME = userData.name;
      
      // Dividir nome completo em primeiro nome e sobrenome
      const nameParts = userData.name.split(' ');
      variables.FNAME = nameParts[0] || '';
      variables.LNAME = nameParts.slice(1).join(' ') || '';
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
      variables.SMS = whatsapp;
      variables.WHATSAPP = whatsapp;
    }
    
    // Dados para atualização
    const contactData = {
      emails: [
        {
          email: userData.email,
          variables
        }
      ]
    };
    
    // No SendPulse, atualizar um contato é basicamente adicionar novamente
    // com as novas informações
    const response = await fetch('https://api.sendpulse.com/addressbooks/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
      body: JSON.stringify(contactData),
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      return { 
        success: false, 
        error: `Erro ao atualizar contato: ${errorData.message || 'Erro desconhecido'}` 
      };
    }
    
    return { 
      success: true, 
      message: 'Contato atualizado com sucesso' 
    };
  } catch (error) {
    console.error('❌ Exceção ao atualizar contato no SendPulse:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Erro desconhecido' 
    };
  }
}

/**
 * Adiciona um contato a uma lista específica
 */
export async function addContactToList(email, listId) {
  try {
    const accessToken = await getAccessToken();
    console.log(`📥 Tentando adicionar ${email} à lista ${listId}`);
    
    // Dados para adicionar à lista
    const contactData = {
      emails: [email]
    };
    
    // Adicionar o contato à lista
    const response = await fetch(`https://api.sendpulse.com/addressbooks/${listId}/emails`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
      body: JSON.stringify(contactData),
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      console.error(`❌ Erro ao adicionar contato à lista ${listId}:`, errorData);
      return { 
        success: false, 
        error: `Erro ao adicionar à lista: ${errorData.message || 'Erro desconhecido'}` 
      };
    }
    
    console.log(`✅ Contato ${email} adicionado à lista ${listId}`);
    return {
      success: true,
      message: `Contato adicionado à lista ${listId} com sucesso`
    };
  } catch (error) {
    console.error(`❌ Exceção ao adicionar contato à lista ${listId}:`, error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Erro desconhecido' 
    };
  }
}

/**
 * Remove um contato de uma lista específica
 */
export async function removeContactFromList(email, listId) {
  try {
    const accessToken = await getAccessToken();
    console.log(`🗑️ Tentando remover ${email} da lista ${listId}`);
    
    // Dados para remover da lista
    const contactData = {
      emails: [email]
    };
    
    // Remover o contato da lista
    const response = await fetch(`https://api.sendpulse.com/addressbooks/${listId}/emails/delete`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
      body: JSON.stringify(contactData),
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      console.error(`❌ Erro ao remover contato da lista ${listId}:`, errorData);
      return { 
        success: false, 
        error: `Erro ao remover da lista: ${errorData.message || 'Erro desconhecido'}` 
      };
    }
    
    console.log(`✅ Contato ${email} removido da lista ${listId}`);
    return {
      success: true,
      message: `Contato removido da lista ${listId} com sucesso`
    };
  } catch (error) {
    console.error(`❌ Exceção ao remover contato da lista ${listId}:`, error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Erro desconhecido' 
    };
  }
}

/**
 * Atualiza um contato e gerencia suas listas de acordo com o status
 */
export async function updateContactAndLists(userData) {
  try {
    const { trialListId, activeListId, inactiveListId } = getSendPulseConfig();
    
    // Primeiro, atualizar os atributos do contato
    const updateResult = await updateContact(userData);
    if (!updateResult.success) {
      return updateResult;
    }
    
    // Determinar qual listId usar baseado no status
    let targetListId;
    switch (userData.status) {
      case 'TRIAL':
        targetListId = trialListId;
        break;
      case 'ATIVO':
        targetListId = activeListId;
        break;
      case 'INATIVO':
        targetListId = inactiveListId;
        break;
      default:
        return { 
          success: false, 
          error: `Status inválido: ${userData.status}` 
        };
    }
    
    // Adicionar o contato à lista correta
    const addResult = await addContactToList(userData.email, targetListId);
    if (!addResult.success) {
      return addResult;
    }
    
    // Remover o contato das outras listas
    for (const [status, listId] of Object.entries(SENDPULSE_LIST_IDS)) {
      if (listId !== targetListId) {
        await removeContactFromList(userData.email, listId);
      }
    }
    
    return { 
      success: true, 
      message: `Contato atualizado e movido para a lista de ${userData.status}`,
      data: {
        updated: true,
        targetList: targetListId
      }
    };
  } catch (error) {
    console.error('❌ Exceção ao atualizar contato e listas no SendPulse:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Erro desconhecido' 
    };
  }
}

/**
 * Função principal para sincronizar um usuário com o SendPulse
 */
export async function syncUserWithSendPulse(userData) {
  try {
    console.log('🔄 Iniciando sincronização com SendPulse para:', userData.email);
    
    // Verificar se as credenciais estão configuradas
    try {
      getSendPulseConfig();
    } catch (configError) {
      console.error('❌ ' + configError.message);
      return { 
        success: false, 
        error: configError.message 
      };
    }
    
    // Verificar se o contato já existe
    const contactExists = await checkContactExists(userData.email);
    console.log(`📋 Contato ${userData.email} existe no SendPulse? ${contactExists ? 'Sim' : 'Não'}`);
    
    // Determinar qual listId usar baseado no status
    const { trialListId, activeListId, inactiveListId } = getSendPulseConfig();
    let targetListId;
    switch (userData.status) {
      case 'TRIAL':
        targetListId = trialListId;
        break;
      case 'ATIVO':
        targetListId = activeListId;
        break;
      case 'INATIVO':
        targetListId = inactiveListId;
        break;
      default:
        console.error(`❌ Status inválido: ${userData.status}`);
        return { 
          success: false, 
          error: `Status inválido: ${userData.status}` 
        };
    }
    
    console.log(`🎯 Lista alvo para status ${userData.status}: ${targetListId}`);
    
    if (contactExists) {
      // Atualizar contato existente e gerenciar suas listas
      return await updateContactAndLists(userData);
    } else {
      // Criar novo contato
      return await createContact(userData);
    }
  } catch (error) {
    console.error('❌ Exceção ao sincronizar usuário com o SendPulse:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Erro desconhecido' 
    };
  }
}

// Alias para compatibilidade com o código existente
export const syncUserWithBrevo = syncUserWithSendPulse; 