// Função Edge do Supabase para sincronizar usuários com o Brevo
import { serve } from 'https://deno.land/std@0.131.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.23.0';

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
    const statusListIds = {
      TRIAL: '7',    // Lista para usuários Trial
      ATIVO: '8',    // Lista para usuários Ativos
      INATIVO: '9',  // Lista para usuários Inativos
    };
    
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Variáveis de ambiente do Supabase não configuradas');
    }
    
    if (!brevoApiKey) {
      throw new Error('API Key do Brevo não configurada');
    }
    
    // Criar cliente Supabase
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    // Obter dados da requisição
    const payload = await req.json();
    console.log('Payload recebido:', JSON.stringify(payload).substring(0, 200) + '...');
    
    // Verificar se é um evento DELETE (exclusão de usuário)
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
                console.warn(`Falha ao remover da lista ${listId}: ${removeResponse.status}`);
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
          console.log(`Contato não encontrado no Brevo: ${userEmail}. Nada a fazer.`);
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
    
    // Verificar se é uma criação ou atualização de usuário
    if (!payload.type || !['INSERT', 'UPDATE'].includes(payload.type)) {
      throw new Error(`Tipo de evento não suportado: ${payload.type || 'desconhecido'}`);
    }
    
    // Verificar se há dados do usuário
    if (!payload.record || !payload.record.id || !payload.record.email) {
      console.error('Dados incompletos do registro:', payload.record);
      throw new Error('Dados do usuário incompletos');
    }
    
    const userId = payload.record.id;
    const userEmail = payload.record.email;
    const currentStatus = payload.record.status;
    
    console.log(`Processando usuário: ${userEmail}, ID: ${userId}, Status: ${currentStatus}`);
    
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
      throw new Error(`Erro ao buscar dados do usuário: ${userError.message}`);
    }
    
    if (!userData) {
      throw new Error('Usuário não encontrado');
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
    
    // Processar contato no Brevo
    // Verificar primeiro se o contato já existe
    try {
      // Buscar dados do contato no Brevo
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
        console.log(`Contato encontrado no Brevo: ${userEmail}`);
        
        // Se for mudança de status, realizar tratamento especial
        if (isStatusChange && oldStatus) {
          console.log(`Processando mudança de status de ${oldStatus} para ${userStatus}`);
          
          // Remover o contato de todas as listas de status
          console.log('Removendo contato de todas as listas de status...');
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
                console.warn(`Falha ao remover da lista ${listId}: ${removeResponse.status}`);
              }
            } catch (removeError) {
              console.warn(`Erro ao remover da lista ${listId}:`, removeError);
              // Continuar mesmo com erro (pode não estar na lista)
            }
            
            // Pequena pausa para evitar rate limits
            await new Promise(resolve => setTimeout(resolve, 100));
          }
          
          // Adicionar à lista correta para o status atual
          if (targetListId) {
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
              const addToListResult = await addToListResponse.json();
              console.log(`Contato adicionado com sucesso à lista ${targetListId}`);
            } else {
              console.error(`Falha ao adicionar à lista ${targetListId}: ${addToListResponse.status}`);
            }
          } else {
            console.warn(`Não foi possível determinar uma lista para o status ${userStatus}`);
          }
        }
        
        // Atualizar os atributos do contato (sempre, mesmo se não for mudança de status)
        console.log('Atualizando atributos do contato...');
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
          console.error(`Falha ao atualizar atributos: ${updateContactResponse.status}`);
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
        console.log(`Contato não encontrado no Brevo. Criando novo contato para ${userEmail}...`);
      }
    } catch (contactError) {
      console.warn('Erro ao verificar contato existente:', contactError);
      console.log('Continuando com o fluxo de criação de novo contato...');
    }
    
    // Fluxo normal para novos usuários ou quando não foi possível processar a verificação
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
      console.log('Contato criado com sucesso no Brevo');
      
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
        
        // Atualizar a lista com base no status
        if (targetListId) {
          console.log(`Atualizando lista para status ${userStatus}...`);
          
          // Remover das outras listas primeiro
          for (const listId of Object.values(statusListIds)) {
            if (listId !== targetListId) {
              try {
                await fetch(`https://api.brevo.com/v3/contacts/lists/${listId}/contacts/remove`, {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    'api-key': brevoApiKey
                  },
                  body: JSON.stringify({
                    emails: [userEmail]
                  })
                });
              } catch (removeError) {
                console.warn(`Erro ao remover da lista ${listId} (ignorando):`, removeError);
              }
            }
          }
          
          // Adicionar à lista correta
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
            console.error(`Erro ao adicionar à lista ${targetListId}: ${addToListResponse.status}`);
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