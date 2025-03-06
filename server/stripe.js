import Stripe from 'stripe';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

// Create Supabase admin client
const supabaseAdmin = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

export const createCheckoutSession = async (req, res) => {
  const { userId, priceId } = req.body;

  try {
    // Verifica se o usuário existe no Supabase
    const { data: user, error: userError } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();

    if (userError || !user) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }

    // Cria ou recupera o cliente no Stripe
    let stripeCustomerId = user.stripe_customer_id;
    
    if (!stripeCustomerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: {
          supabaseUID: userId
        }
      });
      stripeCustomerId = customer.id;
      
      // Atualiza o usuário com o ID do cliente Stripe
      const { error: updateError } = await supabaseAdmin
        .from('users')
        .update({
          stripe_customer_id: customer.id,
          updated_at: new Date().toISOString()
        })
        .eq('id', userId);

      if (updateError) {
        throw updateError;
      }
    }

    // Cria a sessão de checkout
    const session = await stripe.checkout.sessions.create({
      customer: stripeCustomerId,
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      success_url: `${FRONTEND_URL}/payment/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${FRONTEND_URL}/payment/canceled`,
      metadata: {
        supabaseUID: userId
      }
    });

    res.json({ url: session.url });
  } catch (error) {
    console.error('Erro ao criar sessão de checkout:', error);
    res.status(500).json({ error: error.message });
  }
};

export const handleWebhook = async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;

  console.log('Recebido evento webhook do Stripe', { 
    headers: { 
      'stripe-signature': sig ? 'Presente' : 'Ausente',
      'content-type': req.headers['content-type']
    },
    bodySize: req.body ? Buffer.byteLength(req.body) : 0,
    timestamp: new Date().toISOString()
  });

  try {
    // Verificar se o webhook secret está configurado
    if (!process.env.STRIPE_WEBHOOK_SECRET) {
      console.error('ERRO CRÍTICO: STRIPE_WEBHOOK_SECRET não está configurado!');
      return res.status(500).send('Webhook error: Configuration missing');
    }

    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
    console.log(`Evento do Stripe recebido e validado: ${event.type}`, { 
      id: event.id, 
      tipo: event.type,
      hora: new Date().toISOString()
    });
  } catch (err) {
    console.error('Erro na verificação da assinatura do webhook:', err.message, {
      sig: sig ? 'Presente' : 'Ausente',
      webhookSecret: process.env.STRIPE_WEBHOOK_SECRET ? 'Configurado' : 'Não configurado',
      bodyPreview: req.body ? req.body.toString().substring(0, 100) : 'Vazio'
    });
    return res.status(400).send(`Erro no Webhook: ${err.message}`);
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        const userId = session.metadata && session.metadata.supabaseUID;
        
        if (!userId) {
          console.error('Erro no webhook: ID do usuário ausente nos metadados da sessão', {
            sessionId: session.id
          });
          return res.status(400).json({ error: 'ID do usuário ausente nos metadados da sessão' });
        }

        console.log('Processando checkout.session.completed para usuário:', userId, {
          sessionId: session.id,
          customerId: session.customer,
          subscription: session.subscription,
          dataHora: new Date().toISOString(),
          paymentStatus: session.payment_status
        });

        // Verifica se o usuário existe antes de atualizar
        const { data: userData, error: checkUserError } = await supabaseAdmin
          .from('users')
          .select('id, status')
          .eq('id', userId)
          .single();

        if (checkUserError) {
          console.error('Erro ao verificar usuário:', { userId, erro: checkUserError });
          throw new Error(`Usuário ${userId} não encontrado: ${checkUserError.message}`);
        }
        
        if (!userData) {
          console.error('Usuário não encontrado no banco de dados:', { userId });
          throw new Error(`Usuário ${userId} não existe no banco de dados`);
        }

        console.log('Status atual do usuário antes da atualização:', userData.status);

        // Atualiza o status do usuário no Supabase
        const { data: updatedUser, error: updateError } = await supabaseAdmin
          .from('users')
          .update({
            status: 'ATIVO',
            stripe_customer_id: session.customer,
            subscription_id: session.subscription,
            updated_at: new Date().toISOString(),
            payment_status: 'active',
            last_payment_date: new Date().toISOString()
          })
          .eq('id', userId)
          .select()
          .single();

        if (updateError) {
          console.error('Erro ao atualizar status do usuário no banco:', updateError, { userId });
          throw updateError;
        }

        if (!updatedUser) {
          console.error('Atualização do usuário falhou sem erro reportado:', { userId });
          throw new Error('Atualização do usuário falhou sem erro reportado');
        }

        console.log('Usuário atualizado com sucesso no banco:', {
          id: updatedUser.id,
          novoStatus: updatedUser.status,
          dataHora: new Date().toISOString()
        });

        // Força uma atualização do token de autenticação
        const { data: authUserData, error: userError } = await supabaseAdmin.auth.admin.getUserById(userId);
        if (userError) {
          console.error('Erro ao buscar dados do usuário na autenticação:', userError, { userId });
          throw userError;
        }

        if (!authUserData || !authUserData.user) {
          console.error('Usuário não encontrado na autenticação:', { userId });
          throw new Error('Usuário não encontrado na autenticação');
        }

        console.log('Metadados atuais do usuário:', authUserData.user.user_metadata);

        // Atualiza os metadados do usuário para refletir o novo status
        const { data: authUpdate, error: updateAuthError } = await supabaseAdmin.auth.admin.updateUserById(
          userId,
          {
            user_metadata: {
              ...authUserData.user.user_metadata,
              status: 'ATIVO'
            }
          }
        );

        if (updateAuthError) {
          console.error('Erro ao atualizar metadados do usuário:', updateAuthError, { userId });
          throw updateAuthError;
        }

        console.log('Metadados do usuário atualizados com sucesso:', {
          userId,
          novoStatus: 'ATIVO',
          dataHora: new Date().toISOString()
        });

        console.log('Processamento do evento checkout.session.completed concluído com sucesso');
        break;
      }

      case 'customer.subscription.deleted':
      case 'customer.subscription.updated': {
        const subscription = event.data.object;
        
        // Busca o usuário pelo ID do cliente Stripe
        const { data: users, error: userError } = await supabaseAdmin
          .from('users')
          .select('*')
          .eq('stripe_customer_id', subscription.customer);

        if (userError) {
          throw userError;
        }

        if (users && users.length > 0) {
          const user = users[0];
          const status = subscription.status === 'active' ? 'ATIVO' : 'INATIVO';

          const { error: updateError } = await supabaseAdmin
            .from('users')
            .update({
              status,
              payment_status: subscription.status,
              updated_at: new Date().toISOString(),
              // Atualizar a data do último pagamento se a assinatura estiver ativa
              ...(subscription.status === 'active' ? { last_payment_date: new Date().toISOString() } : {})
            })
            .eq('id', user.id);

          if (updateError) {
            throw updateError;
          }

          // Atualiza os metadados do usuário
          await supabaseAdmin.auth.admin.updateUserById(
            user.id,
            {
              user_metadata: {
                ...user.user_metadata,
                status
              }
            }
          );
        }

        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object;
        
        // Busca o usuário pelo ID do cliente Stripe
        const { data: users, error: userError } = await supabaseAdmin
          .from('users')
          .select('*')
          .eq('stripe_customer_id', invoice.customer);

        if (userError) {
          throw userError;
        }

        if (users && users.length > 0) {
          const user = users[0];
          
          const { error: updateError } = await supabaseAdmin
            .from('users')
            .update({
              status: 'INATIVO',
              payment_status: 'failed',
              updated_at: new Date().toISOString()
            })
            .eq('id', user.id);

          if (updateError) {
            throw updateError;
          }

          // Atualiza os metadados do usuário
          await supabaseAdmin.auth.admin.updateUserById(
            user.id,
            {
              user_metadata: {
                ...user.user_metadata,
                status: 'INATIVO'
              }
            }
          );
        }

        break;
      }
    }

    res.json({ received: true, event_id: event.id, type: event.type });
  } catch (error) {
    console.error('Erro ao processar webhook:', error, {
      eventType: event.type,
      eventId: event.id,
      timestamp: new Date().toISOString(),
      stack: error.stack
    });
    res.status(500).json({ 
      error: 'Erro ao processar webhook',
      details: error.message,
      event_id: event.id,
      type: event.type
    });
  }
};

export const testWebhook = async (req, res) => {
  try {
    console.log('Teste de webhook recebido');
    
    // Verificar a configuração de autenticação para o Supabase
    const adminClient = supabaseAdmin;
    if (!adminClient) {
      throw new Error('Cliente Supabase Admin não inicializado corretamente');
    }
    
    // Verificar a configuração do Stripe
    const stripeConfig = stripe;
    if (!stripeConfig) {
      throw new Error('Stripe não inicializado corretamente');
    }
    
    // Verificar as variáveis de ambiente
    const envCheck = {
      STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY ? 'Configurado' : 'Ausente',
      STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET ? 'Configurado' : 'Ausente',
      VITE_SUPABASE_URL: process.env.VITE_SUPABASE_URL ? 'Configurado' : 'Ausente',
      SUPABASE_SERVICE_KEY: process.env.SUPABASE_SERVICE_KEY ? 'Configurado' : 'Ausente'
    };
    
    // Verificar conexão com o Supabase
    const { data: testData, error: testError } = await adminClient
      .from('users')
      .select('count(*)')
      .limit(1);
      
    const supabaseStatus = {
      connected: !testError,
      error: testError ? testError.message : null,
      testData: testData
    };
    
    res.json({
      status: 'success',
      message: 'Webhook test endpoint is working correctly',
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV,
      envCheck,
      supabaseStatus,
      stripeInitialized: !!stripeConfig
    });
  } catch (error) {
    console.error('Erro no teste de webhook:', error);
    res.status(500).json({
      status: 'error',
      message: 'Erro no teste de webhook',
      error: error.message
    });
  }
};

// Função para simular o evento de checkout.session.completed
export const simulateCheckoutCompleted = async (req, res) => {
  try {
    const { userId } = req.body;
    
    if (!userId) {
      return res.status(400).json({
        status: 'error',
        message: 'ID do usuário não fornecido'
      });
    }
    
    console.log('Simulando evento checkout.session.completed para usuário:', userId);
    
    // Verifica se o usuário existe
    const { data: userData, error: checkUserError } = await supabaseAdmin
      .from('users')
      .select('id, status')
      .eq('id', userId)
      .single();

    if (checkUserError || !userData) {
      console.error('Erro ao verificar usuário:', { userId, erro: checkUserError });
      return res.status(404).json({
        status: 'error',
        message: 'Usuário não encontrado',
        error: checkUserError?.message
      });
    }

    console.log('Status atual do usuário antes da atualização:', userData.status);

    // Atualiza o status do usuário no Supabase
    const { data: updatedUser, error: updateError } = await supabaseAdmin
      .from('users')
      .update({
        status: 'ATIVO',
        updated_at: new Date().toISOString(),
        payment_status: 'active',
        last_payment_date: new Date().toISOString()
      })
      .eq('id', userId)
      .select()
      .single();

    if (updateError) {
      console.error('Erro ao atualizar status do usuário no banco:', updateError, { userId });
      return res.status(500).json({
        status: 'error',
        message: 'Erro ao atualizar status do usuário',
        error: updateError.message
      });
    }

    console.log('Usuário atualizado com sucesso no banco:', {
      id: updatedUser.id,
      novoStatus: updatedUser.status,
      dataHora: new Date().toISOString()
    });

    // Força uma atualização do token de autenticação
    const { data: authUserData, error: userError } = await supabaseAdmin.auth.admin.getUserById(userId);
    if (userError) {
      console.error('Erro ao buscar dados do usuário na autenticação:', userError, { userId });
      return res.status(500).json({
        status: 'error',
        message: 'Erro ao buscar dados do usuário',
        error: userError.message
      });
    }

    console.log('Metadados atuais do usuário:', authUserData.user.user_metadata);

    // Atualiza os metadados do usuário para refletir o novo status
    const { data: authUpdate, error: updateAuthError } = await supabaseAdmin.auth.admin.updateUserById(
      userId,
      {
        user_metadata: {
          ...authUserData.user.user_metadata,
          status: 'ATIVO'
        }
      }
    );

    if (updateAuthError) {
      console.error('Erro ao atualizar metadados do usuário:', updateAuthError, { userId });
      return res.status(500).json({
        status: 'error',
        message: 'Erro ao atualizar metadados do usuário',
        error: updateAuthError.message
      });
    }

    console.log('Metadados do usuário atualizados com sucesso:', {
      userId,
      novoStatus: 'ATIVO',
      dataHora: new Date().toISOString()
    });

    res.json({
      status: 'success',
      message: 'Simulação de evento checkout.session.completed executada com sucesso',
      updatedUser: {
        id: updatedUser.id,
        status: updatedUser.status,
        updated_at: updatedUser.updated_at
      }
    });
  } catch (error) {
    console.error('Erro na simulação do evento:', error);
    res.status(500).json({
      status: 'error',
      message: 'Erro na simulação do evento',
      error: error.message
    });
  }
};

/**
 * Função para verificar e converter manualmente um usuário de TRIAL para ATIVO
 * Verifica primeiro no Stripe se houve pagamento confirmado
 */
export const convertUserToActive = async (req, res) => {
  try {
    const { userId, forceConversion } = req.body;
    let userData; // Declare userData no escopo principal para evitar problemas de escopo
    
    console.log('Solicitação de conversão de usuário recebida:', { 
      userId, 
      forceConversion, 
      requestUser: req.user?.id || 'não autenticado'
    });
    
    if (!userId) {
      return res.status(400).json({
        status: 'error',
        message: 'ID do usuário não fornecido'
      });
    }
    
    console.log('Iniciando conversão manual para usuário:', userId);
    
    // Verificar usuário no banco de dados
    try {
      const { data: userDataFromDB, error: userError } = await supabaseAdmin
        .from('users')
        .select('*')
        .eq('id', userId)
        .single();
        
      if (userError) {
        console.error('Erro ao buscar usuário:', userError);
        return res.status(404).json({
          status: 'error',
          message: `Erro ao buscar usuário: ${userError.message}`,
          details: userError
        });
      }
      
      if (!userDataFromDB) {
        console.error('Usuário não encontrado no banco:', { userId });
        return res.status(404).json({
          status: 'error',
          message: 'Usuário não encontrado no banco de dados'
        });
      }
      
      // Atribuir os dados do usuário à variável no escopo principal
      userData = userDataFromDB;
      
      console.log('Dados do usuário encontrados:', {
        id: userData.id,
        email: userData.email,
        status: userData.status,
        stripeCustomerId: userData.stripe_customer_id,
        lastPaymentDate: userData.last_payment_date
      });
      
      if (userData.status === 'ATIVO') {
        return res.json({
          status: 'success',
          message: 'Usuário já está com status ATIVO',
          userData
        });
      }
    } catch (dbError) {
      console.error('Erro inesperado ao consultar banco de dados:', dbError);
      return res.status(500).json({
        status: 'error',
        message: `Erro ao acessar banco de dados: ${dbError.message}`,
        details: dbError
      });
    }
    
    let stripeVerification = { verified: false, reason: 'Não verificado' };
    
    // Se não for forçar a conversão e houver customer_id, verificar no Stripe
    if (!forceConversion && userData.stripe_customer_id) {
      try {
        console.log('Verificando pagamentos no Stripe para o cliente:', userData.stripe_customer_id);
        
        // Buscar o cliente no Stripe
        const customer = await stripe.customers.retrieve(userData.stripe_customer_id, {
          expand: ['subscriptions']
        });
        
        // Verificar se o cliente tem assinaturas ativas
        if (customer.subscriptions && customer.subscriptions.data.length > 0) {
          const activeSubscription = customer.subscriptions.data.find(sub => 
            sub.status === 'active' || sub.status === 'trialing' || sub.status === 'past_due'
          );
          
          if (activeSubscription) {
            stripeVerification = { 
              verified: true, 
              reason: `Assinatura ativa encontrada: ${activeSubscription.id}` 
            };
            console.log('Assinatura ativa encontrada:', activeSubscription.id);
          } else {
            stripeVerification = { 
              verified: false, 
              reason: 'Nenhuma assinatura ativa encontrada' 
            };
            console.log('Nenhuma assinatura ativa encontrada para o cliente');
          }
        } else {
          // Se não tiver assinaturas, verificar pagamentos
          const payments = await stripe.paymentIntents.list({
            customer: userData.stripe_customer_id,
            limit: 5
          });
          
          const successfulPayment = payments.data.find(payment => payment.status === 'succeeded');
          
          if (successfulPayment) {
            stripeVerification = { 
              verified: true, 
              reason: `Pagamento confirmado encontrado: ${successfulPayment.id}` 
            };
            console.log('Pagamento confirmado encontrado:', successfulPayment.id);
          } else {
            stripeVerification = { 
              verified: false, 
              reason: 'Nenhum pagamento confirmado encontrado' 
            };
            console.log('Nenhum pagamento confirmado encontrado para o cliente');
          }
        }
      } catch (stripeError) {
        console.error('Erro ao verificar dados no Stripe:', stripeError);
        stripeVerification = { 
          verified: false, 
          reason: `Erro ao verificar dados no Stripe: ${stripeError.message}` 
        };
      }
    } else if (forceConversion) {
      stripeVerification = { 
        verified: true, 
        reason: 'Conversão forçada por administrador' 
      };
      console.log('Conversão forçada solicitada, ignorando verificação no Stripe');
    }
    
    // Se a verificação no Stripe foi bem-sucedida OU estamos forçando a conversão
    if (stripeVerification.verified || forceConversion) {
      console.log('Procedendo com a conversão para ATIVO');
      
      try {
        // Atualizar status no banco de dados
        const { data: updatedUser, error: updateError } = await supabaseAdmin
          .from('users')
          .update({
            status: 'ATIVO',
            updated_at: new Date().toISOString(),
            payment_status: 'active',
            last_payment_date: new Date().toISOString()
          })
          .eq('id', userId)
          .select()
          .single();
          
        if (updateError) {
          console.error('Erro ao atualizar status do usuário no banco:', updateError);
          return res.status(500).json({
            status: 'error',
            message: `Erro ao atualizar status do usuário: ${updateError.message}`,
            details: updateError
          });
        }
        
        if (!updatedUser) {
          console.error('Usuário não encontrado após tentativa de atualização');
          return res.status(404).json({
            status: 'error',
            message: 'Usuário não encontrado após tentativa de atualização'
          });
        }
        
        console.log('Usuário atualizado com sucesso no banco de dados:', {
          id: updatedUser.id,
          status: updatedUser.status,
          lastPaymentDate: updatedUser.last_payment_date
        });
        
        // Atualizar metadados de autenticação
        try {
          const { data: authData, error: authError } = await supabaseAdmin.auth.admin.getUserById(userId);
          
          if (authError) {
            console.error('Erro ao buscar dados de autenticação:', authError);
            // Continuar mesmo com erro, apenas reportar o problema parcial
            return res.status(206).json({
              status: 'partial_success',
              message: 'Usuário atualizado no banco, mas falha ao atualizar metadados',
              error: `Erro ao buscar dados de autenticação: ${authError.message}`,
              user: {
                id: updatedUser.id,
                email: updatedUser.email,
                status: updatedUser.status
              },
              stripeVerification
            });
          }
          
          if (!authData || !authData.user) {
            console.error('Dados de autenticação não encontrados para o usuário:', userId);
            return res.status(206).json({
              status: 'partial_success',
              message: 'Usuário atualizado no banco, mas dados de autenticação não encontrados',
              user: {
                id: updatedUser.id,
                email: updatedUser.email,
                status: updatedUser.status
              },
              stripeVerification
            });
          }
          
          const userMetadata = authData.user.user_metadata || {};
          const { error: updateAuthError } = await supabaseAdmin.auth.admin.updateUserById(
            userId,
            {
              user_metadata: {
                ...userMetadata,
                status: 'ATIVO'
              }
            }
          );
          
          if (updateAuthError) {
            console.error('Erro ao atualizar metadados do usuário:', updateAuthError);
            return res.status(206).json({
              status: 'partial_success',
              message: 'Usuário atualizado no banco, mas falha ao atualizar metadados',
              error: `Erro ao atualizar metadados: ${updateAuthError.message}`,
              user: {
                id: updatedUser.id,
                email: updatedUser.email,
                status: updatedUser.status
              },
              stripeVerification
            });
          }
          
          console.log('Metadados de autenticação atualizados com sucesso');
          
          return res.json({
            status: 'success',
            message: 'Usuário convertido para ATIVO com sucesso',
            user: {
              id: updatedUser.id,
              email: updatedUser.email,
              status: updatedUser.status,
              lastPaymentDate: updatedUser.last_payment_date
            },
            stripeVerification
          });
        } catch (authUpdateError) {
          console.error('Erro inesperado ao atualizar metadados de autenticação:', authUpdateError);
          
          // Mesmo com erro nos metadados, retornamos sucesso parcial
          return res.status(206).json({
            status: 'partial_success',
            message: 'Usuário atualizado no banco, mas falha ao atualizar metadados',
            user: {
              id: updatedUser.id,
              email: updatedUser.email,
              status: updatedUser.status
            },
            error: authUpdateError.message,
            stripeVerification
          });
        }
      } catch (dbUpdateError) {
        console.error('Erro inesperado ao atualizar usuário no banco:', dbUpdateError);
        return res.status(500).json({
          status: 'error',
          message: `Erro ao atualizar usuário no banco: ${dbUpdateError.message}`,
          details: dbUpdateError
        });
      }
    } else {
      // Se não verificou no Stripe e não estamos forçando
      return res.status(400).json({
        status: 'error',
        message: 'Não foi possível verificar pagamento no Stripe',
        details: stripeVerification.reason,
        user: {
          id: userData.id,
          email: userData.email,
          status: userData.status
        }
      });
    }
  } catch (error) {
    console.error('Erro global na conversão de usuário:', error);
    return res.status(500).json({
      status: 'error',
      message: `Erro interno durante a conversão: ${error.message}`,
      stack: process.env.NODE_ENV !== 'production' ? error.stack : undefined
    });
  }
};
