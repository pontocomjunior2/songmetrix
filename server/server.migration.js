import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import path from 'path';
import { format } from 'date-fns';
import { authenticateBasicUser, authenticateUser } from './auth-middleware.js';
import { createCheckoutSession, handleWebhook } from './stripe.js';
import { reportQuery } from './report-query.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: path.join(dirname(__dirname), '.env') });

const app = express();

// Middleware para o webhook do Stripe (deve vir antes de express.json)
app.post('/webhook', express.raw({ type: 'application/json' }), handleWebhook);

// Middlewares regulares
app.use(cors({
  origin: ['http://localhost:5173'], // Allow requests from the frontend
  credentials: true, // Allow credentials to be included in requests
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());

// Rotas públicas
app.post('/api/create-checkout-session', createCheckoutSession);

// Rotas com autenticação básica (sem verificação de paid/admin)
app.get('/api/radios/status', authenticateBasicUser, async (req, res) => {
  // Implementação da rota...
});

// Resto das rotas...
// (Mantenha todas as rotas existentes, apenas substitua as chamadas ao Firestore por chamadas ao Supabase conforme necessário)

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
