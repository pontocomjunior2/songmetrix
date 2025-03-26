/**
 * Definição das listas no Brevo por status
 */
export const BREVO_LIST_IDS = {
  TRIAL: '7',    // Lista para usuários Trial
  ATIVO: '8',    // Lista para usuários Ativos
  INATIVO: '9',  // Lista para usuários Inativos
  ADMIN: '8'     // Admins usam a mesma lista dos usuários ativos
};

/**
 * Obtém a configuração do Brevo
 */
export function getBrevoConfig() {
  const apiKey = process.env.BREVO_API_KEY;
  if (!apiKey) {
    throw new Error('API Key do Brevo não configurada');
  }
  
  return {
    apiKey,
    trialListId: BREVO_LIST_IDS.TRIAL,
    activeListId: BREVO_LIST_IDS.ATIVO,
    inactiveListId: BREVO_LIST_IDS.INATIVO,
  };
}

/**
 * Verifica se um contato existe no Brevo
 */
export async function checkContactExists(email) {
  try {
    const { apiKey } = getBrevoConfig();
    
    const response = await fetch(`https://api.brevo.com/v3/contacts/${encodeURIComponent(email)}`, {
      method: 'GET',
      headers: {
        'api-key': apiKey,
      },
    });
    
    return response.ok;
  } catch (error) {
    console.error('Erro ao verificar contato no Brevo:', error);
    return false;
  }
}

/**
 * Cria um novo contato no Brevo
 */
export async function createContact(userData) {
  try {
    const { apiKey } = getBrevoConfig();
    
    // Determinar qual listId usar baseado no status
    const listId = BREVO_LIST_IDS[userData.status];
    if (!listId) {
      return { 
        success: false, 
        error: `Status inválido: ${userData.status}` 
      };
    }
    
    // Preparar atributos
    const attributes = {
      STATUS: userData.status,
      ID: userData.id,
    };
    
    if (userData.name) {
      attributes.NOME = userData.name;
      
      // Dividir nome completo em primeiro nome e sobrenome
      const nameParts = userData.name.split(' ');
      attributes.FNAME = nameParts[0] || '';
      attributes.LNAME = nameParts.slice(1).join(' ') || '';
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
    
    // Dados para o Brevo
    const contactData = {
      email: userData.email,
      attributes,
      listIds: [parseInt(listId, 10)],
      updateEnabled: true,
    };
    
    // Chamada para a API do Brevo
    const response = await fetch('https://api.brevo.com/v3/contacts', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': apiKey,
      },
      body: JSON.stringify(contactData),
    });
    
    const responseData = await response.json();
    
    if (!response.ok) {
      // Verificar se o erro é de contato já existente
      if (response.status === 400 && 
          responseData.code === 'duplicate_parameter' && 
          responseData.message?.includes('Contact already exist')) {
        // Tentar atualizar o contato existente e adicionar à lista
        return await updateContactAndLists(userData);
      }
      
      return { 
        success: false, 
        error: `Erro na API do Brevo: ${responseData.message || 'Erro desconhecido'}` 
      };
    }
    
    return { 
      success: true, 
      message: 'Contato criado com sucesso',
      data: responseData 
    };
  } catch (error) {
    console.error('Exceção ao criar contato no Brevo:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Erro desconhecido' 
    };
  }
}

/**
 * Atualiza um contato existente no Brevo
 */
export async function updateContact(userData) {
  try {
    const { apiKey } = getBrevoConfig();
    
    // Preparar atributos
    const attributes = {
      STATUS: userData.status,
      ID: userData.id,
    };
    
    if (userData.name) {
      attributes.NOME = userData.name;
      
      // Dividir nome completo em primeiro nome e sobrenome
      const nameParts = userData.name.split(' ');
      attributes.FNAME = nameParts[0] || '';
      attributes.LNAME = nameParts.slice(1).join(' ') || '';
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
    
    // Dados para atualização
    const updateData = {
      attributes,
      emailBlacklisted: false,
    };
    
    // Chamada para a API do Brevo
    const response = await fetch(`https://api.brevo.com/v3/contacts/${encodeURIComponent(userData.email)}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'api-key': apiKey,
      },
      body: JSON.stringify(updateData),
    });
    
    if (!response.ok) {
      const responseData = await response.json();
      return { 
        success: false, 
        error: `Erro ao atualizar contato: ${responseData.message || 'Erro desconhecido'}` 
      };
    }
    
    return { 
      success: true, 
      message: 'Contato atualizado com sucesso' 
    };
  } catch (error) {
    console.error('Exceção ao atualizar contato no Brevo:', error);
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
    const { apiKey } = getBrevoConfig();
    console.log(`📥 Tentando adicionar ${email} à lista ${listId}`);
    
    // Primeiro, verificar se o contato já está na lista
    const checkResponse = await fetch(`https://api.brevo.com/v3/contacts/lists/${listId}/contacts`, {
      method: 'GET',
      headers: {
        'api-key': apiKey,
      },
    });
    
    const checkData = await checkResponse.json();
    const isInList = checkData.contacts?.some(contact => contact.email === email);
    
    if (isInList) {
      console.log(`✅ Contato ${email} já está na lista ${listId}`);
      return {
        success: true,
        message: 'Contato já está na lista'
      };
    }
    
    // Se não estiver na lista, adicionar
    const response = await fetch(`https://api.brevo.com/v3/contacts/lists/${listId}/contacts/add`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': apiKey,
      },
      body: JSON.stringify({
        emails: [email],
      }),
    });
    
    const responseData = await response.json();
    
    if (!response.ok) {
      console.error(`❌ Erro ao adicionar à lista ${listId}:`, responseData);
      return { 
        success: false, 
        error: `Erro ao adicionar contato à lista: ${responseData.message || 'Erro desconhecido'}` 
      };
    }
    
    console.log(`✅ Contato ${email} adicionado com sucesso à lista ${listId}`);
    return { 
      success: true, 
      message: 'Contato adicionado à lista com sucesso',
      data: responseData
    };
  } catch (error) {
    console.error('❌ Exceção ao adicionar contato à lista no Brevo:', error);
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
    const { apiKey } = getBrevoConfig();
    console.log(`📤 Tentando remover ${email} da lista ${listId}`);
    
    // Primeiro, verificar se o contato está na lista
    const checkResponse = await fetch(`https://api.brevo.com/v3/contacts/lists/${listId}/contacts`, {
      method: 'GET',
      headers: {
        'api-key': apiKey,
      },
    });
    
    const checkData = await checkResponse.json();
    const isInList = checkData.contacts?.some(contact => contact.email === email);
    
    if (!isInList) {
      console.log(`ℹ️ Contato ${email} não está na lista ${listId}, não é necessário remover`);
      return { 
        success: true, 
        message: 'Contato não está na lista' 
      };
    }
    
    // Se estiver na lista, remover
    const response = await fetch(`https://api.brevo.com/v3/contacts/lists/${listId}/contacts/remove`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': apiKey,
      },
      body: JSON.stringify({
        emails: [email],
      }),
    });
    
    const responseData = await response.json();
    
    if (!response.ok) {
      console.error(`❌ Erro ao remover da lista ${listId}:`, responseData);
      return { 
        success: false, 
        error: `Erro ao remover contato da lista: ${responseData.message || 'Erro desconhecido'}` 
      };
    }
    
    console.log(`✅ Contato ${email} removido com sucesso da lista ${listId}`);
    return { 
      success: true, 
      message: 'Contato removido da lista com sucesso',
      data: responseData
    };
  } catch (error) {
    console.error('❌ Exceção ao remover contato da lista no Brevo:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Erro desconhecido' 
    };
  }
}

/**
 * Atualiza um contato e gerencia suas listas no Brevo
 */
export async function updateContactAndLists(userData) {
  try {
    // Primeiro, atualizar os atributos do contato
    const updateResult = await updateContact(userData);
    if (!updateResult.success) {
      return updateResult;
    }
    
    // Determinar qual listId usar baseado no status
    const targetListId = BREVO_LIST_IDS[userData.status];
    if (!targetListId) {
      return { 
        success: false, 
        error: `Status inválido: ${userData.status}` 
      };
    }
    
    // Remover o contato de todas as outras listas
    for (const [status, listId] of Object.entries(BREVO_LIST_IDS)) {
      // Só remover de listas diferentes da lista alvo
      if (listId !== targetListId) {
        await removeContactFromList(userData.email, listId);
      }
    }
    
    // Adicionar o contato à lista correta
    const addResult = await addContactToList(userData.email, targetListId);
    if (!addResult.success) {
      return addResult;
    }
    
    return { 
      success: true, 
      message: `Contato atualizado e movido para a lista de ${userData.status}`
    };
  } catch (error) {
    console.error('Exceção ao atualizar contato e listas no Brevo:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Erro desconhecido' 
    };
  }
}

/**
 * Sincroniza um usuário com o Brevo baseado em seus dados e status
 * Esta é a função principal que deve ser chamada ao criar novos usuários
 * ou ao atualizar o status de usuários existentes
 */
export async function syncUserWithBrevo(userData) {
  try {
    console.log('🔄 Iniciando sincronização com Brevo para:', userData.email);
    
    // Verificar se a API Key do Brevo está configurada
    if (!process.env.BREVO_API_KEY) {
      console.error('❌ API Key do Brevo não configurada');
      return { 
        success: false, 
        error: 'API Key do Brevo não configurada. Contate o administrador do sistema.' 
      };
    }
    
    // Verificar se o contato já existe
    const contactExists = await checkContactExists(userData.email);
    console.log(`📋 Contato ${userData.email} existe no Brevo? ${contactExists ? 'Sim' : 'Não'}`);
    
    // Determinar qual listId usar baseado no status
    const targetListId = BREVO_LIST_IDS[userData.status];
    if (!targetListId) {
      console.error(`❌ Status inválido: ${userData.status}`);
      return { 
        success: false, 
        error: `Status inválido: ${userData.status}` 
      };
    }
    
    console.log(`🎯 Lista alvo para status ${userData.status}: ${targetListId}`);
    
    // Preparar atributos
    const attributes = {
      STATUS: userData.status,
      ID: userData.id,
    };
    
    if (userData.name) {
      attributes.NOME = userData.name;
      
      // Dividir nome completo em primeiro nome e sobrenome
      const nameParts = userData.name.split(' ');
      attributes.FNAME = nameParts[0] || '';
      attributes.LNAME = nameParts.slice(1).join(' ') || '';
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
    
    if (contactExists) {
      // Atualizar contato existente
      console.log(`📝 Atualizando contato existente ${userData.email}`);
      
      // Primeiro, atualizar os atributos
      const updateResult = await updateContact(userData);
      if (!updateResult.success) {
        console.error(`❌ Falha ao atualizar contato: ${updateResult.error}`);
        return updateResult;
      }
      
      console.log(`✅ Contato atualizado com sucesso`);
      
      // Remover o contato de todas as outras listas
      for (const [status, listId] of Object.entries(BREVO_LIST_IDS)) {
        if (listId !== targetListId) {
          console.log(`🔄 Removendo de outras listas: ${listId}`);
          await removeContactFromList(userData.email, listId);
        }
      }
      
      // Adicionar o contato à lista correta
      console.log(`📥 Adicionando à lista alvo: ${targetListId}`);
      const addResult = await addContactToList(userData.email, targetListId);
      if (!addResult.success) {
        console.error(`❌ Falha ao adicionar à lista: ${addResult.error}`);
        return addResult;
      }
      
      console.log(`✅ Sincronização concluída com sucesso`);
      return { 
        success: true, 
        message: `Contato atualizado e movido para a lista de ${userData.status}`,
        data: {
          updated: true,
          targetList: targetListId
        }
      };
    } else {
      // Criar novo contato
      console.log(`➕ Criando novo contato ${userData.email}`);
      
      // Dados para o Brevo
      const contactData = {
        email: userData.email,
        attributes,
        listIds: [parseInt(targetListId, 10)],
        updateEnabled: true,
      };
      
      console.log('📤 Dados do contato:', JSON.stringify(contactData, null, 2));
      
      // Chamada para a API do Brevo
      const response = await fetch('https://api.brevo.com/v3/contacts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'api-key': process.env.BREVO_API_KEY,
        },
        body: JSON.stringify(contactData),
      });
      
      const responseData = await response.json();
      
      if (!response.ok) {
        console.error(`❌ Erro na API do Brevo:`, responseData);
        return { 
          success: false, 
          error: `Erro na API do Brevo: ${responseData.message || 'Erro desconhecido'}` 
        };
      }
      
      console.log(`✅ Novo contato criado com sucesso`);
      return { 
        success: true, 
        message: 'Contato criado com sucesso',
        data: {
          created: true,
          targetList: targetListId,
          ...responseData
        }
      };
    }
  } catch (error) {
    console.error('❌ Exceção ao sincronizar usuário com o Brevo:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Erro desconhecido' 
    };
  }
} 