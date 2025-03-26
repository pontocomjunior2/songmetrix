import fetch from 'node-fetch';

// Interface para os dados do usuário
interface UserData {
  email: string;
  status: string;
  name?: string;
}

// Interface para resposta da sincronização
interface SyncResponse {
  success: boolean;
  error?: string;
  data?: any;
}

// Interface para resposta da API do Brevo
interface BrevoApiResponse {
  code?: string;
  message?: string;
  [key: string]: any;
}

/**
 * Obtém as variáveis de ambiente para configuração do Brevo
 */
const getBrevoConfig = () => {
  const apiKey = process.env.VITE_BREVO_API_KEY || process.env.BREVO_API_KEY;
  const trialListId = process.env.VITE_BREVO_TRIAL_LIST_ID || 
                      process.env.BREVO_TRIAL_LIST_ID || 
                      '7'; // Lista padrão para TRIAL

  if (!apiKey) {
    throw new Error('API Key do Brevo não configurada. Verifique VITE_BREVO_API_KEY ou BREVO_API_KEY no .env');
  }

  return { apiKey, trialListId };
};

/**
 * Adiciona um usuário a uma lista específica no Brevo
 * Para usuários TRIAL, adiciona à lista TRIAL_LIST_ID
 */
export async function addUserToBrevoList(userData: UserData): Promise<SyncResponse> {
  try {
    const { apiKey, trialListId } = getBrevoConfig();
    
    // Determinar o listId com base no status
    let listId = trialListId;
    
    // Se houver necessidade de outras listas, pode-se expandir aqui
    // switch (userData.status) {
    //   case 'TRIAL':
    //     listId = trialListId;
    //     break;
    //   // Adicionar outras listas conforme necessário
    // }

    // Dados para o Brevo
    const contactData = {
      email: userData.email,
      attributes: {
        STATUS: userData.status,
        NAME: userData.name || '',
      },
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
      console.error('Erro ao adicionar usuário ao Brevo:', responseData);
      
      // Verificar se o erro é de contato já existente
      if (response.status === 400 && 
          responseData.code === 'duplicate_parameter' && 
          responseData.message?.includes('Contact already exist')) {
        // Tentar atualizar o contato existente e adicionar à lista
        return await updateExistingContact(userData, listId);
      }
      
      return { 
        success: false, 
        error: `Erro na API do Brevo: ${responseData.message || 'Erro desconhecido'}` 
      };
    }

    return { 
      success: true, 
      data: responseData 
    };
  } catch (error) {
    console.error('Exceção ao adicionar usuário ao Brevo:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Erro desconhecido'
    };
  }
}

/**
 * Atualiza um contato existente no Brevo e adiciona-o à lista correta
 */
async function updateExistingContact(userData: UserData, listId: string): Promise<SyncResponse> {
  try {
    const { apiKey } = getBrevoConfig();
    
    // Dados para atualização
    const updateData = {
      attributes: {
        STATUS: userData.status,
        NAME: userData.name || '',
      },
      listIds: [parseInt(listId, 10)],
    };

    // Chamada para a API do Brevo para atualizar o contato
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
      console.error('Erro ao atualizar contato no Brevo:', responseData);
      return { 
        success: false, 
        error: `Erro ao atualizar contato: ${responseData.message || 'Erro desconhecido'}` 
      };
    }

    return { 
      success: true, 
      data: { message: 'Contato atualizado e adicionado à lista' } 
    };
  } catch (error) {
    console.error('Exceção ao atualizar contato no Brevo:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Erro desconhecido'
    };
  }
} 