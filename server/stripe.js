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

  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error('Erro na verificação da assinatura do webhook:', err.message);
    return res.status(400).send(`Erro no Webhook: ${err.message}`);
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        const userId = session.metadata.supabaseUID;

        console.log('Processando checkout.session.completed para usuário:', userId);

        // Atualiza o status do usuário no Supabase
        const { error: updateError } = await supabaseAdmin
          .from('users')
          .update({
            status: 'ATIVO',
            stripe_customer_id: session.customer,
            subscription_id: session.subscription,
            updated_at: new Date().toISOString(),
            payment_status: 'active',
            last_payment_date: new Date().toISOString()
          })
          .eq('id', userId);

        if (updateError) {
          console.error('Erro ao atualizar status do usuário:', updateError);
          throw updateError;
        }

        // Força uma atualização do token de autenticação
        const { data: userData, error: userError } = await supabaseAdmin.auth.admin.getUserById(userId);
        if (userError) {
          console.error('Erro ao buscar dados do usuário:', userError);
          throw userError;
        }

        // Atualiza os metadados do usuário para refletir o novo status
        const { error: updateAuthError } = await supabaseAdmin.auth.admin.updateUserById(
          userId,
          {
            user_metadata: {
              ...userData.user.user_metadata,
              status: 'ATIVO'
            }
          }
        );

        if (updateAuthError) {
          console.error('Erro ao atualizar metadados do usuário:', updateAuthError);
          throw updateAuthError;
        }

        console.log('Status do usuário atualizado com sucesso para ATIVO');
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

    res.json({ received: true });
  } catch (error) {
    console.error('Erro ao processar webhook:', error);
    res.status(500).json({ error: 'Erro ao processar webhook' });
  }
};
