// Função Edge do Supabase para sincronizar usuários com o Brevo
import { serve } from 'https://deno.land/std@0.131.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.23.0';

// Configurações CORS
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Tratamento para requisições OPTIONS (CORS)
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Obter as variáveis de ambiente
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const brevoApiKey = Deno.env.get('BREVO_API_KEY');
    const brevoMainListId = Deno.env.get('BREVO_MAIN_LIST_ID');
    
    // IDs das listas do Brevo conforme o status do usuário
    // IMPORTANTE: verificar se estes IDs correspondem às listas corretas no seu Brevo
    const statusListIds = {
      TRIAL: '7',    // Lista para usuários Trial
      ATIVO: '8',    // Lista para usuários Ativos
      INATIVO: '9',  // Lista para usuários Inativos
    };
    
    // Validações importantes
    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('Erro crítico: Variáveis de ambiente do Supabase não configuradas');
      throw new Error('Variáveis de ambiente do Supabase não configuradas');
    }
    
    if (!brevoApiKey) {
      console.error('Erro crítico: API Key do Brevo não configurada');
      throw new Error('API Key do Brevo não configurada');
    }

    // Log das configurações (ocultando chaves sensíveis)
    console.log('Configuração: URL Supabase está definida:', !!supabaseUrl);
    console.log('Configuração: Chave Supabase está definida:', !!supabaseServiceKey);
    console.log('Configuração: API Key Brevo está definida:', !!brevoApiKey);
    console.log('Configuração: Lista principal Brevo está definida:', !!brevoMainListId);
    console.log('Configuração: IDs das listas por status:', JSON.stringify(statusListIds));
    
    // Criar cliente Supabase
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    // Obter dados da requisição
    const payload = await req.json();
    console.log('Payload recebido:', JSON.stringify(payload).substring(0, 500) + (JSON.stringify(payload).length > 500 ? '...' : ''));
    
    // Validar payload
    if (!payload || typeof payload !== 'object') {
      throw new Error('Payload inválido ou vazio');
    }
    
    if (!payload.type || !['INSERT', 'UPDATE', 'DELETE'].includes(payload.type)) {
      throw new Error(`Tipo de operação inválido ou não especificado: ${payload.type || 'ausente'}`);
    }
    
    // Processar exclusão de usuário
    if (payload.type === 'DELETE') {
      if (!payload.old_record || !payload.old_record.id || !payload.old_record.email) {
        console.error('Dados incompletos do registro a ser excluído:', payload.old_record);
        throw new Error('Dados do usuário excluído incompletos');
      }
      
      const userId = payload.old_record.id;
      const userEmail = payload.old_record.email;
      
      console.log(`Processando exclusão do usuário: ${userEmail}, ID: ${userId}`);
      
      // Remover o contato de todas as listas do Brevo
      try {
        // Verificar primeiro se o contato existe no Brevo
        console.log(`Verificando se contato existe no Brevo: ${userEmail}`);
        const getContactResponse = await fetch(`https://api.brevo.com/v3/contacts/${encodeURIComponent(userEmail)}`, {
          method: 'GET',
          headers: {
            'api-key': brevoApiKey
          }
        });
        
        // Se o contato existe, remover de todas as listas
        if (getContactResponse.ok) {
          console.log(`Contato encontrado no Brevo: ${userEmail}. Removendo de todas as listas...`);
          
          // Remover de todas as listas
          for (const listId of Object.values(statusListIds)) {
            try {
              console.log(`Removendo contato da lista ${listId}...`);
              const removeResponse = await fetch(`https://api.brevo.com/v3/contacts/lists/${listId}/contacts/remove`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'api-key': brevoApiKey
                },
                body: JSON.stringify({
                  emails: [userEmail]
                })
              });
              
              if (removeResponse.ok) {
                console.log(`Contato removido com sucesso da lista ${listId}`);
              } else {
                const removeErrorText = await removeResponse.text();
                console.warn(`Falha ao remover da lista ${listId}: ${removeResponse.status} - ${removeErrorText}`);
              }
            } catch (removeError) {
              console.warn(`Erro ao remover da lista ${listId}:`, removeError);
            }
          }
          
          // Retornar resposta de sucesso
          return new Response(
            JSON.stringify({
              success: true,
              message: 'Usuário excluído removido de todas as listas no Brevo',
              userId: userId,
              email: userEmail
            }),
            {
              headers: {
                'Content-Type': 'application/json',
                ...corsHeaders
              },
              status: 200
            }
          );
        } else {
          // Logar a resposta de erro para diagnóstico
          const contactErrorText = await getContactResponse.text();
          console.log(`Contato não encontrado no Brevo: ${userEmail}. Status: ${getContactResponse.status}, Resposta: ${contactErrorText}`);
          
          return new Response(
            JSON.stringify({
              success: true,
              message: 'Usuário excluído não encontrado no Brevo',
              userId: userId,
              email: userEmail
            }),
            {
              headers: {
                'Content-Type': 'application/json',
                ...corsHeaders
              },
              status: 200
            }
          );
        }
      } catch (error) {
        console.error('Erro ao processar exclusão de usuário:', error);
        throw error;
      }
    }
    
    // Verificar se há dados do usuário para INSERT ou UPDATE
    if (!payload.record || !payload.record.id || !payload.record.email) {
      console.error('Dados incompletos do registro:', payload.record);
      throw new Error('Dados do usuário incompletos');
    }
    
    const userId = payload.record.id;
    const userEmail = payload.record.email;
    const currentStatus = payload.record.status;
    
    console.log(`Processando usuário: ${userEmail}, ID: ${userId}, Status: ${currentStatus}, Operação: ${payload.type}`);
    
    // Verificar se é uma mudança de status
    let oldStatus = null;
    let isStatusChange = false;
    
    if (payload.type === 'UPDATE' && payload.old_record && 
        payload.old_record.status && payload.record.status &&
        payload.old_record.status !== payload.record.status) {
      oldStatus = payload.old_record.status;
      isStatusChange = true;
      console.log(`Detectada mudança de status: ${oldStatus} -> ${payload.record.status}`);
    }
    
    // Obter dados completos do usuário
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();
      
    if (userError) {
      console.error('Erro ao buscar dados do usuário:', userError);
      throw new Error(`Erro ao buscar dados do usuário: ${userError.message}`);
    }
    
    if (!userData) {
      console.error('Usuário não encontrado no banco de dados para ID:', userId);
      throw new Error('Usuário não encontrado');
    }
    
    // Validar status do usuário
    if (!userData.status || !statusListIds[userData.status]) {
      console.warn(`Status do usuário inválido ou não mapeado para uma lista: ${userData.status}`);
    }
    
    console.log('Dados completos do usuário:', JSON.stringify(userData).substring(0, 200) + '...');
    
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
    
    if (userData.status) {
      attributes.STATUS = userData.status;
    }
    
    if (userData.created_at) {
      attributes.DATA_CADASTRO = new Date(userData.created_at).toISOString().split('T')[0];
    }
    
    // Determinar a lista apropriada pelo status do usuário
    const userStatus = userData.status;
    const targetListId = statusListIds[userStatus];
    
    console.log(`Status do usuário: ${userStatus}, Lista alvo: ${targetListId}`);
    
    if (!targetListId) {
      console.warn(`ATENÇÃO: Não foi possível encontrar uma lista para o status ${userStatus}`);
    }
    
    // Processar contato no Brevo
    let isNewContact = true;
    
    // Verificar primeiro se o contato já existe
    try {
      console.log(`Verificando se contato já existe no Brevo: ${userEmail}`);
      const getContactResponse = await fetch(`https://api.brevo.com/v3/contacts/${encodeURIComponent(userEmail)}`, {
        method: 'GET',
        headers: {
          'api-key': brevoApiKey
        }
      });
      
      // Se o contato já existe
      if (getContactResponse.ok) {
        const contactData = await getContactResponse.json();
        console.log(`Contato encontrado no Brevo: ${userEmail}, ID: ${contactData.id}`);
        isNewContact = false;
        
        // Se for mudança de status, realizar tratamento especial
        if (isStatusChange && oldStatus) {
          console.log(`Processando mudança de status de ${oldStatus} para ${userStatus}`);
          
          // Remover o contato de todas as listas de status
          console.log('Removendo contato de todas as listas de status...');
          let removalSuccessCount = 0;
          
          for (const [status, listId] of Object.entries(statusListIds)) {
            try {
              console.log(`Verificando remoção da lista ${listId} (${status})...`);
              // Não remover da lista de destino
              if (listId === targetListId) {
                console.log(`Pulando remoção da lista ${listId} pois é a lista alvo`);
                continue;
              }
              
              console.log(`Removendo contato da lista ${listId}...`);
              const removeResponse = await fetch(`https://api.brevo.com/v3/contacts/lists/${listId}/contacts/remove`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'api-key': brevoApiKey
                },
                body: JSON.stringify({
                  emails: [userEmail]
                })
              });
              
              if (removeResponse.ok) {
                removalSuccessCount++;
                console.log(`Contato removido com sucesso da lista ${listId} (${status})`);
              } else {
                const removeErrorText = await removeResponse.text();
                console.warn(`Falha ao remover da lista ${listId} (${status}): ${removeResponse.status} - ${removeErrorText}`);
              }
            } catch (removeError) {
              console.warn(`Erro ao remover da lista ${listId} (${status}):`, removeError);
            }
            
            // Pequena pausa para evitar rate limits
            await new Promise(resolve => setTimeout(resolve, 200));
          }
          
          console.log(`Remoção de listas concluída. Sucessos: ${removalSuccessCount}`);
          
          // Adicionar à lista correta para o status atual
          if (targetListId) {
            console.log(`Adicionando contato à lista ${targetListId} para status ${userStatus}...`);
            try {
              const addToListResponse = await fetch(`https://api.brevo.com/v3/contacts/lists/${targetListId}/contacts/add`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'api-key': brevoApiKey
                },
                body: JSON.stringify({
                  emails: [userEmail]
                })
              });
              
              if (addToListResponse.ok) {
                const addToListResult = await addToListResponse.json();
                console.log(`Contato adicionado com sucesso à lista ${targetListId} para status ${userStatus}`);
              } else {
                const addErrorText = await addToListResponse.text();
                console.error(`Falha ao adicionar à lista ${targetListId}: ${addToListResponse.status} - ${addErrorText}`);
              }
            } catch (addError) {
              console.error('Erro ao adicionar à lista:', addError);
            }
          } else {
            console.warn(`Não foi possível determinar uma lista para o status ${userStatus}`);
          }
        }
        
        // Atualizar os atributos do contato (sempre, mesmo se não for mudança de status)
        console.log('Atualizando atributos do contato...');
        try {
          const updateContactResponse = await fetch(`https://api.brevo.com/v3/contacts/${encodeURIComponent(userEmail)}`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              'api-key': brevoApiKey
            },
            body: JSON.stringify({
              attributes: attributes
            })
          });
          
          if (updateContactResponse.ok) {
            console.log('Atributos do contato atualizados com sucesso');
          } else {
            const updateErrorText = await updateContactResponse.text();
            console.error(`Falha ao atualizar atributos: ${updateContactResponse.status} - ${updateErrorText}`);
          }
        } catch (updateError) {
          console.error('Erro ao atualizar atributos:', updateError);
        }
        
        // Para INSERT ou para contatos existentes sem mudança de status mas que precisam estar na lista correta
        if (payload.type === 'INSERT' || (!isStatusChange && targetListId)) {
          console.log(`Verificando se contato está na lista correta ${targetListId} para ${userStatus}...`);
          
          // Adicionar à lista correta (se ainda não estiver nela)
          try {
            const addToListResponse = await fetch(`https://api.brevo.com/v3/contacts/lists/${targetListId}/contacts/add`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'api-key': brevoApiKey
              },
              body: JSON.stringify({
                emails: [userEmail]
              })
            });
            
            if (addToListResponse.ok) {
              console.log(`Contato adicionado/verificado na lista ${targetListId} para status ${userStatus}`);
            } else {
              const addErrorText = await addToListResponse.text();
              console.error(`Falha ao adicionar/verificar lista ${targetListId}: ${addToListResponse.status} - ${addErrorText}`);
            }
          } catch (addError) {
            console.error('Erro ao adicionar à lista:', addError);
          }
        }
        
        // Retornar resposta de sucesso
        return new Response(
          JSON.stringify({
            success: true,
            message: isStatusChange 
              ? `Usuário movido com sucesso da lista ${oldStatus} para ${userStatus}`
              : 'Usuário atualizado com sucesso no Brevo',
            userId: userId,
            email: userEmail
          }),
          {
            headers: {
              'Content-Type': 'application/json',
              ...corsHeaders
            },
            status: 200
          }
        );
      } else {
        // Contato não existe, criar novo
        const contactErrorText = await getContactResponse.text();
        console.log(`Contato não encontrado no Brevo (status ${getContactResponse.status}): ${userEmail}. Resposta: ${contactErrorText}`);
        console.log('Criando novo contato...');
      }
    } catch (contactError) {
      console.warn('Erro ao verificar contato existente:', contactError);
      console.log('Continuando com o fluxo de criação de novo contato...');
    }
    
    // Fluxo para novos usuários ou quando não foi possível processar a verificação
    console.log('Iniciando fluxo de criação de contato para', userEmail);
    
    // Preparar dados para enviar ao Brevo
    const brevoContact = {
      email: userEmail,
      attributes: attributes,
      listIds: [],
      updateEnabled: true
    };
    
    if (targetListId) {
      brevoContact.listIds = [parseInt(targetListId)];
      console.log(`Adicionando novo contato à lista ${targetListId} para status ${userStatus}`);
    } else {
      console.warn(`Status do usuário não mapeado para uma lista: ${userStatus}`);
    }
    
    // Enviar requisição para o Brevo
    console.log('Enviando dados para o Brevo...');
    try {
      const brevoResponse = await fetch('https://api.brevo.com/v3/contacts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'api-key': brevoApiKey
        },
        body: JSON.stringify(brevoContact)
      });
      
      // Verificar resposta
      if (brevoResponse.ok) {
        const brevoResult = await brevoResponse.json();
        console.log('Contato criado com sucesso no Brevo:', brevoResult);
        
        // Retornar resposta de sucesso
        return new Response(
          JSON.stringify({
            success: true,
            message: 'Novo contato criado no Brevo com sucesso',
            userId: userId,
            email: userEmail
          }),
          {
            headers: {
              'Content-Type': 'application/json',
              ...corsHeaders
            },
            status: 200
          }
        );
      } else {
        // Em caso de falha
        const brevoError = await brevoResponse.json();
        console.error(`Erro na API do Brevo: ${brevoResponse.status}`, brevoError);
        
        // Se o contato já existir, tentar atualizar
        if (brevoResponse.status === 400 && brevoError.code === 'duplicate_parameter') {
          console.log('Contato já existe, atualizando informações...');
          
          // Buscar ID do contato
          const getContactResponse = await fetch(`https://api.brevo.com/v3/contacts/${encodeURIComponent(userEmail)}`, {
            method: 'GET',
            headers: {
              'api-key': brevoApiKey
            }
          });
          
          if (!getContactResponse.ok) {
            const getErrorText = await getContactResponse.text();
            console.error(`Erro ao buscar contato no Brevo: ${getContactResponse.status} - ${getErrorText}`);
            throw new Error(`Erro ao buscar contato no Brevo: ${getContactResponse.statusText}`);
          }
          
          // Atualizar os atributos do contato
          const updateContactResponse = await fetch(`https://api.brevo.com/v3/contacts/${encodeURIComponent(userEmail)}`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              'api-key': brevoApiKey
            },
            body: JSON.stringify({
              attributes: attributes
            })
          });
          
          if (!updateContactResponse.ok) {
            const updateErrorText = await updateContactResponse.text();
            console.error(`Erro ao atualizar contato: ${updateContactResponse.status} - ${updateErrorText}`);
          }
          
          // Atualizar a lista com base no status
          if (targetListId) {
            console.log(`Atualizando lista para status ${userStatus}...`);
            
            // Remover das outras listas primeiro
            for (const [status, listId] of Object.entries(statusListIds)) {
              if (listId !== targetListId) {
                try {
                  console.log(`Removendo contato da lista ${listId} (${status})...`);
                  const removeResponse = await fetch(`https://api.brevo.com/v3/contacts/lists/${listId}/contacts/remove`, {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json',
                      'api-key': brevoApiKey
                    },
                    body: JSON.stringify({
                      emails: [userEmail]
                    })
                  });
                  
                  if (removeResponse.ok) {
                    console.log(`Contato removido com sucesso da lista ${listId} (${status})`);
                  } else {
                    const removeErrorText = await removeResponse.text();
                    console.warn(`Falha ao remover da lista ${listId}: ${removeResponse.status} - ${removeErrorText}`);
                  }
                } catch (removeError) {
                  console.warn(`Erro ao remover da lista ${listId} (ignorando):`, removeError);
                }
                
                // Pausa para evitar rate limits
                await new Promise(resolve => setTimeout(resolve, 200));
              }
            }
            
            // Adicionar à lista correta
            console.log(`Adicionando contato à lista ${targetListId} para status ${userStatus}...`);
            const addToListResponse = await fetch(`https://api.brevo.com/v3/contacts/lists/${targetListId}/contacts/add`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'api-key': brevoApiKey
              },
              body: JSON.stringify({
                emails: [userEmail]
              })
            });
            
            if (addToListResponse.ok) {
              console.log(`Contato adicionado com sucesso à lista ${targetListId}`);
            } else {
              const addErrorText = await addToListResponse.text();
              console.error(`Erro ao adicionar à lista ${targetListId}: ${addToListResponse.status} - ${addErrorText}`);
            }
          }
          
          // Retornar resposta de sucesso para atualizações
          return new Response(
            JSON.stringify({
              success: true,
              message: 'Contato atualizado com sucesso no Brevo',
              userId: userId,
              email: userEmail
            }),
            {
              headers: {
                'Content-Type': 'application/json',
                ...corsHeaders
              },
              status: 200
            }
          );
        } else {
          // Outro tipo de erro
          throw new Error(`Erro ao criar contato no Brevo: ${brevoError.message || JSON.stringify(brevoError)}`);
        }
      }
    } catch (error) {
      console.error('Erro ao criar/atualizar contato:', error);
      throw error;
    }
  } catch (error) {
    console.error('Erro ao processar webhook:', error);
    
    // Retornar resposta de erro
    return new Response(
      JSON.stringify({
        success: false,
        message: error.message,
        error: error.stack
      }),
      {
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders
        },
        status: 500
      }
    );
  }
}); 