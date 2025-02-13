import express from 'express';
import cors from 'cors';
import pg from 'pg';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import path from 'path';
import { auth } from './firebase-admin.js';
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

// Middleware de autenticação
const authenticateUser = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Token não fornecido' });
    }

    const token = authHeader.split('Bearer ')[1];
    const decodedToken = await auth.verifyIdToken(token);
    
    // Verifica se o usuário tem acesso pago
    if (!decodedToken.paid && !decodedToken.admin) {
      return res.status(403).json({ 
        error: 'Assinatura necessária',
        code: 'subscription_required'
      });
    }

    req.user = decodedToken;
    next();
  } catch (error) {
    console.error('Erro de autenticação:', error);
    res.status(401).json({ error: 'Token inválido' });
  }
};

const { Pool } = pg;

const pool = new Pool({
  user: process.env.POSTGRES_USER,
  host: process.env.POSTGRES_HOST,
  database: process.env.POSTGRES_DB,
  password: process.env.POSTGRES_PASSWORD,
  port: parseInt(process.env.POSTGRES_PORT),
  ssl: {
    rejectUnauthorized: false
  }
});

// Teste de conexão com o banco
pool.connect((err, client, done) => {
  if (err) {
    console.error('Erro ao conectar ao banco de dados:', err);
  } else {
    console.log('Conexão com o banco de dados estabelecida com sucesso');
    done();
  }
});

// Rotas públicas
app.post('/api/create-checkout-session', createCheckoutSession);

// Rotas protegidas
app.get('/api/radios', authenticateUser, async (req, res) => {
  try {
    console.log('GET /api/radios - Buscando rádios...');
    const result = await pool.query(
      'SELECT DISTINCT name FROM music_log ORDER BY name'
    );
    console.log('GET /api/radios - Rádios encontradas:', result.rows);
    const radios = result.rows.map(row => row.name);
    res.json(radios);
  } catch (error) {
    console.error('GET /api/radios - Erro:', error);
    res.status(500).json({ error: 'Erro interno do servidor', details: error.message });
  }
});

app.post('/api/executions', authenticateUser, async (req, res) => {
  const { filters, page = 0 } = req.body;
  const offset = page * 100;

  try {
    console.log('POST /api/executions - Corpo da requisição:', req.body);
    let query = `
      WITH adjusted_dates AS (
        SELECT 
          id,
          (date + INTERVAL '3 hours')::date as date,
          time::text,
          name as radio_name,
          artist,
          song_title,
          isrc,
          cidade as city,
          estado as state,
          genre,
          regiao as region,
          segmento as segment,
          label
        FROM music_log
      )
      SELECT * FROM adjusted_dates
      WHERE 1=1
    `;
    
    const params = [];
    let paramCount = 1;

    if (filters.radio) {
      query += ` AND radio_name = $${paramCount}`;
      params.push(filters.radio);
      paramCount++;
    }

    if (filters.artist) {
      query += ` AND artist ILIKE $${paramCount}`;
      params.push(`%${filters.artist}%`);
      paramCount++;
    }

    if (filters.song) {
      query += ` AND song_title ILIKE $${paramCount}`;
      params.push(`%${filters.song}%`);
      paramCount++;
    }

    if (filters.startDate && filters.endDate) {
      query += ` AND date BETWEEN $${paramCount} AND $${paramCount + 1}`;
      params.push(filters.startDate, filters.endDate);
      paramCount += 2;
    }

    if (filters.startTime && filters.endTime) {
      query += ` AND time BETWEEN $${paramCount} AND $${paramCount + 1}`;
      params.push(filters.startTime, filters.endTime);
      paramCount += 2;
    }

    query += ` ORDER BY date DESC, time DESC LIMIT 100 OFFSET $${paramCount}`;
    params.push(offset);

    console.log('POST /api/executions - Query:', query);
    console.log('POST /api/executions - Parâmetros:', params);

    const result = await pool.query(query, params);
    console.log('POST /api/executions - Linhas encontradas:', result.rows.length);

    res.json(result.rows);
  } catch (error) {
    console.error('POST /api/executions - Erro:', error);
    res.status(500).json({ error: 'Erro interno do servidor', details: error.message });
  }
});

app.get('/api/ranking', authenticateUser, async (req, res) => {
  try {
    const { startDate, endDate, startTime, endTime, radio, rankingSize = '10' } = req.query;
    const limit = parseInt(rankingSize, 10);

    let query = `
      WITH adjusted_dates AS (
        SELECT 
          artist,
          song_title,
          genre,
          (date + INTERVAL '3 hours')::date as date,
          time,
          name
        FROM music_log
      ),
      execution_counts AS (
        SELECT 
          artist,
          song_title,
          genre,
          COUNT(*) as executions
        FROM adjusted_dates
        WHERE 1=1
    `;

    const params = [];
    let paramCount = 1;

    if (startDate && endDate) {
      query += ` AND date BETWEEN $${paramCount} AND $${paramCount + 1}`;
      params.push(startDate, endDate);
      paramCount += 2;
    }

    if (startTime && endTime) {
      query += ` AND time BETWEEN $${paramCount} AND $${paramCount + 1}`;
      params.push(startTime, endTime);
      paramCount += 2;
    }

    if (radio) {
      const radios = radio.split(',').filter(Boolean);
      if (radios.length > 0) {
        query += ` AND name = ANY($${paramCount}::text[])`;
        params.push(radios);
        paramCount++;
      }
    }

    query += `
        GROUP BY artist, song_title, genre
      )
      SELECT 
        ROW_NUMBER() OVER (ORDER BY executions DESC) as id,
        artist,
        song_title,
        genre,
        executions
      FROM execution_counts
      ORDER BY executions DESC
      LIMIT $${paramCount}
    `;

    params.push(limit);

    console.log('GET /api/ranking - Query:', query);
    console.log('GET /api/ranking - Parâmetros:', params);

    const result = await pool.query(query, params);
    console.log('GET /api/ranking - Linhas encontradas:', result.rows.length);

    res.json(result.rows);
  } catch (error) {
    console.error('GET /api/ranking - Erro:', error);
    res.status(500).json({ error: 'Erro interno do servidor', details: error.message });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
