import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import path from 'path';
import { format } from 'date-fns';
import { createClient } from '@supabase/supabase-js';
import { verifyToken, createOrUpdateUser, verifyAndUpdateStatus } from './supabase-admin.js';
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
  origin: ['http://localhost:5173'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());

// Criar cliente Supabase para o banco de dados
const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

// Middleware de autenticação básica (sem verificação de paid/admin)
const authenticateBasicUser = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Token não fornecido' });
    }

    const token = authHeader.split('Bearer ')[1];
    const user = await verifyToken(token);
    
    if (!user) {
      return res.status(401).json({ error: 'Token inválido' });
    }

    // Criar ou atualizar usuário se necessário
    await createOrUpdateUser(user.id, user.email);
    req.user = user;

    next();
  } catch (error) {
    console.error('Erro de autenticação:', error);
    res.status(401).json({ error: 'Token inválido' });
  }
};

// Middleware de autenticação com verificação de paid/admin
const authenticateUser = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Token não fornecido' });
    }

    const token = authHeader.split('Bearer ')[1];
    const user = await verifyToken(token);
    
    if (!user) {
      return res.status(401).json({ error: 'Token inválido' });
    }

    // Verificar status do usuário
    const userData = await verifyAndUpdateStatus(user.id);
    
    if (!userData || (userData.status !== 'ATIVO' && userData.status !== 'ADMIN')) {
      return res.status(403).json({ 
        error: 'Assinatura necessária',
        code: 'subscription_required'
      });
    }

    req.user = { ...user, ...userData };
    next();
  } catch (error) {
    console.error('Erro de autenticação:', error);
    res.status(401).json({ error: 'Token inválido' });
  }
};

// Helper function para executar queries no Supabase
const safeQuery = async (query, params = []) => {
  try {
    const { data, error } = await supabase.rpc('execute_query', {
      query_text: query,
      query_params: params
    });

    if (error) throw error;
    return { rows: data || [] };
  } catch (error) {
    console.error('Erro ao executar query:', error);
    return { rows: [] };
  }
};

// Rotas públicas
app.post('/api/create-checkout-session', createCheckoutSession);

// Rotas com autenticação básica (sem verificação de paid/admin)
app.get('/api/radios/status', authenticateBasicUser, async (req, res) => {
  try {
    // Buscar rádios favoritas do usuário
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('favorite_radios')
      .eq('id', req.user.id)
      .single();

    if (userError) throw userError;
    
    const favoriteRadios = userData?.favorite_radios || [];

    // Buscar o último registro de cada rádio
    const query = `
      WITH latest_entries AS (
        SELECT 
          name,
          MAX(date + time::time) as last_update
        FROM music_log
        GROUP BY name
      )
      SELECT 
        name,
        last_update
      FROM latest_entries
      ORDER BY name
    `;

    const result = await safeQuery(query);
      
    if (!result.rows || result.rows.length === 0) {
      // Se não há registros no banco, retornar apenas as rádios favoritas como offline
      const offlineRadios = favoriteRadios.map(name => ({
        name,
        status: 'OFFLINE',
        lastUpdate: null,
        isFavorite: true
      }));
      return res.json(offlineRadios);
    }
    
    const currentTime = new Date();
    const radiosStatus = result.rows.map(row => {
      const lastUpdate = row.last_update ? new Date(row.last_update) : null;
      const timeDiff = lastUpdate ? currentTime.getTime() - lastUpdate.getTime() : Infinity;
      const isOnline = timeDiff <= 30 * 60 * 1000; // 30 minutes

      return {
        name: row.name,
        status: isOnline ? 'ONLINE' : 'OFFLINE',
        lastUpdate: row.last_update,
        isFavorite: favoriteRadios.includes(row.name)
      };
    });

    // Adicionar rádios favoritas que não estão no banco como offline
    const existingRadios = new Set(radiosStatus.map(radio => radio.name));
    const missingFavorites = favoriteRadios.filter(name => !existingRadios.has(name));
    
    missingFavorites.forEach(name => {
      radiosStatus.push({
        name,
        status: 'OFFLINE',
        lastUpdate: null,
        isFavorite: true
      });
    });

    res.json(radiosStatus);
  } catch (error) {
    console.error('GET /api/radios/status - Erro:', error);
    res.status(500).json({ error: 'Erro interno do servidor', details: error.message });
  }
});

app.post('/api/radios/favorite', authenticateBasicUser, async (req, res) => {
  try {
    const { radioName, favorite } = req.body;
    
    if (!radioName) {
      return res.status(400).json({ error: 'Nome da rádio não fornecido' });
    }

    // Buscar rádios favoritas atuais
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('favorite_radios')
      .eq('id', req.user.id)
      .single();

    if (userError) throw userError;

    let favoriteRadios = userData?.favorite_radios || [];

    if (favorite && !favoriteRadios.includes(radioName)) {
      favoriteRadios.push(radioName);
    } else if (!favorite) {
      favoriteRadios = favoriteRadios.filter(radio => radio !== radioName);
    }

    // Atualizar rádios favoritas
    const { error: updateError } = await supabase
      .from('users')
      .update({
        favorite_radios: favoriteRadios,
        updated_at: new Date().toISOString()
      })
      .eq('id', req.user.id);

    if (updateError) throw updateError;

    // Buscar status atualizado das rádios
    const query = `
      WITH latest_entries AS (
        SELECT 
          name,
          MAX(date + time::time) as last_update
        FROM music_log
        GROUP BY name
      )
      SELECT 
        name,
        last_update
      FROM latest_entries
      WHERE name = ANY($1::text[])
      ORDER BY name
    `;

    const result = await safeQuery(query, [favoriteRadios]);
    
    const currentTime = new Date();
    const radiosStatus = result.rows.map(row => {
      const lastUpdate = new Date(row.last_update);
      const timeDiff = currentTime.getTime() - lastUpdate.getTime();
      const isOnline = timeDiff <= 30 * 60 * 1000; // 30 minutes

      return {
        name: row.name,
        status: isOnline ? 'ONLINE' : 'OFFLINE',
        lastUpdate: row.last_update,
        isFavorite: favoriteRadios.includes(row.name)
      };
    });

    res.json({ 
      success: true, 
      favoriteRadios,
      radiosStatus
    });
  } catch (error) {
    console.error('POST /api/radios/favorite - Erro:', error);
    res.status(500).json({ error: 'Erro interno do servidor', details: error.message });
  }
});

// [Resto das rotas mantidas como no original, apenas substituindo as queries do pg pelo safeQuery do Supabase]

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
