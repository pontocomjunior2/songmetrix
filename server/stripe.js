import Stripe from 'stripe';
import dotenv from 'dotenv';
import { db, UserStatus } from './firebase-admin.js';

dotenv.config();

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

export const createCheckoutSession = async (req, res) => {
  const { userId, priceId } = req.body;

  try {
    // Verifica se o usuário existe no Firestore
    const userDoc = await db.collection('users').doc(userId).get();
    if (!userDoc.exists) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }

    // Cria ou recupera o cliente no Stripe
    let stripeCustomerId = userDoc.data().stripeCustomerId;
    
    if (!stripeCustomerId) {
      const customer = await stripe.customers.create({
        email: userDoc.data().email,
        metadata: {
          firebaseUID: userId
        }
      });
      stripeCustomerId = customer.id;
      
      // Atualiza o documento do usuário com o ID do cliente Stripe
      await db.collection('users').doc(userId).update({
        stripeCustomerId: customer.id
      });
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
      success_url: `${FRONTEND_URL}/payment-success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${FRONTEND_URL}/payment-canceled`,
      metadata: {
        firebaseUID: userId
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
        const userId = session.metadata.firebaseUID;

        // Atualiza o status do usuário no Firestore
        await db.collection('users').doc(userId).update({
          status: UserStatus.PAID,
          stripeCustomerId: session.customer,
          subscriptionId: session.subscription,
          updatedAt: new Date().toISOString(),
          paymentStatus: 'active',
          lastPaymentDate: new Date().toISOString()
        });

        break;
      }

      case 'customer.subscription.deleted':
      case 'customer.subscription.updated': {
        const subscription = event.data.object;
        
        // Busca o usuário pelo ID do cliente Stripe
        const usersRef = db.collection('users');
        const snapshot = await usersRef.where('stripeCustomerId', '==', subscription.customer).get();

        if (!snapshot.empty) {
          const userDoc = snapshot.docs[0];
          const status = subscription.status === 'active' ? UserStatus.PAID : UserStatus.NOT_PAID;

          await userDoc.ref.update({
            status,
            paymentStatus: subscription.status,
            updatedAt: new Date().toISOString()
          });
        }

        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object;
        
        // Busca o usuário pelo ID do cliente Stripe
        const usersRef = db.collection('users');
        const snapshot = await usersRef.where('stripeCustomerId', '==', invoice.customer).get();

        if (!snapshot.empty) {
          const userDoc = snapshot.docs[0];
          await userDoc.ref.update({
            status: UserStatus.NOT_PAID,
            paymentStatus: 'failed',
            updatedAt: new Date().toISOString()
          });
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
