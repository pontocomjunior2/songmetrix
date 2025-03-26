// Função Edge do Supabase para sincronizar usuários com o Brevo
import { serve } from 'https://deno.land/std@0.131.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.23.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Log aprimorado para depuração
function logDebug(message: string, data?: any) {
  console.log(`[${new Date().toISOString()}] ${message}`);
  if (data) {
    console.log(JSON.stringify(data, null, 2).substring(0, 500) + (JSON.stringify(data).length > 500 ? '...' : ''));
  }
}

serve(async (req) => {
  // Tratamento para requisições OPTIONS (CORS)
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Obter as variáveis de ambiente
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const brevoApiKey = Deno.env.get('BREVO_API_KEY') || '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';
    
    // IDs corretos das listas do Brevo conforme o status do usuário
    const statusListIds = {
      TRIAL: '7',    // Lista para usuários Trial
      ATIVO: '8',    // Lista para usuários Ativos
      INATIVO: '9',  // Lista para usuários Inativos
      ADMIN: '8'     // Admins vão para a mesma lista que usuários ativos
    };
    
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Variáveis de ambiente do Supabase não configuradas');
    }
    
    // Criar cliente Supabase
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    // Obter dados da requisição
    const payload = await req.json();
    logDebug('Payload recebido:', payload);
    
    // Manipulação de chamada direta sem ser webhook de database
    if (!payload.type) {
      // Se for chamada direta, verificar se é teste direto ou novo usuário trial
      logDebug('Chamada direta detectada, processando usuário para Brevo');
      
      // Determinar se temos dados de usuário válidos
      if (payload.email) {
        // Considerar como teste direto da função
        logDebug('Processando dados do usuário:', payload);
        
        // Determinar o status do usuário, default para TRIAL se não especificado
        const userStatus = payload.status || 'TRIAL';
        const userName = payload.name || '';
        const userId = payload.id || 'direct-test';
        
        // Enviar para o Brevo
        const brevoResponse = await syncToBrevo(
          payload.email, 
          userName, 
          userStatus, 
          userId, 
          brevoApiKey, 
          statusListIds
        );
        
        return new Response(
          JSON.stringify({
            success: true,
            message: 'Usuário sincronizado com o Brevo',
            email: payload.email,
            status: userStatus,
            brevoResponse
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
    }
    
    // Verificar se é um evento DELETE (exclusão de usuário)
    if (payload.type === 'DELETE') {
      if (!payload.old_record || !payload.old_record.id || !payload.old_record.email) {
        console.error('Dados incompletos do registro a ser excluído:', payload.old_record);
        throw new Error('Dados do usuário excluído incompletos');
      }
      
      const userId = payload.old_record.id;
      const userEmail = payload.old_record.email;
      
      logDebug(`Processando exclusão do usuário: ${userEmail}, ID: ${userId}`);
      
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
          logDebug(`Contato encontrado no Brevo: ${userEmail}. Removendo de todas as listas...`);
          
          // Remover de todas as listas
          for (const listId of Object.values(statusListIds)) {
            try {
              logDebug(`Removendo contato da lista ${listId}...`);
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
                logDebug(`Contato removido com sucesso da lista ${listId}`);
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
          logDebug(`Contato não encontrado no Brevo: ${userEmail}. Nada a fazer.`);
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
    const currentStatus = payload.record.status || 'TRIAL';  // Default para TRIAL se não especificado
    const userName = payload.record.full_name || '';
    
    logDebug(`Processando usuário: ${userEmail}, ID: ${userId}, Status: ${currentStatus}`);
    
    // Verificar se é uma mudança de status
    let oldStatus = null;
    let isStatusChange = false;
    
    if (payload.type === 'UPDATE' && payload.old_record && 
        payload.old_record.status && payload.record.status &&
        payload.old_record.status !== payload.record.status) {
      oldStatus = payload.old_record.status;
      isStatusChange = true;
      logDebug(`Detectada mudança de status: ${oldStatus} -> ${currentStatus}`);
    }
    
    // Enviar para o Brevo
    const brevoResponse = await syncToBrevo(
      userEmail, 
      userName, 
      currentStatus, 
      userId, 
      brevoApiKey, 
      statusListIds
    );
    
    // Verificar se é necessário atualizar a tabela users
    if (payload.type === 'INSERT' && payload.table === 'auth.users') {
      // É um novo usuário do auth, precisamos garantir que ele tenha um registro na tabela users
      try {
        logDebug(`Verificando/criando registro na tabela users para: ${userEmail}`);
        
        // Verificar se já existe um registro para este usuário
        const { data: existingUser, error: checkError } = await supabase
          .from('users')
          .select('id')
          .eq('id', userId)
          .single();
        
        if (checkError && checkError.code !== 'PGRST116') {
          console.error('Erro ao verificar usuário existente:', checkError);
        }
        
        if (!existingUser) {
          // Extrair nome do email se não tiver nome
          let fullName = '';
          if (payload.record.raw_user_meta_data && payload.record.raw_user_meta_data.name) {
            fullName = payload.record.raw_user_meta_data.name;
          } else {
            fullName = userEmail.split('@')[0];
          }
          
          // Determinar status baseado nos metadados
          let status = 'TRIAL';
          if (payload.record.raw_user_meta_data && payload.record.raw_user_meta_data.status) {
            status = payload.record.raw_user_meta_data.status;
          }
          
          // Inserir o usuário na tabela users
          const { error: insertError } = await supabase
            .from('users')
            .insert({
              id: userId,
              email: userEmail,
              full_name: fullName,
              status: status,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            });
          
          if (insertError) {
            console.error('Erro ao inserir usuário na tabela users:', insertError);
          } else {
            logDebug(`Usuário inserido com sucesso na tabela users: ${userEmail}`);
          }
        }
      } catch (error) {
        console.error('Erro ao verificar/criar registro de usuário:', error);
      }
    }
    
    // Resposta final
    return new Response(
      JSON.stringify({
        success: brevoResponse.success,
        message: `Usuário ${isStatusChange ? 'atualizado' : 'sincronizado'} com o Brevo`,
        userId,
        email: userEmail,
        status: currentStatus,
        oldStatus: isStatusChange ? oldStatus : null,
        brevoStatus: brevoResponse.status,
        brevoResult: brevoResponse.result ? brevoResponse.result.substring(0, 200) : null
      }),
      {
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders
        },
        status: brevoResponse.success ? 200 : 500
      }
    );
  } catch (error) {
    console.error('Erro ao processar webhook:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message
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

async function syncToBrevo(
  email: string, 
  name: string, 
  status: string, 
  userId: string, 
  apiKey: string, 
  statusListIds: Record<string, string>
) {
  try {
    logDebug(`Sincronizando com Brevo: ${email}, Status: ${status}`);
    
    // Determinar o ID da lista correta com base no status
    const listId = statusListIds[status];
    if (!listId) {
      console.warn(`Status desconhecido '${status}', usando lista TRIAL para: ${email}`);
    }
    
    // Definir o ID da lista a ser usada (padrão para TRIAL se não encontrar correspondência)
    const targetListId = listId || statusListIds['TRIAL'];
    logDebug(`Lista alvo para ${status}: ${targetListId}`);
    
    // Preparar payload com atributos para o Brevo
    const payload = {
      email: email,
      attributes: {
        NOME: name,
        FNAME: name.split(' ')[0] || '',
        LNAME: name.split(' ').slice(1).join(' ') || '',
        STATUS: status,
        USER_ID: userId,
        DATA_CADASTRO: new Date().toISOString().split('T')[0]
      },
      listIds: [parseInt(targetListId)],
      updateEnabled: true
    };
    
    logDebug('Payload para Brevo:', payload);
    
    // Verificar se o contato já existe
    const checkResponse = await fetch(`https://api.brevo.com/v3/contacts/${encodeURIComponent(email)}`, {
      method: 'GET',
      headers: {
        'api-key': apiKey
      }
    });
    
    let response;
    
    if (checkResponse.ok) {
      // Contato existe, atualizar seus atributos
      logDebug('Contato já existe no Brevo, atualizando...');
      
      // 1. Atualizar atributos do contato
      response = await fetch('https://api.brevo.com/v3/contacts', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'api-key': apiKey
        },
        body: JSON.stringify({
          email: email,
          attributes: payload.attributes
        })
      });
      
      if (!response.ok) {
        const updateError = await response.text();
        console.error(`Erro ao atualizar atributos do contato ${email}:`, updateError);
        return {
          success: false,
          status: response.status,
          result: updateError
        };
      }
      
      // 2. Remover o contato de todas as outras listas
      for (const [listStatus, listId] of Object.entries(statusListIds)) {
        // Pular a lista alvo - não precisamos remover da lista que ele deve estar
        if (listId === targetListId) continue;
        
        try {
          const removeResponse = await fetch(`https://api.brevo.com/v3/contacts/lists/${listId}/contacts/remove`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'api-key': apiKey
            },
            body: JSON.stringify({
              emails: [email]
            })
          });
          
          if (removeResponse.ok) {
            logDebug(`Contato removido da lista ${listId} (${listStatus})`);
          }
        } catch (removeError) {
          console.warn(`Erro ao remover contato da lista ${listId}: ${removeError.message}`);
        }
      }
      
      // 3. Adicionar à lista correta
      const addResponse = await fetch(`https://api.brevo.com/v3/contacts/lists/${targetListId}/contacts/add`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'api-key': apiKey
        },
        body: JSON.stringify({
          emails: [email]
        })
      });
      
      if (addResponse.ok) {
        logDebug(`Contato adicionado com sucesso à lista ${targetListId}`);
        return {
          success: true,
          status: 200,
          result: `Contato atualizado e movido para lista ${targetListId}`
        };
      } else {
        const addError = await addResponse.text();
        console.warn(`Falha ao adicionar à lista ${targetListId}: ${addResponse.status}`, addError);
        return {
          success: false,
          status: addResponse.status,
          result: addError
        };
      }
    } else {
      // Contato não existe, criar novo
      logDebug('Criando novo contato no Brevo...');
      
      response = await fetch('https://api.brevo.com/v3/contacts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'api-key': apiKey
        },
        body: JSON.stringify(payload)
      });
      
      const result = await response.text();
      
      // Verificar se é um erro de duplicação (contato já existe)
      if (!response.ok && response.status === 400) {
        try {
          const errorData = JSON.parse(result);
          
          if (errorData.code === 'duplicate_parameter') {
            logDebug('Contato duplicado, tentando atualizar como existente');
            
            // Atualizar os atributos do contato
            const updateResponse = await fetch('https://api.brevo.com/v3/contacts', {
              method: 'PUT',
              headers: {
                'Content-Type': 'application/json',
                'api-key': apiKey
              },
              body: JSON.stringify({
                email: email,
                attributes: payload.attributes
              })
            });
            
            if (updateResponse.ok) {
              // Adicionar à lista correta
              await fetch(`https://api.brevo.com/v3/contacts/lists/${targetListId}/contacts/add`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'api-key': apiKey
                },
                body: JSON.stringify({
                  emails: [email]
                })
              });
              
              return {
                success: true,
                status: 200,
                result: 'Contato atualizado após erro de duplicação'
              };
            }
          }
        } catch (parseError) {
          console.error('Erro ao analisar resposta de erro:', parseError);
        }
      }
      
      logDebug(`Resposta da API Brevo (criar contato): ${response.status}`, result);
      
      return {
        success: response.status >= 200 && response.status < 300,
        status: response.status,
        result: result
      };
    }
  } catch (error) {
    console.error('Erro ao sincronizar com Brevo:', error);
    return {
      success: false,
      error: error.message
    };
  }
} 