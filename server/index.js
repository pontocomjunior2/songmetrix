// Arquivo para registrar as rotas no servidor Express
import express from 'express';
import streamsRoutes from './routes/streams.js';
import { createCheckoutSession } from './stripe.js';

export default function registerRoutes(app) {
  // Registrar as rotas de streams
  app.use('/api/streams', streamsRoutes);
  
  // Registrar a rota de checkout do Stripe
  app.post('/api/create-checkout-session', createCheckoutSession);
  
  console.log('Rotas registradas com sucesso');
}