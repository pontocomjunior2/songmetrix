import { env } from 'process';

/**
 * Interface para representar dados do usuário
 */
export interface UserData {
  id: string;
  email: string;
  name?: string;
  status: string;
  whatsapp?: string;
}

/**
 * Interface de resposta das operações do Brevo
 */
export interface SyncResponse {
  success: boolean;
  message?: string;
  error?: string;
  data?: any;
}

/**
 * Interface para resposta da API do Brevo
 */
interface BrevoApiResponse {
  id?: number;
  code?: string;
  message?: string;
}

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
export async function checkContactExists(email: string): Promise<boolean> {
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
export async function createContact(userData: UserData): Promise<SyncResponse> {
  try {
    const { apiKey } = getBrevoConfig();
    
    // Determinar qual listId usar baseado no status
    const listId = BREVO_LIST_IDS[userData.status as keyof typeof BREVO_LIST_IDS];
    if (!listId) {
      return { 
        success: false, 
        error: `Status inválido: ${userData.status}` 
      };
    }
    
    // Preparar atributos
    const attributes: Record<string, any> = {
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
    
    const responseData = await response.json() as BrevoApiResponse;
    
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
export async function updateContact(userData: UserData): Promise<SyncResponse> {
  try {
    const { apiKey } = getBrevoConfig();
    
    // Preparar atributos
    const attributes: Record<string, any> = {
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
      const responseData = await response.json() as BrevoApiResponse;
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
export async function addContactToList(email: string, listId: string): Promise<SyncResponse> {
  try {
    const { apiKey } = getBrevoConfig();
    
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
    
    if (!response.ok) {
      const responseText = await response.text();
      
      // Verificar se o erro é que o contato já está na lista
      if (responseText.includes('already in list')) {
        return {
          success: true,
          message: 'Contato já está na lista'
        };
      }
      
      return { 
        success: false, 
        error: `Erro ao adicionar contato à lista: ${responseText}` 
      };
    }
    
    return { 
      success: true, 
      message: 'Contato adicionado à lista com sucesso' 
    };
  } catch (error) {
    console.error('Exceção ao adicionar contato à lista no Brevo:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Erro desconhecido' 
    };
  }
}

/**
 * Remove um contato de uma lista específica
 */
export async function removeContactFromList(email: string, listId: string): Promise<SyncResponse> {
  try {
    const { apiKey } = getBrevoConfig();
    
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
    
    // Não precisamos tratar erros aqui, pois remover um contato de uma lista
    // que ele já não está não é um problema
    
    return { 
      success: true, 
      message: 'Operação de remoção da lista processada' 
    };
  } catch (error) {
    console.error('Exceção ao remover contato da lista no Brevo:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Erro desconhecido' 
    };
  }
}

/**
 * Atualiza um contato e gerencia suas listas no Brevo
 */
export async function updateContactAndLists(userData: UserData): Promise<SyncResponse> {
  try {
    // Primeiro, atualizar os atributos do contato
    const updateResult = await updateContact(userData);
    if (!updateResult.success) {
      return updateResult;
    }
    
    // Determinar qual listId usar baseado no status
    const targetListId = BREVO_LIST_IDS[userData.status as keyof typeof BREVO_LIST_IDS];
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
export async function syncUserWithBrevo(userData: UserData): Promise<SyncResponse> {
  try {
    // Verificar se o contato já existe
    const contactExists = await checkContactExists(userData.email);
    
    if (contactExists) {
      // Atualizar contato existente e suas listas
      return await updateContactAndLists(userData);
    } else {
      // Criar novo contato
      return await createContact(userData);
    }
  } catch (error) {
    console.error('Exceção ao sincronizar usuário com o Brevo:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Erro desconhecido' 
    };
  }
} 