import express from 'express';
import cors from 'cors';
import pg from 'pg';
import dotenv from 'dotenv';
import { getCache, setCache, invalidateCache } from './redis.js';

import { fileURLToPath } from 'url';
import { dirname } from 'path';
import path from 'path';
import { format } from 'date-fns';
import { auth, db, createUser, verifyAndUpdateClaims } from './firebase-admin.js';
import { createCheckoutSession, handleWebhook } from './stripe.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: path.join(dirname(__dirname), '.env') });

const app = express();

// Middleware para o webhook do Stripe (deve vir antes de express.json)
app.post('/webhook', express.raw({ type: 'application/json' }), handleWebhook);

// Middlewares regulares
app.use(cors());
app.use(express.json());

// Middleware de autenticação básica (sem verificação de paid/admin)
const authenticateBasicUser = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Token não fornecido' });
    }

    const token = authHeader.split('Bearer ')[1];
    const decodedToken = await auth.verifyIdToken(token);

    // Buscar dados do usuário no Firestore
    const userRef<thinking>
Há erros de TypeScript no arquivo server/server-updated.js, especificamente na linha 524. Vou analisar o conteúdo do arquivo e corrigir os erros.

Os erros parecem estar relacionados à formatação do código. Vou revisar o arquivo e garantir que a sintaxe esteja correta, especialmente na parte final do arquivo.
</thinking>

<read_file>
<path>server/server-updated.js</path>
</read_file>
