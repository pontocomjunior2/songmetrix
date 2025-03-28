/**
 * Definição das listas no SendPulse por status
 */
export const SENDPULSE_LIST_IDS = {
  TRIAL: '152167',    // Lista para usuários Trial
  ATIVO: '152197',    // Lista para usuários Ativos
  INATIVO: '152198',  // Lista para usuários Inativos
  ADMIN: '152197'     // Admins usam a mesma lista dos usuários ativos
};

// Cache para armazenar o token e reduzir requisições à API
const tokenCache = {
  token: null,
  expiresAt: 0
};

/**
 * Obter configuração da API do SendPulse com fallbacks
 */
export function getSendPulseConfig() {
  try {
    // Usar variáveis de ambiente
    const id = process.env.SENDPULSE_CLIENT_ID || process.env.BREVO_API_KEY || '';
    const secret = process.env.SENDPULSE_CLIENT_SECRET || process.env.BREVO_SECRET_KEY || '';
    
    // Verificar se temos as informações necessárias
    if (!id || !secret) {
      console.warn('⚠️ Credenciais do SendPulse não encontradas nas variáveis de ambiente');
    }
    
    // Retornar objeto formatado para compatibilidade com getAccessToken
    return {
      id,
      secret
    };
  } catch (error) {
    console.error('❌ Erro ao obter configuração do SendPulse:', error);
    return { id: '', secret: '' };
  }
}

/**
 * Obtém um token de acesso para a API do SendPulse
 */
export async function getAccessToken(retryCount = 0, maxRetries = 5) {
  try {
    const config = getSendPulseConfig();
    
    // Verificar se já temos um token válido em memória
    if (tokenCache.token && tokenCache.expiresAt > Date.now()) {
      console.log(`🔑 Usando token em cache (válido por mais ${Math.floor((tokenCache.expiresAt - Date.now()) / 1000)} segundos)`);
      return tokenCache.token;
    }
    
    // Erro de configuração
    if (!config.id || !config.secret) {
      console.error('❌ Credenciais do SendPulse não configuradas corretamente:');
      console.error(`   - ID: ${config.id ? 'Configurado' : 'NÃO CONFIGURADO'}`);
      console.error(`   - Secret: ${config.secret ? 'Configurado' : 'NÃO CONFIGURADO'}`);
      throw new Error('Credenciais do SendPulse não configuradas');
    }
    
    // Log apenas na primeira tentativa
    if (retryCount === 0) {
      console.log('🔑 Obtendo novo token de acesso do SendPulse...');
      console.log(`🔧 Usando cliente ID: ${config.id.substring(0, 5)}...`);
    } else {
      console.log(`🔄 Tentativa ${retryCount}/${maxRetries} de obter token de acesso...`);
    }
    
    // Preparar o payload para a requisição
    const payload = {
      grant_type: 'client_credentials',
      client_id: config.id,
      client_secret: config.secret,
    };
    
    console.log(`📦 Enviando payload para autenticação: ${JSON.stringify(payload, null, 2)}`);
    
    // Fazer requisição para obter o token
    const response = await fetch('https://api.sendpulse.com/oauth/access_token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
    
    console.log(`📡 Resposta de autenticação: Status ${response.status}`);
    
    // Verificar resposta
    if (!response.ok) {
      const errorData = await response.json();
      console.error('❌ Erro ao obter token de acesso do SendPulse:', errorData);
      console.error(`🔍 URL: https://api.sendpulse.com/oauth/access_token`);
      console.error(`🔍 Status: ${response.status} ${response.statusText}`);
      
      // Verificar se é erro de limite de taxa
      if (errorData.error === '404 Too Many Requests' || 
          errorData.message === 'Too Many Requests.' || 
          errorData.hint === 429) {
        
        // Se atingimos o limite máximo de tentativas
        if (retryCount >= maxRetries) {
          throw new Error(`Erro na API do SendPulse: Too Many Requests. Máximo de tentativas (${maxRetries}) atingido.`);
        }
        
        // Calcular tempo de espera com backoff exponencial
        // 1ª tentativa: 5s, 2ª: 10s, 3ª: 20s, 4ª: 40s, 5ª: 80s
        const waitTime = 5000 * Math.pow(2, retryCount);
        console.warn(`⚠️ Limite de taxa atingido. Aguardando ${waitTime/1000}s antes da próxima tentativa...`);
        
        // Aguardar e tentar novamente
        await new Promise(resolve => setTimeout(resolve, waitTime));
        return getAccessToken(retryCount + 1, maxRetries);
      }
      
      throw new Error(`Erro na API do SendPulse: ${errorData.message || errorData.error || response.statusText}`);
    }
    
    // Processar resposta bem-sucedida
    const data = await response.json();
    
    if (!data.access_token) {
      throw new Error('Token de acesso não encontrado na resposta');
    }
    
    // Calcular quando o token expira (reduzir 60 segundos para margem de segurança)
    const expiresIn = data.expires_in || 3600; // Padrão: 1 hora
    const expiresAt = Date.now() + (expiresIn - 60) * 1000;
    
    // Atualizar cache
    tokenCache.token = data.access_token;
    tokenCache.expiresAt = expiresAt;
    
    if (retryCount === 0) {
      console.log('✅ Token de acesso obtido com sucesso');
    } else {
      console.log(`✅ Token de acesso obtido com sucesso após ${retryCount} tentativas`);
    }
    
    return data.access_token;
  } catch (error) {
    // Se não for um erro de limite de taxa já tratado
    if (!error.message?.includes('Too Many Requests')) {
      console.error('❌ Exceção ao obter token de acesso do SendPulse:', error);
    }
    throw error;
  }
}

/**
 * Verifica se um contato existe no SendPulse
 */
export async function checkContactExists(email) {
  try {
    const accessToken = await getAccessToken();
    
    // Usar o endpoint correto para verificar contatos no SendPulse
    const response = await fetch(`https://api.sendpulse.com/addressbooks/emails/variable?email=${encodeURIComponent(email)}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
      timeout: 10000, // Adicionar timeout explícito para evitar problemas de conexão
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
    return contactData && Object.keys(contactData).length > 0;
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
    
    // Determinar qual listId usar baseado no status
    let listId;
    switch (userData.status) {
      case 'TRIAL':
        listId = SENDPULSE_LIST_IDS.TRIAL;
        break;
      case 'ATIVO':
        listId = SENDPULSE_LIST_IDS.ATIVO;
        break;
      case 'INATIVO':
        listId = SENDPULSE_LIST_IDS.INATIVO;
        break;
      case 'ADMIN':
        listId = SENDPULSE_LIST_IDS.ADMIN;
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
    
    // Dados para o SendPulse - usando o formato correto esperado pela API
    const contactData = {
      emails: [{
        email: userData.email
      }],
      variables: [{
        email: userData.email,
        variables
      }]
    };
    
    // Primeiro, adicionar o contato ao livro de endereços e à lista em uma única chamada
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
      console.error('❌ Erro ao criar contato no SendPulse:', errorData);
      return { 
        success: false, 
        error: `Erro na API do SendPulse: ${errorData.message || 'Erro desconhecido'}` 
      };
    }
    
    // Em seguida, atualizamos as variáveis do contato
    const updateVarsResponse = await fetch('https://api.sendpulse.com/addressbooks/emails/variable', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        email: userData.email,
        variables
      }),
    });
    
    if (!updateVarsResponse.ok) {
      const errorData = await updateVarsResponse.json();
      console.error('❌ Aviso: Erro ao atualizar variáveis do contato:', errorData);
      // Não retornamos erro aqui porque o contato já foi criado, então consideramos sucesso parcial
    }
    
    return { 
      success: true, 
      message: 'Contato criado com sucesso',
      data: await response.json() 
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
    
    // No SendPulse, atualizar variáveis do contato
    const response = await fetch('https://api.sendpulse.com/addressbooks/emails/variable', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        email: userData.email,
        variables
      }),
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
    
    // Dados para adicionar à lista no formato correto
    const contactData = {
      emails: [{
        email
      }]
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
    console.log(`🧪 DIAGNÓSTICO DE REMOÇÃO: Iniciando tentativa para ${email} da lista ${listId}`);
    
    const accessToken = await getAccessToken();
    console.log(`🗑️ Tentando remover ${email} da lista ${listId}`);
    
    // Diagnóstico - Verificar todas as listas onde o email está presente antes da remoção
    console.log(`🔍 DIAGNÓSTICO: Verificando TODAS as listas onde ${email} está presente ANTES da remoção...`);
    let initialLists = [];
    
    try {
      // Listar todos os livros de endereço/listas
      const allListsResponse = await fetch('https://api.sendpulse.com/addressbooks', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        }
      });
      
      if (allListsResponse.ok) {
        const lists = await allListsResponse.json();
        
        // Para cada lista, verificar se o contato existe
        for (const list of lists) {
          try {
            const checkResponse = await fetch(`https://api.sendpulse.com/addressbooks/${list.id}/emails?email=${encodeURIComponent(email)}`, {
              method: 'GET',
              headers: {
                'Authorization': `Bearer ${accessToken}`,
              },
              timeout: 8000
            });
            
            if (checkResponse.ok) {
              const checkData = await checkResponse.json();
              const exists = checkData && Array.isArray(checkData.emails) && checkData.emails.length > 0;
              
              if (exists) {
                initialLists.push(list.id);
                console.log(`📝 DIAGNÓSTICO: Contato ${email} encontrado na lista ${list.id} (${list.name})`);
              }
            }
          } catch (error) {
            console.warn(`⚠️ DIAGNÓSTICO: Erro ao verificar lista ${list.id}: ${error.message}`);
          }
        }
        
        console.log(`📊 DIAGNÓSTICO: Contato ${email} está presente em ${initialLists.length} listas: ${initialLists.join(', ')}`);
      }
    } catch (diagError) {
      console.warn(`⚠️ DIAGNÓSTICO: Erro ao fazer diagnóstico inicial: ${diagError.message}`);
    }
    
    // Verificar se o email está realmente na lista antes de tentar remover
    try {
      const checkResponse = await fetch(`https://api.sendpulse.com/addressbooks/${listId}/emails?email=${encodeURIComponent(email)}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
        timeout: 8000 // 8 segundos timeout
      });
      
      if (!checkResponse.ok) {
        console.log(`⚠️ Não foi possível verificar se ${email} existe na lista ${listId}: ${checkResponse.status} ${checkResponse.statusText}`);
      } else {
        const checkData = await checkResponse.json();
        const exists = checkData && Array.isArray(checkData.emails) && checkData.emails.length > 0;
        console.log(`📋 Verificação: O email ${email} ${exists ? 'existe' : 'não existe'} na lista ${listId}`);
        
        if (!exists) {
          console.log(`✅ DIAGNÓSTICO: O contato ${email} já não estava na lista ${listId}, nenhuma remoção necessária`);
          return {
            success: true,
            message: `Contato ${email} não encontrado na lista ${listId}, nenhuma ação necessária.`
          };
        }
      }
    } catch (checkError) {
      console.warn(`⚠️ Erro ao verificar existência de ${email} na lista ${listId}:`, checkError);
      // Continuar mesmo com erro na verificação
    }
    
    // 🔴 NOVO: FORMATO EXATO DA DOCUMENTAÇÃO - Emails como string codificada em base64
    const base64Email = Buffer.from(email).toString('base64');
    const officialFormatData = {
      emails: base64Email
    };
    
    console.log(`🔄 Tentando remover com o formato OFICIAL da documentação:`, JSON.stringify(officialFormatData));
    
    const officialResponse = await fetch(`https://api.sendpulse.com/addressbooks/${listId}/emails/delete`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
      body: JSON.stringify(officialFormatData),
      timeout: 15000
    });
    
    let officialResponseText;
    try {
      officialResponseText = await officialResponse.text();
      console.log(`📄 Resposta da API (formato oficial): ${officialResponseText}`);
    } catch (e) {
      console.warn(`⚠️ Não foi possível ler o corpo da resposta:`, e);
    }
    
    if (officialResponse.ok) {
      console.log(`✅ Remoção com formato oficial da documentação parece ter funcionado!`);
      // Continuar com verificação para confirmar
    } else {
      console.log(`❌ Formato oficial falhou: ${officialResponse.status}. Tentando formatos alternativos...`);
      
      // FORMATO CORRETO: O SendPulse espera emails como array de strings
      const contactData = {
        emails: [email]
      };
      
      console.log(`🔄 Enviando requisição de remoção para lista ${listId} com formato:`, JSON.stringify(contactData));
      
      // Remover o contato da lista usando o endpoint apropriado
      const response = await fetch(`https://api.sendpulse.com/addressbooks/${listId}/emails/delete`, {
        method: 'POST', // A documentação menciona DELETE, mas na verdade é POST com a URL terminando em /delete
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
        body: JSON.stringify(contactData),
        timeout: 15000 // 15 segundos timeout para dar mais tempo à operação
      });
      
      // Processar a resposta
      let responseText;
      try {
        responseText = await response.text();
        console.log(`📄 Resposta da API para remoção: ${responseText}`);
      } catch (e) {
        console.warn(`⚠️ Não foi possível ler o corpo da resposta:`, e);
      }
      
      if (!response.ok) {
        let errorData;
        
        try {
          // Tentar fazer parse do erro como JSON
          errorData = JSON.parse(responseText);
        } catch (e) {
          // Se não for JSON, usar o texto diretamente
          errorData = { message: responseText || 'Erro desconhecido' };
        }
        
        console.error(`❌ Erro ao remover contato da lista ${listId}:`, errorData);
        
        // Tentar com formato alternativo como último recurso
        console.log(`🔄 Tentando formato alternativo para remoção...`);
        
        // Segundo formato mais comum em documentações de API
        const alternativeFormat = {
          "emails": [email]  // Garantir que é realmente um array
        };
        
        console.log(`🔄 Tentando remoção com formato alternativo:`, JSON.stringify(alternativeFormat));
        
        const altResponse = await fetch(`https://api.sendpulse.com/addressbooks/${listId}/emails/delete`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`,
          },
          body: JSON.stringify(alternativeFormat),
          timeout: 15000
        });
        
        let altResponseText;
        try {
          altResponseText = await altResponse.text();
          console.log(`📄 Resposta da API para segunda tentativa: ${altResponseText}`);
        } catch (e) {
          console.warn(`⚠️ Não foi possível ler o corpo da resposta da segunda tentativa:`, e);
        }
        
        if (!altResponse.ok) {
          console.error(`❌ Formato alternativo também falhou: ${altResponse.status} ${altResponse.statusText}`);
          
          // Verificar autenticação - tentar renovar token e tentar novamente
          console.log(`🔄 Tentando renovar token e fazer nova tentativa...`);
          
          // Obter um novo token 
          const newToken = await getAccessToken();
          
          const renewedResponse = await fetch(`https://api.sendpulse.com/addressbooks/${listId}/emails/delete`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${newToken}`,
            },
            body: JSON.stringify(contactData), // Usar o formato original
            timeout: 15000
          });
          
          let renewedResponseText;
          try {
            renewedResponseText = await renewedResponse.text();
            console.log(`📄 Resposta após renovação de token: ${renewedResponseText}`);
          } catch (e) {
            console.warn(`⚠️ Não foi possível ler resposta após renovação:`, e);
          }
          
          if (!renewedResponse.ok) {
            console.error(`❌ Tentativa após renovação de token também falhou: ${renewedResponse.status}`);
            
            // 🔴 NOVA TENTATIVA: usando formato da documentação com o token renovado
            console.log(`🔄 Tentando formato oficial da documentação com token renovado...`);
            
            const officialRenewedResponse = await fetch(`https://api.sendpulse.com/addressbooks/${listId}/emails/delete`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${newToken}`,
              },
              body: JSON.stringify(officialFormatData),
              timeout: 15000
            });
            
            if (!officialRenewedResponse.ok) {
              console.error(`❌ Formato oficial com token renovado também falhou: ${officialRenewedResponse.status}`);
              
              return { 
                success: false, 
                error: `Erro ao remover da lista: ${errorData.message || response.statusText || 'Erro desconhecido'}`,
                statusCode: response.status
              };
            } else {
              console.log(`✅ Remoção com formato oficial e token renovado parece ter funcionado!`);
              // Continuar com verificação
            }
          } else {
            console.log(`✅ Remoção com token renovado parece ter funcionado!`);
            // Continuar com verificação
          }
        } else {
          console.log(`✅ Formato alternativo parece ter funcionado!`);
          // Continuar com a verificação abaixo
        }
      }
    }
    
    // Aguardar um momento para o processamento da API
    console.log(`⏱️ Aguardando 2 segundos para o processamento da API...`);
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Verificar novamente se o contato foi realmente removido
    try {
      const verifyResponse = await fetch(`https://api.sendpulse.com/addressbooks/${listId}/emails?email=${encodeURIComponent(email)}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
        timeout: 8000
      });
      
      if (verifyResponse.ok) {
        const verifyData = await verifyResponse.json();
        const stillExists = verifyData && Array.isArray(verifyData.emails) && verifyData.emails.length > 0;
        
        if (stillExists) {
          console.warn(`⚠️ O contato ${email} ainda parece existir na lista ${listId} após tentativa de remoção`);
          
          // Tentar remover novamente com um pequeno atraso e terceiro formato possível
          await new Promise(resolve => setTimeout(resolve, 2000));
          
          // Terceira tentativa com formato de array de objetos
          const thirdAttemptData = {
            emails: [{
              email
            }]
          };
          
          console.log(`🔄 Terceira tentativa de remoção para lista ${listId}:`, JSON.stringify(thirdAttemptData));
          
          const thirdResponse = await fetch(`https://api.sendpulse.com/addressbooks/${listId}/emails/delete`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${accessToken}`,
            },
            body: JSON.stringify(thirdAttemptData),
            timeout: 15000
          });
          
          let thirdResponseText;
          try {
            thirdResponseText = await thirdResponse.text();
            console.log(`📄 Resposta da terceira tentativa: ${thirdResponseText}`);
          } catch (e) {
            console.warn(`⚠️ Não foi possível ler o corpo da terceira tentativa:`, e);
          }
          
          if (!thirdResponse.ok) {
            console.warn(`⚠️ Terceira tentativa de remoção falhou: ${thirdResponse.status} ${thirdResponse.statusText}`);
            
            // Tentativa com formato direto com email sem array
            const fourthAttemptData = { email: email };
            console.log(`🔄 Quarta tentativa com formato simplificado: ${JSON.stringify(fourthAttemptData)}`);
            
            const fourthResponse = await fetch(`https://api.sendpulse.com/addressbooks/${listId}/emails/delete`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${accessToken}`,
              },
              body: JSON.stringify(fourthAttemptData),
              timeout: 15000
            });
            
            if (!fourthResponse.ok) {
              console.warn(`⚠️ Quarta tentativa falhou: ${fourthResponse.status} ${fourthResponse.statusText}`);
              
              // 🔴 MODIFICADO: Tentativa final usando o formato da documentação com método DELETE
              console.log(`🔄 Tentativa final com método DELETE e Base64 conforme documentação...`);
              
              // Codificar email em base64 - usar apenas o email sem vírgulas já que é um único email
              const base64EmailForDelete = Buffer.from(email).toString('base64');
              
              const finalResponse = await fetch(`https://api.sendpulse.com/addressbooks/${listId}/emails?emails=${base64EmailForDelete}`, {
                method: 'DELETE',
                headers: {
                  'Authorization': `Bearer ${accessToken}`,
                },
                timeout: 15000
              });
              
              if (!finalResponse.ok) {
                console.warn(`⚠️ Tentativa final falhou: ${finalResponse.status}`);
                // Desistir após múltiplas tentativas
                return { 
                  success: false, 
                  error: `Não foi possível remover o contato após múltiplas tentativas`,
                  attempts: 5
                };
              } else {
                console.log(`✅ Tentativa final de remoção parece ter sido bem-sucedida`);
              }
            } else {
              console.log(`✅ Quarta tentativa de remoção parece ter sido bem-sucedida`);
            }
          } else {
            console.log(`✅ Terceira tentativa de remoção parece ter sido bem-sucedida`);
          }
          
          // Verificar novamente após as múltiplas tentativas
          await new Promise(resolve => setTimeout(resolve, 2000));
          
          const finalVerifyResponse = await fetch(`https://api.sendpulse.com/addressbooks/${listId}/emails?email=${encodeURIComponent(email)}`, {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${accessToken}`,
            },
            timeout: 8000
          });
          
          if (finalVerifyResponse.ok) {
            const finalVerifyData = await finalVerifyResponse.json();
            const finallyExists = finalVerifyData && Array.isArray(finalVerifyData.emails) && finalVerifyData.emails.length > 0;
            
            if (finallyExists) {
              console.error(`❌ FALHA FINAL: O contato ${email} AINDA existe na lista ${listId} mesmo após múltiplas tentativas!`);
              // Registrar contato para análise manual
              console.log(`📝 DIAGNÓSTICO: É possível que este contato precise de remoção manual. Detalhes do contato na lista:`, finalVerifyData.emails);
              
              return {
                success: false,
                error: `Não foi possível remover o contato mesmo após múltiplas tentativas`,
                contact: finalVerifyData.emails,
                needsManualRemoval: true
              };
            } else {
              console.log(`✅ Verificação final confirmou: contato ${email} foi removido com sucesso da lista ${listId}`);
            }
          }
        } else {
          console.log(`✅ Verificação confirmou: contato ${email} removido com sucesso da lista ${listId}`);
        }
      } else {
        console.warn(`⚠️ Não foi possível verificar a remoção: ${verifyResponse.status} ${verifyResponse.statusText}`);
      }
    } catch (verifyError) {
      console.warn(`⚠️ Erro ao verificar se a remoção foi bem-sucedida:`, verifyError);
    }
    
    // Diagnóstico final - verificar todas as listas onde o email está presente APÓS a remoção
    console.log(`🔍 DIAGNÓSTICO FINAL: Verificando TODAS as listas onde ${email} está presente APÓS a remoção...`);
    let finalLists = [];
    
    try {
      // Obter novo token para diagnóstico final
      const finalToken = await getAccessToken();
      
      // Listar todos os livros de endereço/listas
      const allListsResponse = await fetch('https://api.sendpulse.com/addressbooks', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${finalToken}`,
        }
      });
      
      if (allListsResponse.ok) {
        const lists = await allListsResponse.json();
        
        // Para cada lista, verificar se o contato existe
        for (const list of lists) {
          try {
            const checkResponse = await fetch(`https://api.sendpulse.com/addressbooks/${list.id}/emails?email=${encodeURIComponent(email)}`, {
              method: 'GET',
              headers: {
                'Authorization': `Bearer ${finalToken}`,
              },
              timeout: 8000
            });
            
            if (checkResponse.ok) {
              const checkData = await checkResponse.json();
              const exists = checkData && Array.isArray(checkData.emails) && checkData.emails.length > 0;
              
              if (exists) {
                finalLists.push(list.id);
                console.log(`📝 DIAGNÓSTICO FINAL: Contato ${email} AINDA encontrado na lista ${list.id} (${list.name})`);
              }
            }
          } catch (error) {
            console.warn(`⚠️ DIAGNÓSTICO FINAL: Erro ao verificar lista ${list.id}: ${error.message}`);
          }
        }
        
        console.log(`📊 DIAGNÓSTICO FINAL: Contato ${email} está presente em ${finalLists.length} listas: ${finalLists.join(', ')}`);
        
        // Verificar se a lista alvo foi removida
        const listWasRemoved = initialLists.includes(listId) && !finalLists.includes(listId);
        console.log(`📊 DIAGNÓSTICO DE RESULTADO: A lista ${listId} foi removida? ${listWasRemoved ? 'SIM ✅' : 'NÃO ❌'}`);
        
        if (!listWasRemoved && initialLists.includes(listId)) {
          console.error(`❌ FALHA CRÍTICA: Não foi possível remover ${email} da lista ${listId} mesmo após múltiplas tentativas!`);
          return { 
            success: false, 
            error: 'Falha crítica: Contato não removido mesmo após múltiplas tentativas',
            initialLists,
            finalLists,
            needsManualRemoval: true
          };
        }
      }
    } catch (diagError) {
      console.warn(`⚠️ DIAGNÓSTICO FINAL: Erro ao fazer diagnóstico final: ${diagError.message}`);
    }
    
    console.log(`✅ Operação de remoção do contato ${email} da lista ${listId} concluída`);
    return {
      success: true,
      message: `Contato removido da lista ${listId} com sucesso`,
      diagnostics: {
        initialLists,
        finalLists
      }
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
    console.log(`🔄 Iniciando atualização de listas para ${userData.email} (status: ${userData.status})`);
    
    // Determinar qual listId usar baseado no status
    let targetListId;
    switch (userData.status) {
      case 'TRIAL':
        targetListId = SENDPULSE_LIST_IDS.TRIAL;
        break;
      case 'ATIVO':
        targetListId = SENDPULSE_LIST_IDS.ATIVO;
        break;
      case 'INATIVO':
        targetListId = SENDPULSE_LIST_IDS.INATIVO;
        break;
      case 'ADMIN':
        targetListId = SENDPULSE_LIST_IDS.ADMIN;
        break;
      default:
        console.error(`❌ Status inválido: ${userData.status}`);
        return { 
          success: false, 
          error: `Status inválido: ${userData.status}` 
        };
    }
    
    console.log(`📋 Lista alvo para usuário ${userData.email}: ${targetListId}`);
    
    // Primeiro, remover o contato de todas as outras listas para evitar duplicidade
    console.log(`🗑️ Removendo usuário ${userData.email} de todas as listas antigas...`);
    
    const removalResults = [];
    
    for (const [status, listId] of Object.entries(SENDPULSE_LIST_IDS)) {
      if (listId !== targetListId) {
        console.log(`🗑️ Tentando remover ${userData.email} da lista ${status} (ID: ${listId})`);
        
        try {
          // Usar a função otimizada que implementa o formato correto da documentação
          const removalResult = await forceRemoveContactFromList(userData.email, listId);
          
          removalResults.push({
            status,
            listId,
            success: removalResult.success,
            message: removalResult.message || removalResult.error
          });
          
          console.log(`${removalResult.success ? '✅' : '⚠️'} Remoção de ${userData.email} da lista ${status}: ${removalResult.success ? 'Sucesso' : 'Falha - ' + removalResult.error}`);
        } catch (error) {
          console.error(`❌ Erro ao remover ${userData.email} da lista ${status}:`, error);
          removalResults.push({
            status,
            listId,
            success: false,
            error: error instanceof Error ? error.message : 'Erro desconhecido'
          });
        }
      }
    }
    
    // Segundo, atualizar os atributos do contato
    console.log(`📝 Atualizando dados do contato ${userData.email}...`);
    const updateResult = await updateContact(userData);
    if (!updateResult.success) {
      console.error(`❌ Erro ao atualizar atributos do contato ${userData.email}:`, updateResult.error);
      return {
        ...updateResult,
        removalResults // Incluir resultados da remoção para diagnóstico
      };
    }
    
    // Por último, adicionar o contato à lista correta
    console.log(`📥 Adicionando ${userData.email} à lista ${userData.status} (ID: ${targetListId})...`);
    const addResult = await addContactToList(userData.email, targetListId);
    if (!addResult.success) {
      console.error(`❌ Erro ao adicionar contato ${userData.email} à lista ${userData.status}:`, addResult.error);
      return {
        ...addResult,
        removalResults // Incluir resultados da remoção para diagnóstico
      };
    }
    
    console.log(`✅ Usuário ${userData.email} adicionado com sucesso à lista ${userData.status} (ID: ${targetListId})`);
    
    // Se alguma lista apresentou erro ao remover, informar, mas considerar sucesso parcial
    const removalErrors = removalResults.filter(result => !result.success);
    if (removalErrors.length > 0) {
      console.warn(`⚠️ Atenção: Ocorreram ${removalErrors.length} erros ao remover o contato das listas antigas.`);
      removalErrors.forEach((error, index) => {
        console.warn(`⚠️ Erro ${index + 1}: Falha ao remover de ${error.status} após ${error.attempts} tentativas: ${error.error}`);
      });
    }
    
    return { 
      success: true, 
      message: `Contato atualizado e movido para a lista de ${userData.status}`,
      data: {
        updated: true,
        targetList: targetListId,
        removalResults, // Incluir resultados da remoção para diagnóstico
        removalSuccessCount: removalResults.filter(r => r.success).length,
        removalErrorCount: removalErrors.length
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
  console.log('🔄 Iniciando sincronização com SendPulse para:', userData.email);
  
  try {
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
    
    // Validar dados obrigatórios do usuário
    if (!userData.email) {
      const error = 'Email do usuário não fornecido';
      console.error(`❌ ${error}`);
      return {
        success: false,
        error
      };
    }
    
    if (!userData.status) {
      const error = 'Status do usuário não fornecido';
      console.error(`❌ ${error}`);
      return {
        success: false,
        error
      };
    }
    
    // Validar status
    const validStatuses = ['TRIAL', 'ATIVO', 'INATIVO', 'ADMIN'];
    if (!validStatuses.includes(userData.status)) {
      const error = `Status inválido: ${userData.status}. Valores permitidos: ${validStatuses.join(', ')}`;
      console.error(`❌ ${error}`);
      return {
        success: false,
        error
      };
    }
    
    // Determinar qual listId usar baseado no status
    let targetListId;
    switch (userData.status) {
      case 'TRIAL':
        targetListId = SENDPULSE_LIST_IDS.TRIAL;
        break;
      case 'ATIVO':
        targetListId = SENDPULSE_LIST_IDS.ATIVO;
        break;
      case 'INATIVO':
        targetListId = SENDPULSE_LIST_IDS.INATIVO;
        break;
      case 'ADMIN':
        targetListId = SENDPULSE_LIST_IDS.ADMIN;
        break;
      default:
        // Não deveria chegar aqui devido à validação anterior, mas mantido por segurança
        console.error(`❌ Status inválido: ${userData.status}`);
        return { 
          success: false, 
          error: `Status inválido: ${userData.status}` 
        };
    }
    
    console.log(`🎯 Lista alvo para status ${userData.status}: ${targetListId}`);
    
    // Diagnóstico antes de qualquer operação
    console.log(`📊 DIAGNÓSTICO DE SINCRONIZAÇÃO: Verificando situação atual do contato ${userData.email}`);
    const accessToken = await getAccessToken();
    
    // Verificar em quais listas o contato está atualmente
    let currentLists = [];
    try {
      // Listar todas as listas disponíveis
      const listsResponse = await fetch('https://api.sendpulse.com/addressbooks', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      });
      
      if (listsResponse.ok) {
        const lists = await listsResponse.json();
        console.log(`📚 Total de listas disponíveis: ${lists.length}`);
        
        // Para cada lista, verificar se o contato existe
        for (const list of lists) {
          try {
            const checkResponse = await fetch(`https://api.sendpulse.com/addressbooks/${list.id}/emails?email=${encodeURIComponent(userData.email)}`, {
              method: 'GET',
              headers: {
                'Authorization': `Bearer ${accessToken}`,
              },
              timeout: 8000
            });
            
            if (checkResponse.ok) {
              const checkData = await checkResponse.json();
              const exists = checkData && Array.isArray(checkData.emails) && checkData.emails.length > 0;
              
              if (exists) {
                currentLists.push({
                  id: list.id,
                  name: list.name,
                  isTargetList: list.id === targetListId
                });
                console.log(`📝 Contato ${userData.email} encontrado na lista ${list.id} (${list.name})`);
              }
            }
          } catch (error) {
            console.warn(`⚠️ Erro ao verificar lista ${list.id}: ${error.message}`);
          }
        }
      }
    } catch (diagError) {
      console.warn(`⚠️ Erro durante diagnóstico inicial: ${diagError.message}`);
    }
    
    console.log(`📊 Contato ${userData.email} está em ${currentLists.length} listas: ${currentLists.map(l => l.id).join(', ')}`);
    
    // Verificar se o contato já existe
    console.log(`🔍 Verificando se o contato ${userData.email} já existe no SendPulse...`);
    const contactExists = await checkContactExists(userData.email);
    console.log(`📋 Contato ${userData.email} existe no SendPulse? ${contactExists ? 'Sim' : 'Não'}`);
    
    // ABORDAGEM DIRETA: Remover o contato de todas as listas exceto a desejada
    const removalResults = [];
    let overallSuccess = true;
    
    // Obter todas as listas que NÃO são a lista alvo
    const listsToRemoveFrom = currentLists.filter(list => list.id !== targetListId).map(list => list.id);
    console.log(`🗑️ Listas das quais o contato será removido: ${listsToRemoveFrom.join(', ') || 'Nenhuma'}`);
    
    // Remover o contato de todas as listas exceto a lista alvo
    for (const listId of listsToRemoveFrom) {
      console.log(`🗑️ Removendo ${userData.email} da lista ${listId}...`);
      // Usar a função otimizada com o formato correto da documentação
      const removeResult = await forceRemoveContactFromList(userData.email, listId);
      removalResults.push({
        listId,
        success: removeResult.success,
        message: removeResult.message,
        error: removeResult.error
      });
      
      if (!removeResult.success) {
        console.error(`❌ Falha ao remover ${userData.email} da lista ${listId}: ${removeResult.error}`);
        // Não consideramos falha aqui como fatal - continuamos mesmo com erros para garantir
        // que o usuário seja pelo menos adicionado à lista correta
      } else {
        console.log(`✅ Contato ${userData.email} removido com sucesso da lista ${listId}`);
      }
    }
    
    // Atualizar atributos do contato
    console.log(`📝 Atualizando atributos do contato ${userData.email}...`);
    const updateResult = await updateContact(userData);
    
    if (!updateResult.success) {
      console.error(`❌ Falha ao atualizar atributos do contato ${userData.email}: ${updateResult.error}`);
      overallSuccess = false;
    } else {
      console.log(`✅ Atributos do contato ${userData.email} atualizados com sucesso`);
    }
    
    // Adicionar o contato à lista alvo (se ele ainda não estiver lá)
    const isAlreadyInTargetList = currentLists.some(list => list.id === targetListId);
    if (isAlreadyInTargetList) {
      console.log(`📝 Contato ${userData.email} já está na lista alvo ${targetListId}`);
    } else {
      console.log(`📥 Adicionando ${userData.email} à lista alvo ${targetListId}...`);
      const addResult = await addContactToList(userData.email, targetListId);
      
      if (!addResult.success) {
        console.error(`❌ Falha ao adicionar ${userData.email} à lista ${targetListId}: ${addResult.error}`);
        overallSuccess = false;
      } else {
        console.log(`✅ Contato ${userData.email} adicionado com sucesso à lista ${targetListId}`);
      }
    }
    
    // Diagnóstico final: verificar em quais listas o contato está após a sincronização
    let finalLists = [];
    try {
      // Obter novo token
      const finalToken = await getAccessToken();
      
      // Listar todas as listas
      const listsResponse = await fetch('https://api.sendpulse.com/addressbooks', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${finalToken}`,
        },
      });
      
      if (listsResponse.ok) {
        const lists = await listsResponse.json();
        
        // Para cada lista, verificar se o contato existe
        for (const list of lists) {
          try {
            const checkResponse = await fetch(`https://api.sendpulse.com/addressbooks/${list.id}/emails?email=${encodeURIComponent(userData.email)}`, {
              method: 'GET',
              headers: {
                'Authorization': `Bearer ${finalToken}`,
              },
              timeout: 8000
            });
            
            if (checkResponse.ok) {
              const checkData = await checkResponse.json();
              const exists = checkData && Array.isArray(checkData.emails) && checkData.emails.length > 0;
              
              if (exists) {
                finalLists.push({
                  id: list.id,
                  name: list.name,
                  isTargetList: list.id === targetListId
                });
                console.log(`📝 DIAGNÓSTICO FINAL: Contato ${userData.email} encontrado na lista ${list.id} (${list.name})`);
              }
            }
          } catch (error) {
            console.warn(`⚠️ DIAGNÓSTICO FINAL: Erro ao verificar lista ${list.id}: ${error.message}`);
          }
        }
      }
    } catch (diagError) {
      console.warn(`⚠️ Erro durante diagnóstico final: ${diagError.message}`);
    }
    
    console.log(`📊 DIAGNÓSTICO FINAL: Contato ${userData.email} está em ${finalLists.length} listas: ${finalLists.map(l => l.id).join(', ')}`);
    
    // Verificar o resultado da sincronização
    const isOnlyInTargetList = finalLists.length === 1 && finalLists[0].id === targetListId;
    const isInTargetList = finalLists.some(list => list.id === targetListId);
    
    console.log(`📊 RESULTADO FINAL:
      - Contato APENAS na lista correta? ${isOnlyInTargetList ? 'SIM ✅' : 'NÃO ❌'}
      - Contato na lista correta (mas talvez em outras também)? ${isInTargetList ? 'SIM ✅' : 'NÃO ❌'}
      - Número de listas onde o contato está: ${finalLists.length} (inicial: ${currentLists.length})
    `);
    
    if (overallSuccess && isInTargetList) {
      console.log(`✅ Sincronização concluída com sucesso para ${userData.email} com status ${userData.status}`);
      return {
        success: true,
        message: `Usuário ${userData.email} sincronizado com sucesso com o status ${userData.status}`,
        contact: {
          email: userData.email,
          status: userData.status,
          targetList: targetListId,
          existed: contactExists
        },
        syncDetails: {
          initialLists: currentLists.map(l => l.id),
          finalLists: finalLists.map(l => l.id),
          isOnlyInTargetList,
          isInTargetList
        }
      };
    } else if (isInTargetList) {
      console.log(`⚠️ Sincronização parcialmente concluída para ${userData.email}. Na lista correta, mas com alguns erros.`);
      return {
        success: true,
        message: `Usuário ${userData.email} sincronizado parcialmente. Está na lista correta, mas ocorreram alguns erros.`,
        contact: {
          email: userData.email,
          status: userData.status,
          targetList: targetListId,
          existed: contactExists
        },
        syncDetails: {
          initialLists: currentLists.map(l => l.id),
          finalLists: finalLists.map(l => l.id),
          isOnlyInTargetList,
          isInTargetList,
          removalResults
        },
        warnings: !isOnlyInTargetList ? ["Contato ainda está em listas não relacionadas ao seu status atual"] : []
      };
    } else {
      console.error(`❌ Falha na sincronização para ${userData.email}: não foi possível adicionar à lista correta`);
      return {
        success: false,
        error: `Não foi possível adicionar o contato à lista correta para o status ${userData.status}`,
        contact: {
          email: userData.email,
          status: userData.status,
          targetList: targetListId,
          existed: contactExists
        },
        syncDetails: {
          initialLists: currentLists.map(l => l.id),
          finalLists: finalLists.map(l => l.id),
          isOnlyInTargetList,
          isInTargetList,
          removalResults
        }
      };
    }
  } catch (error) {
    console.error('❌ Exceção ao sincronizar usuário com o SendPulse:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Erro desconhecido',
      contact: {
        email: userData.email,
        status: userData.status || 'desconhecido'
      }
    };
  }
}

/**
 * Função auxiliar para garantir a remoção efetiva de um email de uma lista específica
 * Implementa EXATAMENTE o formato da documentação oficial do SendPulse
 */
export async function forceRemoveContactFromList(email, listId) {
  try {
    console.log(`🔄 Iniciando remoção forçada de ${email} da lista ${listId} com formato oficial...`);
    
    // Obter token de acesso
    const accessToken = await getAccessToken();
    
    // Verificar se o email está realmente na lista antes de tentar remover
    const checkResponse = await fetch(`https://api.sendpulse.com/addressbooks/${listId}/emails?email=${encodeURIComponent(email)}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
      timeout: 8000
    });
    
    if (checkResponse.ok) {
      const checkData = await checkResponse.json();
      const exists = checkData && Array.isArray(checkData.emails) && checkData.emails.length > 0;
      
      if (!exists) {
        console.log(`✅ Contato ${email} já não está na lista ${listId}, nenhuma ação necessária`);
        return { success: true, message: 'Contato não está na lista, nenhuma ação necessária' };
      }
    }
    
    // Implementar EXATAMENTE o formato da documentação oficial
    // IMPORTANTE: A documentação informa que o campo "emails" deve ser uma string em base64 dos emails separados por vírgula
    const base64Email = Buffer.from(email).toString('base64');
    
    const officialPayload = {
      emails: base64Email
    };
    
    console.log(`📤 Enviando requisição no formato oficial para remoção de ${email} da lista ${listId}`);
    
    const response = await fetch(`https://api.sendpulse.com/addressbooks/${listId}/emails/delete`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
      body: JSON.stringify(officialPayload),
      timeout: 15000
    });
    
    // Log da resposta completa para diagnóstico
    let responseText;
    try {
      responseText = await response.text();
    } catch (error) {
      console.warn(`⚠️ Não foi possível ler corpo da resposta: ${error.message}`);
    }
    
    if (response.ok) {
      console.log(`✅ Remoção com formato oficial da documentação parece ter funcionado!`);
      // Continuar com verificação para confirmar
    } else {
      console.log(`❌ Formato oficial falhou: ${response.status} ${response.statusText}`, responseText);
      
      // Tentar com método HTTP DELETE alternativo
      console.log(`🔄 Tentando remoção alternativa com método DELETE...`);
      
      const deleteResponse = await fetch(`https://api.sendpulse.com/addressbooks/${listId}/emails?emails=${base64Email}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
        timeout: 15000
      });
      
      if (!deleteResponse.ok) {
        console.error(`❌ Método DELETE também falhou: ${deleteResponse.status} ${deleteResponse.statusText}`);
        return { success: false, error: 'Falha em todas as tentativas de remoção' };
      } else {
        console.log(`✅ Remoção via método DELETE foi bem-sucedida`);
      }
    }
    
    // Verificar se a remoção foi realmente efetivada
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const verifyResponse = await fetch(`https://api.sendpulse.com/addressbooks/${listId}/emails?email=${encodeURIComponent(email)}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
      timeout: 8000
    });
    
    if (verifyResponse.ok) {
      const verifyData = await verifyResponse.json();
      const stillExists = verifyData && Array.isArray(verifyData.emails) && verifyData.emails.length > 0;
      
      if (stillExists) {
        console.warn(`⚠️ Contato ainda está na lista após tentativas de remoção`);
        return { success: false, error: 'Contato ainda permanece na lista após tentativas de remoção' };
      }
    }
    
    console.log(`✅ Verificação confirmou: Contato ${email} foi removido com sucesso da lista ${listId}`);
    return { success: true, message: 'Contato removido com sucesso' };
  } catch (error) {
    console.error(`❌ Erro ao forçar remoção de ${email} da lista ${listId}:`, error);
    return { success: false, error: error instanceof Error ? error.message : 'Erro desconhecido' };
  }
}

// Alias para compatibilidade com o código existente
export const syncUserWithBrevo = syncUserWithSendPulse; 

/**
 * Utilitário para controle de taxa (rate limiting)
 */
const rateLimiter = {
  queue: [],
  running: false,
  requestsPerSecond: 0.45, // ~27 requisições por minuto (abaixo do limite de 30/min)
  lastRequestTime: 0,
  pendingRequests: 0,
  maxConcurrent: 1, // Máximo de requisições simultâneas
  
  enqueue: function(task, priority = false) {
    return new Promise((resolve, reject) => {
      const queueItem = {
        task,
        resolve,
        reject,
        priority
      };
      
      // Colocar tarefas prioritárias no início da fila
      if (priority) {
        this.queue.unshift(queueItem);
      } else {
        this.queue.push(queueItem);
      }
      
      if (!this.running) {
        this.processQueue();
      }
    });
  },
  
  processQueue: async function() {
    if (this.queue.length === 0 || this.pendingRequests >= this.maxConcurrent) {
      if (this.pendingRequests === 0) {
        this.running = false;
      }
      return;
    }
    
    this.running = true;
    const item = this.queue.shift();
    
    // Calcular tempo a aguardar desde a última requisição
    const now = Date.now();
    const timeElapsed = now - this.lastRequestTime;
    const minInterval = Math.ceil(1000 / this.requestsPerSecond);
    const waitTime = timeElapsed < minInterval ? minInterval - timeElapsed : 0;
    
    if (waitTime > 0) {
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
    
    this.pendingRequests++;
    this.lastRequestTime = Date.now();
    
    try {
      const result = await item.task();
      item.resolve(result);
    } catch (error) {
      // Verificar se é erro de taxa limite (rate limit)
      if (error.message && error.message.includes('Too Many Requests')) {
        console.warn(`⚠️ Limite de taxa da API atingido. Aguardando 20 segundos antes de tentar novamente...`);
        
        // Colocar tarefa de volta na fila (com prioridade para ser a próxima)
        this.queue.unshift(item);
        
        // Aguardar tempo significativo antes de retomar
        await new Promise(resolve => setTimeout(resolve, 20000));
      } else {
        item.reject(error);
      }
    } finally {
      this.pendingRequests--;
      
      // Continuar processando a fila
      setTimeout(() => this.processQueue(), 10);
    }
  }
};

/**
 * Versão otimizada da função de sincronização de usuário com SendPulse
 * Reduz drasticamente as chamadas à API, enviando apenas o que foi modificado
 */
export async function optimizedSyncUserWithSendPulse(userData, options = {}) {
  const verbose = options.verbose || false;
  const log = verbose ? console.log : () => {};
  
  log(`🔄 Iniciando sincronização otimizada para ${userData.email} (status: ${userData.status})`);
  
  try {
    // Validações básicas
    if (!userData.email || !userData.status) {
      const error = !userData.email ? 'Email não fornecido' : 'Status não fornecido';
      console.error(`❌ ${error}`);
      return { success: false, error };
    }
    
    // Validar status
    const validStatuses = ['TRIAL', 'ATIVO', 'INATIVO', 'ADMIN'];
    if (!validStatuses.includes(userData.status)) {
      const error = `Status inválido: ${userData.status}`;
      console.error(`❌ ${error}`);
      return { success: false, error };
    }
    
    // Determinar lista alvo com base no status
    const targetListId = SENDPULSE_LIST_IDS[userData.status];
    if (!targetListId) {
      return { success: false, error: `ID de lista não encontrado para status ${userData.status}` };
    }
    
    log(`🎯 Lista alvo: ${targetListId} (${userData.status})`);
    
    // Obter token de acesso via rate limiter
    const getTokenTask = async () => getAccessToken();
    const accessToken = await rateLimiter.enqueue(getTokenTask, true); // Prioridade para token
    
    // ==== PASSO 1: Verificar em que listas o usuário está atualmente ====
    let currentLists = [];
    const listInfoMap = {};
    
    // 1.1 Obter todas as listas apenas uma vez via rate limiter
    const getListsTask = async () => {
      const response = await fetch('https://api.sendpulse.com/addressbooks', {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${accessToken}` }
      });
      
      if (!response.ok) {
        throw new Error(`Erro ao obter listas: ${response.status}`);
      }
      
      return await response.json();
    };
    
    const allLists = await rateLimiter.enqueue(getListsTask);
    
    // Mapear IDs e nomes de listas para referência rápida
    allLists.forEach(list => {
      listInfoMap[list.id] = list.name;
    });
    
    // 1.2 Para cada lista que nos interessa (apenas as listas do SENDPULSE_LIST_IDS), 
    // verificar uma única vez se o contato está nela
    const relevantListIds = Object.values(SENDPULSE_LIST_IDS);
    
    for (const listId of relevantListIds) {
      // Usando rate limiter para cada verificação
      const checkContactTask = async () => {
        const response = await fetch(`https://api.sendpulse.com/addressbooks/${listId}/emails?email=${encodeURIComponent(userData.email)}`, {
          method: 'GET',
          headers: { 'Authorization': `Bearer ${accessToken}` },
          timeout: 8000
        });
        
        if (!response.ok) {
          return { exists: false };
        }
        
        const data = await response.json();
        return { 
          exists: data && Array.isArray(data.emails) && data.emails.length > 0,
          data
        };
      };
      
      const result = await rateLimiter.enqueue(checkContactTask);
      
      if (result.exists) {
        currentLists.push(listId);
        log(`📋 Contato encontrado na lista ${listId} (${listInfoMap[listId] || 'desconhecida'})`);
      }
    }
    
    log(`📊 Situação atual: contato em ${currentLists.length} listas relevantes: ${currentLists.join(', ')}`);
    
    // ==== PASSO 2: Determinar se está na lista correta ====
    const isInTargetList = currentLists.includes(targetListId);
    const isInWrongLists = currentLists.some(id => id !== targetListId);
    
    // Se já está na lista correta e em nenhuma lista errada, só precisamos atualizar os atributos
    if (isInTargetList && !isInWrongLists) {
      log(`✅ Contato já está na lista correta (${targetListId}) e em nenhuma outra lista`);
      
      // Atualizar atributos do contato via rate limiter
      const updateAttributesTask = async () => {
        return await updateContact(userData);
      };
      
      const updateResult = await rateLimiter.enqueue(updateAttributesTask);
      
      if (!updateResult.success) {
        console.error(`⚠️ Não foi possível atualizar atributos: ${updateResult.error}`);
      }
      
      return {
        success: true,
        message: "Contato já estava na lista correta, atributos atualizados",
        wasUpdated: updateResult.success,
        wasListChanged: false
      };
    }
    
    // ==== PASSO 3: Ações necessárias com base na situação ====
    const operations = [];
    
    // 3.1 Se precisa ser adicionado à lista correta
    if (!isInTargetList) {
      log(`📝 Contato precisa ser adicionado à lista ${targetListId}`);
      
      // Adicionar contato à lista via rate limiter
      const addContactTask = async () => {
        // Preparar variáveis para adicionar junto com o contato
        const variables = {
          STATUS: userData.status,
          ID: userData.id,
        };
        
        if (userData.name) {
          variables.NOME = userData.name;
          const nameParts = userData.name.split(' ');
          variables.FNAME = nameParts[0] || '';
          variables.LNAME = nameParts.slice(1).join(' ') || '';
        }
        
        if (userData.whatsapp) {
          let whatsapp = userData.whatsapp.replace(/\D/g, '');
          if (!whatsapp.startsWith('55')) {
            whatsapp = '55' + whatsapp;
          }
          variables.SMS = whatsapp;
          variables.WHATSAPP = whatsapp;
        }
        
        // Dados para o SendPulse - enviando contato e variáveis em uma única chamada
        const contactData = {
          emails: [{
            email: userData.email
          }],
          variables: [{
            email: userData.email,
            variables
          }]
        };
        
        const response = await fetch(`https://api.sendpulse.com/addressbooks/${targetListId}/emails`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`,
          },
          body: JSON.stringify(contactData),
        });
        
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(`Erro ao adicionar à lista ${targetListId}: ${errorData.message}`);
        }
        
        return await response.json();
      };
      
      try {
        const addResult = await rateLimiter.enqueue(addContactTask);
        log(`✅ Contato adicionado à lista ${targetListId}`);
        operations.push({ operation: 'add', listId: targetListId, success: true });
      } catch (error) {
        console.error(`❌ Erro ao adicionar à lista ${targetListId}: ${error.message}`);
        operations.push({ operation: 'add', listId: targetListId, success: false, error: error.message });
      }
    } else {
      // Se já está na lista correta, apenas atualizar variáveis
      const updateVarsTask = async () => {
        // Preparar variáveis
        const variables = {
          STATUS: userData.status,
          ID: userData.id,
        };
        
        if (userData.name) {
          variables.NOME = userData.name;
          const nameParts = userData.name.split(' ');
          variables.FNAME = nameParts[0] || '';
          variables.LNAME = nameParts.slice(1).join(' ') || '';
        }
        
        if (userData.whatsapp) {
          let whatsapp = userData.whatsapp.replace(/\D/g, '');
          if (!whatsapp.startsWith('55')) {
            whatsapp = '55' + whatsapp;
          }
          variables.SMS = whatsapp;
          variables.WHATSAPP = whatsapp;
        }
        
        const response = await fetch('https://api.sendpulse.com/addressbooks/emails/variable', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`,
          },
          body: JSON.stringify({
            email: userData.email,
            variables
          }),
        });
        
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(`Erro ao atualizar variáveis: ${errorData.message}`);
        }
        
        return await response.json();
      };
      
      try {
        await rateLimiter.enqueue(updateVarsTask);
        log(`✅ Variáveis atualizadas para o contato`);
        operations.push({ operation: 'update_vars', success: true });
      } catch (error) {
        console.error(`❌ Erro ao atualizar variáveis: ${error.message}`);
        operations.push({ operation: 'update_vars', success: false, error: error.message });
      }
    }
    
    // 3.2 Remover de listas erradas
    const wrongLists = currentLists.filter(id => id !== targetListId);
    for (const listId of wrongLists) {
      log(`🗑️ Removendo contato da lista ${listId} (${listInfoMap[listId] || 'desconhecida'})`);
      
      const removeTask = async () => {
        // Usar o formato correto da documentação
        const base64Email = Buffer.from(userData.email).toString('base64');
        
        const response = await fetch(`https://api.sendpulse.com/addressbooks/${listId}/emails/delete`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`,
          },
          body: JSON.stringify({ emails: base64Email }),
          timeout: 15000
        });
        
        if (!response.ok) {
          throw new Error(`Erro ao remover da lista ${listId}: ${response.status}`);
        }
        
        return true;
      };
      
      try {
        await rateLimiter.enqueue(removeTask);
        log(`✅ Contato removido da lista ${listId}`);
        operations.push({ operation: 'remove', listId, success: true });
      } catch (error) {
        console.error(`❌ Erro ao remover da lista ${listId}: ${error.message}`);
        operations.push({ operation: 'remove', listId, success: false, error: error.message });
      }
    }
    
    // IMPORTANTE: Aguardar tempo para propagação das mudanças na API do SendPulse
    // Isso resolve o problema de verificação imediata não encontrar o contato
    log(`⏳ Aguardando 10 segundos para propagação das mudanças na API...`);
    await new Promise(resolve => setTimeout(resolve, 10000));
    
    // ==== PASSO 4: Verificação final para confirmação ====
    log(`🔍 Realizando verificação final da situação do contato...`);
    let finalLists = [];
    
    // Usar o mesmo token - não queremos gastar mais uma requisição para obter um novo
    for (const listId of relevantListIds) {
      const verifyContactTask = async () => {
        const response = await fetch(`https://api.sendpulse.com/addressbooks/${listId}/emails?email=${encodeURIComponent(userData.email)}`, {
          method: 'GET',
          headers: { 'Authorization': `Bearer ${accessToken}` },
          timeout: 8000
        });
        
        if (!response.ok) {
          return { exists: false };
        }
        
        const data = await response.json();
        return { 
          exists: data && Array.isArray(data.emails) && data.emails.length > 0,
          data
        };
      };
      
      const verifyResult = await rateLimiter.enqueue(verifyContactTask);
      
      if (verifyResult.exists) {
        finalLists.push(listId);
        log(`📋 VERIFICAÇÃO FINAL: Contato encontrado na lista ${listId} (${listInfoMap[listId] || 'desconhecida'})`);
      }
    }
    
    // Avaliar resultado da verificação
    const isInTargetListFinal = finalLists.includes(targetListId);
    const isOnlyInTargetList = finalLists.length === 1 && isInTargetListFinal;
    
    log(`📊 RESULTADO FINAL:`);
    log(`  - Contato APENAS na lista correta? ${isOnlyInTargetList ? 'SIM ✅' : 'NÃO ❌'}`);
    log(`  - Contato na lista correta? ${isInTargetListFinal ? 'SIM ✅' : 'NÃO ❌'}`);
    log(`  - Listas onde o contato está: ${finalLists.join(', ') || 'Nenhuma'}`);
    
    // Resultado final
    const allOperationsSuccessful = operations.every(op => op.success === true);
    
    return {
      success: isInTargetListFinal, // Considerado sucesso se pelo menos está na lista correta
      message: isOnlyInTargetList 
        ? `Sincronização perfeita: contato apenas na lista correta ${targetListId}`
        : isInTargetListFinal 
          ? `Sincronização parcial: contato na lista correta ${targetListId} mas também em outras listas`
          : `Falha na sincronização: contato não está na lista correta ${targetListId}`,
      operations,
      contact: {
        email: userData.email,
        status: userData.status,
        targetList: targetListId
      },
      initialLists: currentLists,
      finalLists,
      targetList: targetListId,
      listsRemoved: wrongLists,
      isOnlyInTargetList,
      isInTargetList: isInTargetListFinal
    };
    
  } catch (error) {
    console.error(`❌ Erro geral na sincronização otimizada: ${error.message}`);
    return {
      success: false,
      error: error.message,
      contact: {
        email: userData.email,
        status: userData.status || 'desconhecido'
      }
    };
  }
}

/**
 * Sincroniza vários usuários em lote com controle de concorrência
 * @param {Array} userDataList - Lista de objetos de usuário para sincronizar
 * @param {Object} options - Opções de configuração
 * @returns {Promise<Object>} - Resultados da sincronização em lote
 */
export async function batchSyncUsers(userDataList, options = {}) {
  const concurrency = options.concurrency || 1; // Padrão: processar um usuário por vez
  const delayBetweenBatches = options.delayBetweenBatches || 5000; // Padrão: 5 segundos entre lotes
  const delayBetweenUsers = options.delayBetweenUsers || 2000; // Padrão: 2 segundos entre usuários
  const verbose = options.verbose !== undefined ? options.verbose : false;
  const maxRetries = options.maxRetries || 3; // Número máximo de tentativas por usuário
  
  console.log(`🔄 Iniciando sincronização em lote para ${userDataList.length} usuários (concorrência: ${concurrency})`);
  console.log(`⚙️ Configuração: ${delayBetweenBatches}ms entre lotes, ${delayBetweenUsers}ms entre usuários, ${maxRetries} tentativas máximas`);
  
  // Validar a lista de usuários
  if (!Array.isArray(userDataList) || userDataList.length === 0) {
    return {
      success: false,
      error: "Lista de usuários vazia ou inválida"
    };
  }
  
  const results = {
    success: true,
    totalProcessed: 0,
    successful: 0,
    failed: 0,
    skipped: 0,
    retries: 0,
    startTime: Date.now(),
    endTime: null,
    details: []
  };
  
  // Processar em lotes controlados
  for (let i = 0; i < userDataList.length; i += concurrency) {
    // Log de progresso
    const percentageComplete = Math.floor((i / userDataList.length) * 100);
    console.log(`⏱️ Progresso: ${i}/${userDataList.length} usuários processados (${percentageComplete}%)`);
    console.log(`📊 Status atual: ${results.successful} sucessos, ${results.failed} falhas, ${results.retries} tentativas extras`);
    
    const batch = userDataList.slice(i, i + concurrency);
    
    // Processar usuários no lote SEQUENCIALMENTE para evitar muitas requisições simultâneas
    for (const userData of batch) {
      try {
        // Pular registros inválidos
        if (!userData.email || !userData.status) {
          results.skipped++;
          results.details.push({
            success: false,
            skipped: true,
            contact: userData,
            error: "Dados de usuário incompletos (email ou status ausente)"
          });
          continue;
        }
        
        // Processar usuário com a versão otimizada e retry
        let syncResult = null;
        let retryCount = 0;
        let success = false;
        
        // Loop de tentativas
        while (!success && retryCount <= maxRetries) {
          try {
            if (retryCount > 0) {
              console.log(`🔄 Tentativa ${retryCount}/${maxRetries} para ${userData.email}...`);
              results.retries++;
              // Aguardar mais tempo antes de retry
              await new Promise(resolve => setTimeout(resolve, 5000 * retryCount));
            }
            
            syncResult = await optimizedSyncUserWithSendPulse(userData, { verbose });
            
            // Verificar resultado
            if (syncResult.success) {
              success = true;
              console.log(`✅ Sincronização bem-sucedida para ${userData.email}`);
            } else {
              console.warn(`⚠️ Falha na tentativa ${retryCount + 1} para ${userData.email}: ${syncResult.error}`);
              retryCount++;
            }
          } catch (retryError) {
            console.error(`❌ Erro na tentativa ${retryCount + 1} para ${userData.email}:`, retryError);
            retryCount++;
            
            // Capturar erro para o resultado final, caso todas as tentativas falhem
            syncResult = {
              success: false,
              error: retryError.message,
              contact: userData
            };
            
            // Aguardar entre tentativas - tempo progressivo
            await new Promise(resolve => setTimeout(resolve, 5000 * retryCount));
          }
        }
        
        // Após todas as tentativas ou sucesso
        if (syncResult.success) {
          results.successful++;
        } else {
          results.failed++;
        }
        
        // Adicionar detalhes do resultado
        results.details.push({
          ...syncResult,
          contact: userData,
          retries: retryCount
        });
        
        results.totalProcessed++;
        
        // Aguardar entre usuários do mesmo lote
        if (userData !== batch[batch.length - 1]) {
          console.log(`⏱️ Aguardando ${delayBetweenUsers}ms antes do próximo usuário...`);
          await new Promise(resolve => setTimeout(resolve, delayBetweenUsers));
        }
      } catch (error) {
        console.error(`❌ Erro não tratado ao processar ${userData?.email || 'usuário'}:`, error);
        results.failed++;
        results.details.push({
          success: false,
          contact: userData,
          error: error.message || 'Erro desconhecido'
        });
        results.totalProcessed++;
      }
    }
    
    // Se não for o último lote, aguardar antes do próximo
    if (i + concurrency < userDataList.length) {
      console.log(`✅ Lote processado (${i+1}-${i+batch.length}/${userDataList.length}). Aguardando ${delayBetweenBatches}ms antes do próximo lote...`);
      await new Promise(resolve => setTimeout(resolve, delayBetweenBatches));
    }
  }
  
  // Calcular tempo total
  results.endTime = Date.now();
  const totalTimeInSeconds = Math.round((results.endTime - results.startTime) / 1000);
  const totalMinutes = Math.floor(totalTimeInSeconds / 60);
  const remainingSeconds = totalTimeInSeconds % 60;
  
  console.log(`✅ Sincronização em lote concluída em ${totalMinutes}m${remainingSeconds}s:`);
  console.log(`📊 Resultados: ${results.successful} sucessos, ${results.failed} falhas, ${results.skipped} ignorados, ${results.retries} tentativas extras`);
  
  // Atualizar status de sucesso geral
  results.success = results.failed === 0;
  
  return results;
} 

/**
 * Envia um email de boas-vindas personalizado para um novo usuário ou quando o status muda
 * Usa a API de campanhas do SendPulse para envio imediato
 * 
 * @param {Object} userData - Dados do usuário
 * @param {Object} options - Opções de configuração
 * @returns {Promise<Object>} - Resultado da operação
 */
export async function sendWelcomeEmail(userData, options = {}) {
  const { force = false, verbose = false } = options;
  const log = verbose ? console.log : () => {};
  
  try {
    log(`📧 Preparando email de boas-vindas para ${userData.email} (status: ${userData.status})...`);
    
    // Validações básicas
    if (!userData.email || !userData.status) {
      const error = !userData.email ? 'Email não fornecido' : 'Status não fornecido';
      console.error(`❌ ${error}`);
      return { success: false, error };
    }
    
    // Validar status
    const validStatuses = ['TRIAL', 'ATIVO', 'INATIVO', 'ADMIN'];
    if (!validStatuses.includes(userData.status)) {
      const error = `Status inválido: ${userData.status}`;
      console.error(`❌ ${error}`);
      return { success: false, error };
    }
    
    // Obter token de acesso via rate limiter
    const getTokenTask = async () => getAccessToken();
    const accessToken = await rateLimiter.enqueue(getTokenTask, true); // Prioridade para token
    
    // Configurações de campanha baseadas no status do usuário
    const campaignConfig = getWelcomeEmailConfig(userData.status);
    
    // Criar dados para o corpo do email com variáveis personalizadas
    const nameToUse = userData.name || userData.email.split('@')[0];
    
    // Dados para a campanha
    const campaignData = {
      sender_name: campaignConfig.senderName,
      sender_email: campaignConfig.senderEmail,
      subject: campaignConfig.subject,
      body: campaignConfig.body
        .replace(/{{NOME}}/g, nameToUse)
        .replace(/{{EMAIL}}/g, userData.email)
        .replace(/{{STATUS}}/g, userData.status),
      list_id: SENDPULSE_LIST_IDS[userData.status],
      send_date: "now", // Enviar imediatamente
      name: `Welcome - ${userData.status} - ${userData.email} - ${new Date().toISOString().split('T')[0]}`,
      // Importante: Definir explicitamente que é um único destinatário
      send_to_all: 0,
      emails: [userData.email]
    };
    
    log(`📧 Configuração da campanha de boas-vindas:`, JSON.stringify(campaignData, null, 2));
    
    // Enviar a campanha
    const sendCampaignTask = async () => {
      const response = await fetch('https://api.sendpulse.com/campaigns', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
        body: JSON.stringify(campaignData),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`Erro ao criar campanha: ${errorData.message || errorData.error || response.statusText}`);
      }
      
      return await response.json();
    };
    
    // Executar o envio via rate limiter
    const result = await rateLimiter.enqueue(sendCampaignTask);
    
    log(`✅ Email de boas-vindas enviado com sucesso para ${userData.email}`);
    return {
      success: true,
      message: `Email de boas-vindas enviado com sucesso para ${userData.email}`,
      campaign: result
    };
  } catch (error) {
    console.error(`❌ Erro ao enviar email de boas-vindas: ${error.message}`);
    return {
      success: false,
      error: error.message,
      contact: userData
    };
  }
}

/**
 * Retorna a configuração de email de boas-vindas com base no status do usuário
 * 
 * @param {string} status - Status do usuário (TRIAL, ATIVO, INATIVO, ADMIN)
 * @returns {Object} - Configuração do email
 */
function getWelcomeEmailConfig(status) {
  // Configurações comuns
  const common = {
    senderName: 'Songmetrix',
    senderEmail: 'contato@songmetrix.com.br',
  };
  
  // Configurações específicas por status
  switch (status) {
    case 'TRIAL':
      return {
        ...common,
        subject: 'Seja bem-vindo ao período de teste do Songmetrix!',
        body: `
          <html>
          <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
            <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
              <div style="text-align: center; margin-bottom: 20px;">
                <img src="https://songmetrix.com.br/logo.png" alt="Songmetrix Logo" style="max-width: 150px;">
              </div>
              
              <h1 style="color: #4a6ee0; text-align: center;">Bem-vindo ao Songmetrix!</h1>
              
              <p>Olá <strong>{{NOME}}</strong>,</p>
              
              <p>Estamos muito felizes em ter você conosco no período de teste do Songmetrix, a plataforma completa para monitoramento de execuções musicais em rádios!</p>
              
              <p>Durante seu período de teste, você terá acesso a:</p>
              
              <ul>
                <li>Monitoramento em tempo real das execuções</li>
                <li>Relatórios detalhados por artista e música</li>
                <li>Gráficos de performance</li>
                <li>E muito mais!</li>
              </ul>
              
              <p>Se tiver qualquer dúvida, basta responder este email ou entrar em contato com nosso suporte.</p>
              
              <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
                <p style="margin: 0;"><strong>Seu acesso:</strong><br>
                Email: {{EMAIL}}<br>
                Status: Período de Teste</p>
              </div>
              
              <p>Aproveite ao máximo sua experiência!</p>
              
              <p>Atenciosamente,<br>
              Equipe Songmetrix</p>
              
              <div style="border-top: 1px solid #eee; margin-top: 20px; padding-top: 20px; font-size: 12px; color: #777; text-align: center;">
                <p>© 2023 Songmetrix. Todos os direitos reservados.</p>
              </div>
            </div>
          </body>
          </html>
        `
      };
      
    case 'ATIVO':
      return {
        ...common,
        subject: 'Seu acesso ao Songmetrix foi ativado!',
        body: `
          <html>
          <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
            <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
              <div style="text-align: center; margin-bottom: 20px;">
                <img src="https://songmetrix.com.br/logo.png" alt="Songmetrix Logo" style="max-width: 150px;">
              </div>
              
              <h1 style="color: #4a6ee0; text-align: center;">Seu acesso foi ativado!</h1>
              
              <p>Olá <strong>{{NOME}}</strong>,</p>
              
              <p>Temos o prazer de informar que sua conta no Songmetrix foi <strong>ativada com sucesso</strong>!</p>
              
              <p>Agora você tem acesso completo a todas as funcionalidades da nossa plataforma:</p>
              
              <ul>
                <li>Monitoramento em tempo real de todas as execuções</li>
                <li>Relatórios avançados e exportação de dados</li>
                <li>Dashboards personalizados</li>
                <li>Alertas e notificações</li>
                <li>Suporte prioritário da nossa equipe</li>
              </ul>
              
              <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
                <p style="margin: 0;"><strong>Seu acesso:</strong><br>
                Email: {{EMAIL}}<br>
                Status: Cliente Ativo</p>
              </div>
              
              <p>Se tiver qualquer dúvida sobre como aproveitar ao máximo nossa plataforma, não hesite em contatar nosso suporte.</p>
              
              <p>Estamos muito felizes em tê-lo(a) como cliente!</p>
              
              <p>Atenciosamente,<br>
              Equipe Songmetrix</p>
              
              <div style="border-top: 1px solid #eee; margin-top: 20px; padding-top: 20px; font-size: 12px; color: #777; text-align: center;">
                <p>© 2023 Songmetrix. Todos os direitos reservados.</p>
              </div>
            </div>
          </body>
          </html>
        `
      };
      
    case 'INATIVO':
      return {
        ...common,
        subject: 'Informações sobre sua conta Songmetrix',
        body: `
          <html>
          <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
            <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
              <div style="text-align: center; margin-bottom: 20px;">
                <img src="https://songmetrix.com.br/logo.png" alt="Songmetrix Logo" style="max-width: 150px;">
              </div>
              
              <h1 style="color: #4a6ee0; text-align: center;">Informações sobre sua conta</h1>
              
              <p>Olá <strong>{{NOME}}</strong>,</p>
              
              <p>Gostaríamos de informar que houve uma alteração no status da sua conta no Songmetrix.</p>
              
              <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
                <p style="margin: 0;"><strong>Seu acesso:</strong><br>
                Email: {{EMAIL}}<br>
                Status atual: Inativo</p>
              </div>
              
              <p>Se desejar reativar sua conta ou tiver qualquer dúvida sobre este status, por favor entre em contato com nossa equipe de atendimento respondendo a este email.</p>
              
              <p>Ficamos à disposição para ajudá-lo(a) caso deseje retornar à plataforma.</p>
              
              <p>Atenciosamente,<br>
              Equipe Songmetrix</p>
              
              <div style="border-top: 1px solid #eee; margin-top: 20px; padding-top: 20px; font-size: 12px; color: #777; text-align: center;">
                <p>© 2023 Songmetrix. Todos os direitos reservados.</p>
              </div>
            </div>
          </body>
          </html>
        `
      };
      
    case 'ADMIN':
      return {
        ...common,
        subject: 'Sua conta de administrador no Songmetrix foi ativada',
        body: `
          <html>
          <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
            <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
              <div style="text-align: center; margin-bottom: 20px;">
                <img src="https://songmetrix.com.br/logo.png" alt="Songmetrix Logo" style="max-width: 150px;">
              </div>
              
              <h1 style="color: #4a6ee0; text-align: center;">Acesso Administrativo Ativado</h1>
              
              <p>Olá <strong>{{NOME}}</strong>,</p>
              
              <p>Confirmamos que seu acesso como <strong>administrador</strong> do Songmetrix foi ativado com sucesso.</p>
              
              <p>Como administrador, você tem acesso a:</p>
              
              <ul>
                <li>Gerenciamento completo de usuários</li>
                <li>Configurações avançadas do sistema</li>
                <li>Relatórios administrativos</li>
                <li>Controle total da plataforma</li>
              </ul>
              
              <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
                <p style="margin: 0;"><strong>Seu acesso:</strong><br>
                Email: {{EMAIL}}<br>
                Status: Administrador</p>
              </div>
              
              <p>Se tiver dúvidas sobre suas responsabilidades administrativas, consulte nossa documentação interna ou fale com o responsável pelo seu acesso.</p>
              
              <p>Atenciosamente,<br>
              Equipe Songmetrix</p>
              
              <div style="border-top: 1px solid #eee; margin-top: 20px; padding-top: 20px; font-size: 12px; color: #777; text-align: center;">
                <p>© 2023 Songmetrix. Todos os direitos reservados.</p>
              </div>
            </div>
          </body>
          </html>
        `
      };
      
    default:
      return {
        ...common,
        subject: 'Bem-vindo ao Songmetrix',
        body: `
          <html>
          <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
            <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
              <div style="text-align: center; margin-bottom: 20px;">
                <img src="https://songmetrix.com.br/logo.png" alt="Songmetrix Logo" style="max-width: 150px;">
              </div>
              
              <h1 style="color: #4a6ee0; text-align: center;">Bem-vindo ao Songmetrix!</h1>
              
              <p>Olá <strong>{{NOME}}</strong>,</p>
              
              <p>Obrigado por se cadastrar no Songmetrix, a plataforma completa para monitoramento de execuções musicais em rádios!</p>
              
              <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
                <p style="margin: 0;"><strong>Seu acesso:</strong><br>
                Email: {{EMAIL}}</p>
              </div>
              
              <p>Estamos à disposição para ajudá-lo a aproveitar ao máximo nossa plataforma.</p>
              
              <p>Atenciosamente,<br>
              Equipe Songmetrix</p>
              
              <div style="border-top: 1px solid #eee; margin-top: 20px; padding-top: 20px; font-size: 12px; color: #777; text-align: center;">
                <p>© 2023 Songmetrix. Todos os direitos reservados.</p>
              </div>
            </div>
          </body>
          </html>
        `
      };
  }
}