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
    console.log('Payload recebido:', payload);
    
    // Verificar se é uma criação ou atualização de usuário
    if (!payload.type || !['INSERT', 'UPDATE'].includes(payload.type)) {
      throw new Error('Tipo de evento não suportado');
    }
    
    // Verificar se há dados do usuário
    if (!payload.record || !payload.record.id || !payload.record.email) {
      throw new Error('Dados do usuário incompletos');
    }
    
    const userId = payload.record.id;
    const userEmail = payload.record.email;
    
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
    
    console.log('Dados do usuário:', userData);
    
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
    
    // Preparar dados para enviar ao Brevo
    const brevoContact = {
      email: userEmail,
      attributes: attributes,
      listIds: [], // Não adicionar à lista principal, vamos gerenciar pelas listas específicas
      updateEnabled: true
    };
    
    // Determinar a lista apropriada pelo status do usuário
    const userStatus = userData.status;
    const targetListId = statusListIds[userStatus];
    
    if (targetListId) {
      brevoContact.listIds = [parseInt(targetListId)];
      console.log(`Status do usuário: ${userStatus}, adicionando à lista ${targetListId}`);
    } else {
      console.warn(`Status do usuário não mapeado para uma lista: ${userStatus}`);
    }
    
    console.log('Dados para o Brevo:', brevoContact);
    
    // Enviar requisição para o Brevo
    const brevoResponse = await fetch('https://api.brevo.com/v3/contacts', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': brevoApiKey
      },
      body: JSON.stringify(brevoContact)
    });
    
    // Verificar resposta
    const brevoResult = await brevoResponse.json();
    
    if (!brevoResponse.ok) {
      // Se o contato já existir, tentar atualizar
      if (brevoResponse.status === 400 && brevoResult.code === 'duplicate_parameter') {
        console.log('Contato já existe, tentando atualizar...');
        
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
        
        const contactData = await getContactResponse.json();
        console.log('Dados do contato no Brevo:', contactData);
        
        // Gerenciar as listas do contato com base no status
        if (userStatus) {
          console.log(`Gerenciando listas para o status: ${userStatus}`);
          
          // Remover das listas de status primeiro
          for (const listId of Object.values(statusListIds)) {
            try {
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
              
              console.log(`Resultado da remoção da lista ${listId}:`, removeResponse.status);
            } catch (removeError) {
              console.warn(`Erro ao remover da lista ${listId}:`, removeError);
              // Continuar mesmo com erro (pode não estar na lista)
            }
          }
          
          // Adicionar à lista correta para o status atual
          if (targetListId) {
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
            
            const addToListResult = await addToListResponse.json();
            console.log(`Resultado da adição à lista ${targetListId}:`, addToListResult);
          }
        } else if (brevoMainListId) {
          // Se não tiver status, adicionar à lista principal
          console.log(`Adicionando contato à lista principal ${brevoMainListId} (sem status)`);
          
          const addToListResponse = await fetch(`https://api.brevo.com/v3/contacts/lists/${brevoMainListId}/contacts/add`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'api-key': brevoApiKey
            },
            body: JSON.stringify({
              emails: [userEmail]
            })
          });
          
          const addToListResult = await addToListResponse.json();
          console.log('Resultado da adição à lista principal:', addToListResult);
        }
      } else {
        throw new Error(`Erro ao criar contato no Brevo: ${brevoResult.message || JSON.stringify(brevoResult)}`);
      }
    } else {
      // Contato criado com sucesso, verificar se está na lista correta
      console.log('Contato criado com sucesso no Brevo');
      
      // Se tiver um ID de lista específico para o status, garantir que esteja nessa lista
      if (targetListId && userStatus) {
        console.log(`Verificando se contato está na lista correta para o status ${userStatus}`);
        
        // Para garantir, adicionar explicitamente à lista correta
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
        
        const addToListResult = await addToListResponse.json();
        console.log(`Resultado da verificação/adição à lista ${targetListId}:`, addToListResult);
      }
    }
    
    console.log('Resultado do Brevo:', brevoResult);
    
    // Retornar resposta de sucesso
    return new Response(
      JSON.stringify({
        success: true,
        message: 'Usuário sincronizado com o Brevo com sucesso',
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