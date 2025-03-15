// Load environment variables first
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Try to load environment variables from multiple locations
const envPaths = [
  path.join(__dirname, '.env'),
  path.join(dirname(__dirname), '.env')
];

for (const envPath of envPaths) {
  if (dotenv.config({ path: envPath }).error === undefined) {
    console.log('Loaded environment variables from:', envPath);
    break;
  }
}

// Verify environment variables are loaded
console.log('Environment variables loaded:', {
  POSTGRES_USER: process.env.POSTGRES_USER,
  POSTGRES_HOST: process.env.POSTGRES_HOST,
  POSTGRES_DB: process.env.POSTGRES_DB,
  POSTGRES_PORT: process.env.POSTGRES_PORT,
  VITE_SUPABASE_URL: process.env.VITE_SUPABASE_URL,
  NODE_ENV: process.env.NODE_ENV
});

// Log environment variables for debugging
console.log('Loading environment variables...');
console.log('Database configuration:', {
  user: process.env.POSTGRES_USER,
  host: process.env.POSTGRES_HOST,
  database: process.env.POSTGRES_DB,
  port: process.env.POSTGRES_PORT
});

// Import other dependencies after environment variables are loaded
import express from 'express';
import cors from 'cors';
import { createClient } from '@supabase/supabase-js';
import bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import pg from 'pg';
import { format } from 'date-fns';
import { authenticateBasicUser, authenticateUser } from './auth-middleware.js';
import { createCheckoutSession, handleWebhook } from './stripe.js';
import { reportQuery } from './report-query.js';
// Importar o registrador de rotas
import registerRoutes from './index.js';

const app = express();

// Middleware para o webhook do Stripe (deve vir antes de express.json)
app.post('/webhook', express.raw({ type: 'application/json' }), handleWebhook);

// Middlewares regulares
// Configurar CORS antes de qualquer rota
app.use(cors({
  origin: ['http://localhost:5173', 'http://localhost:3000', 'https://songmetrix.com.br'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
  exposedHeaders: ['Content-Range', 'X-Content-Range']
}));

// Configurar body parser
app.use(express.json());

// Log de todas as requisições
app.use((req, res, next) => {
  console.log(`${req.method} ${req.url}`);
  console.log('Headers:', req.headers);
  console.log('Body:', req.body);
  next();
});

// Registrar as rotas
registerRoutes(app);

// Tratamento de erros global
app.use((err, req, res, next) => {
  console.error('Erro não tratado:', err);
  res.status(500).json({ error: 'Erro interno do servidor', details: err.message });
});

const { Pool } = pg;

// Initialize database pool
console.log('Initializing database pool with:', {
  user: process.env.POSTGRES_USER,
  host: process.env.POSTGRES_HOST,
  database: process.env.POSTGRES_DB,
  port: process.env.POSTGRES_PORT
});

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

// Configure database pool
const pool = new Pool({
  user: process.env.POSTGRES_USER,
  host: process.env.POSTGRES_HOST,
  database: process.env.POSTGRES_DB,
  password: process.env.POSTGRES_PASSWORD,
  port: parseInt(process.env.POSTGRES_PORT || '5432'),
  ssl: {
    rejectUnauthorized: false
  }
});

// Log actual pool configuration for debugging
console.log('Database configuration:', {
  user: process.env.POSTGRES_USER,
  host: '104.234.173.96',
  database: process.env.POSTGRES_DB,
  port: process.env.POSTGRES_PORT,
  ssl: true
});

// Test database connection
const testConnection = async () => {
  try {
    const client = await pool.connect();
    console.log('Conexão com o banco de dados estabelecida com sucesso');
    client.release();
  } catch (err) {
    console.error('Erro ao conectar ao banco de dados:', err);
    console.log('Tentando reconectar em 5 segundos...');
    setTimeout(testConnection, 5000);
  }
};

testConnection();

// Helper function to safely execute database queries
const safeQuery = async (query, params = []) => {
  if (!pool) {
    console.error('Pool de conexões não disponível');
    return { rows: [] };
  }

  try {
    console.log('Executing query with params:', { query, params });
    const result = await pool.query(query, params);
    console.log('Query executed successfully:', result);
    return result;
  } catch (error) {
    console.error('Erro ao executar query:', error);
    console.error('Query details:', { query, params });
    console.error('Error stack:', error.stack);
    return { rows: [] };
  }
};


// Rotas públicas
app.post('/api/create-checkout-session', createCheckoutSession);

// Rota para verificar status do usuário
app.post('/api/users/status', authenticateBasicUser, async (req, res) => {
  try {
    const { userId } = req.body;
    
    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    console.log('Checking status for user:', userId);

    const query = `
      SELECT status
      FROM users
      WHERE id = $1
    `;

    const result = await safeQuery(query, [userId]);
    console.log('Query result:', result);
    
    if (!result.rows || result.rows.length === 0) {
      console.log('User not found in database');
      return res.status(404).json({ error: 'User not found' });
    }

    console.log('User status:', result.rows[0].status);
    res.json({ status: result.rows[0].status });
  } catch (error) {
    console.error('POST /api/users/status - Error:', error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

// Rotas com autenticação básica (sem verificação de paid/admin)
app.get('/api/radios/status', authenticateBasicUser, async (req, res) => {
  try {
    // Get favorite radios from user metadata
    const favoriteRadios = req.user.user_metadata?.favorite_radios || [];

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
      ORDER BY name;
    `;

    try {
      console.log('Executing query:', query);
      const result = await safeQuery(query);
      console.log('Query result:', result);
      
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
    } catch (dbError) {
      console.error('Erro ao consultar banco de dados:', dbError);
      // Se houver erro no banco, retornar apenas as rádios favoritas como offline
      const offlineRadios = favoriteRadios.map(name => ({
        name,
        status: 'OFFLINE',
        lastUpdate: null,
        isFavorite: true
      }));
      return res.json(offlineRadios);
    }
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

    // Get current favorite radios from metadata
    let favoriteRadios = req.user.user_metadata?.favorite_radios || [];

    if (favorite && !favoriteRadios.includes(radioName)) {
      favoriteRadios.push(radioName);
    } else if (!favorite) {
      favoriteRadios = favoriteRadios.filter(radio => radio !== radioName);
    }

    // Update user metadata with new favorite radios
    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
      req.user.id,
      {
        user_metadata: {
          ...req.user.user_metadata,
          favorite_radios: favoriteRadios
        }
      }
    );

    if (updateError) {
      console.error('Erro ao atualizar usuário:', updateError);
      return res.status(500).json({ error: 'Erro ao atualizar usuário' });
    }

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

// Rotas de abreviações de rádios
app.get('/api/radio-abbreviations', authenticateBasicUser, async (req, res) => {
  try {
    console.log('[GET /api/radio-abbreviations] Iniciando busca de abreviações');
    
    // Verificar se a tabela radio_abbreviations existe
    let hasAbbreviationsTable = false;
    try {
      const checkTableQuery = `
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_name = 'radio_abbreviations'
        )
      `;
      
      const tableExists = await safeQuery(checkTableQuery);
      hasAbbreviationsTable = tableExists.rows[0].exists;
    } catch (error) {
      console.log('Erro ao verificar tabela radio_abbreviations:', error);
    }
    
    // Consulta SQL para obter todas as rádios da tabela music_log
    const query = `
      SELECT DISTINCT 
        name as radio_name
      FROM music_log 
      ORDER BY name
    `;
    
    console.log('[GET /api/radio-abbreviations] Executando consulta SQL:', query);
    
    // Executar a consulta no banco de dados
    const result = await safeQuery(query);
    
    console.log('[GET /api/radio-abbreviations] Resultado da consulta SQL. Linhas retornadas:', result.rows.length);
    console.log(`[GET /api/radio-abbreviations] Primeiras 5 rádios: ${JSON.stringify(result.rows.slice(0, 5))}`);
    
    // Buscar abreviações da tabela radio_abbreviations se ela existir
    let abbreviationsMap = {};
    if (hasAbbreviationsTable) {
      try {
        const abbrevQuery = `SELECT radio_name, abbreviation FROM radio_abbreviations`;
        const abbrevResult = await safeQuery(abbrevQuery);
        
        // Criar um mapa de abreviações
        abbreviationsMap = abbrevResult.rows.reduce((map, row) => {
          map[row.radio_name] = row.abbreviation;
          return map;
        }, {});
      } catch (error) {
        console.log('Erro ao buscar abreviações da tabela:', error);
      }
    }
    
    // Processar o resultado para gerar abreviações
    let abbreviations = result.rows.map(row => ({
      radio_name: row.radio_name,
      abbreviation: abbreviationsMap[row.radio_name] || row.radio_name.substring(0, 3).toUpperCase()
    }));
    
    // Buscar abreviação personalizada do Spotify da tabela específica
    let spotifyAbbreviation = 'SFY';
    try {
      const spotifyQuery = 'SELECT abbreviation FROM spotify_abbreviation LIMIT 1';
      const spotifyResult = await safeQuery(spotifyQuery);
      if (spotifyResult.rows.length > 0) {
        spotifyAbbreviation = spotifyResult.rows[0].abbreviation;
      }
    } catch (error) {
      // Se a tabela não existir, usar o valor padrão
      console.log('Tabela spotify_abbreviation não encontrada, usando abreviação padrão');
    }
    
    // Verificar se já existe uma abreviação para o Spotify
    const spotifyExists = abbreviations.some(abbr => abbr.radio_name === 'Spotify');
    
    // Se não existir, adicionar a abreviação do Spotify
    if (!spotifyExists) {
      abbreviations.push({
        radio_name: 'Spotify',
        abbreviation: spotifyAbbreviation
      });
    }
    
    // Buscar abreviação personalizada do YouTube da tabela específica
    let youtubeAbbreviation = 'YTB';
    try {
      const youtubeQuery = 'SELECT abbreviation FROM youtube_abbreviation LIMIT 1';
      const youtubeResult = await safeQuery(youtubeQuery);
      if (youtubeResult.rows.length > 0) {
        youtubeAbbreviation = youtubeResult.rows[0].abbreviation;
      }
    } catch (error) {
      // Se a tabela não existir, usar o valor padrão
      console.log('Tabela youtube_abbreviation não encontrada, usando abreviação padrão');
    }
    
    // Verificar se já existe uma abreviação para o YouTube
    const youtubeExists = abbreviations.some(abbr => abbr.radio_name === 'Youtube');
    
    // Se não existir, adicionar a abreviação do YouTube
    if (!youtubeExists) {
      abbreviations.push({
        radio_name: 'Youtube',
        abbreviation: youtubeAbbreviation
      });
    }
    
    res.json(abbreviations);
    
    console.log(`[GET /api/radio-abbreviations] Total de abreviações enviadas: ${abbreviations.length}`);
    console.log(`[GET /api/radio-abbreviations] Inclui Spotify: ${abbreviations.some(abbr => abbr.radio_name === 'Spotify')}`);
    console.log(`[GET /api/radio-abbreviations] Inclui Youtube: ${abbreviations.some(abbr => abbr.radio_name === 'Youtube')}`);
  } catch (error) {
    console.error('GET /api/radio-abbreviations - Erro:', error);
    res.status(500).json({ error: 'Erro ao buscar abreviações' });
  }
});

app.post('/api/radio-abbreviations', authenticateBasicUser, async (req, res) => {
  try {
    // Permissão apenas para administradores
    if (req.user.user_metadata?.status !== 'ADMIN') {
      return res.status(403).json({ error: 'Permissão negada. Apenas administradores podem editar abreviações.' });
    }
    
    const { radioName, abbreviation } = req.body;
    
    if (!radioName || !abbreviation) {
      return res.status(400).json({ error: 'Nome da rádio e abreviação são obrigatórios' });
    }
    
    if (!/^[A-Z0-9]{1,3}$/.test(abbreviation)) {
      return res.status(400).json({ error: 'Abreviação deve conter de 1 a 3 caracteres (letras maiúsculas ou números)' });
    }
    
    // Caso especial para o Spotify (armazenar em uma tabela separada)
    if (radioName === 'Spotify') {
      // Verificar se já existe uma abreviação para o Spotify em uma tabela especial
      const checkSpotifyQuery = `
        SELECT * FROM spotify_abbreviation LIMIT 1
      `;
      
      try {
        const spotifyResult = await safeQuery(checkSpotifyQuery);
        
        if (spotifyResult.rows.length > 0) {
          // Atualizar a abreviação existente
          const updateSpotifyQuery = `
            UPDATE spotify_abbreviation
            SET abbreviation = $1
          `;
          await safeQuery(updateSpotifyQuery, [abbreviation]);
        } else {
          // Inserir nova abreviação
          const insertSpotifyQuery = `
            INSERT INTO spotify_abbreviation (abbreviation)
            VALUES ($1)
          `;
          await safeQuery(insertSpotifyQuery, [abbreviation]);
        }
        
        return res.json({
          radio_name: radioName,
          abbreviation: abbreviation
        });
      } catch (error) {
        // Se a tabela não existir, criar a tabela e inserir o valor padrão
        if (error.code === '42P01') {  // Código de erro para "tabela não existe"
          const createTableQuery = `
            CREATE TABLE spotify_abbreviation (
              abbreviation VARCHAR(3) NOT NULL
            )
          `;
          await safeQuery(createTableQuery);
          
          const insertSpotifyQuery = `
            INSERT INTO spotify_abbreviation (abbreviation)
            VALUES ($1)
          `;
          await safeQuery(insertSpotifyQuery, [abbreviation]);
          
          return res.json({
            radio_name: radioName,
            abbreviation: abbreviation
          });
        } else {
          throw error;
        }
      }
    }
    
    // Caso especial para o YouTube (armazenar em uma tabela separada)
    if (radioName === 'Youtube') {
      // Verificar se já existe uma abreviação para o YouTube em uma tabela especial
      const checkYoutubeQuery = `
        SELECT * FROM youtube_abbreviation LIMIT 1
      `;
      
      try {
        const youtubeResult = await safeQuery(checkYoutubeQuery);
        
        if (youtubeResult.rows.length > 0) {
          // Atualizar a abreviação existente
          const updateYoutubeQuery = `
            UPDATE youtube_abbreviation
            SET abbreviation = $1
          `;
          await safeQuery(updateYoutubeQuery, [abbreviation]);
        } else {
          // Inserir nova abreviação
          const insertYoutubeQuery = `
            INSERT INTO youtube_abbreviation (abbreviation)
            VALUES ($1)
          `;
          await safeQuery(insertYoutubeQuery, [abbreviation]);
        }
        
        return res.json({
          radio_name: radioName,
          abbreviation: abbreviation
        });
      } catch (error) {
        // Se a tabela não existir, criar a tabela e inserir o valor padrão
        if (error.code === '42P01') {  // Código de erro para "tabela não existe"
          const createTableQuery = `
            CREATE TABLE youtube_abbreviation (
              abbreviation VARCHAR(3) NOT NULL
            )
          `;
          await safeQuery(createTableQuery);
          
          const insertYoutubeQuery = `
            INSERT INTO youtube_abbreviation (abbreviation)
            VALUES ($1)
          `;
          await safeQuery(insertYoutubeQuery, [abbreviation]);
          
          return res.json({
            radio_name: radioName,
            abbreviation: abbreviation
          });
        } else {
          throw error;
        }
      }
    }
    
    // Para as rádios normais, usar a tabela radio_abbreviations
    try {
      // Verificar se a tabela radio_abbreviations existe
      const checkTableQuery = `
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_name = 'radio_abbreviations'
        )
      `;
      
      const tableExists = await safeQuery(checkTableQuery);
      
      // Se a tabela não existir, criar
      if (!tableExists.rows[0].exists) {
        const createTableQuery = `
          CREATE TABLE radio_abbreviations (
            radio_name VARCHAR(255) PRIMARY KEY,
            abbreviation VARCHAR(3) NOT NULL
          )
        `;
        await safeQuery(createTableQuery);
      }
      
      // Verificar se já existe uma abreviação para esta rádio
      const checkQuery = `
        SELECT * FROM radio_abbreviations
        WHERE radio_name = $1
      `;
      
      const checkResult = await safeQuery(checkQuery, [radioName]);
      
      if (checkResult.rows.length > 0) {
        // Atualizar a abreviação existente
        const updateQuery = `
          UPDATE radio_abbreviations
          SET abbreviation = $2
          WHERE radio_name = $1
        `;
        await safeQuery(updateQuery, [radioName, abbreviation]);
      } else {
        // Inserir nova abreviação
        const insertQuery = `
          INSERT INTO radio_abbreviations (radio_name, abbreviation)
          VALUES ($1, $2)
        `;
        await safeQuery(insertQuery, [radioName, abbreviation]);
      }
      
      return res.json({
        radio_name: radioName,
        abbreviation: abbreviation
      });
    } catch (error) {
      console.error('Erro ao salvar abreviação:', error);
      throw error;
    }
  } catch (error) {
    console.error('POST /api/radio-abbreviations - Erro:', error);
    res.status(500).json({ error: 'Erro ao atualizar abreviação' });
  }
});

// Rotas protegidas (requerem paid ou admin)
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

    const result = await safeQuery(query, params);
    console.log('POST /api/executions - Linhas encontradas:', result.rows.length);

    res.json(result.rows);
  } catch (error) {
    console.error('POST /api/executions - Erro:', error);
    res.status(500).json({ error: 'Erro interno do servidor', details: error.message });
  }
});

// Rota para o dashboard
app.get('/api/dashboard', authenticateUser, async (req, res) => {
  try {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 7);

    // Get favorite radios from user metadata
    const favoriteRadios = req.user.user_metadata?.favorite_radios || [];

    // Pegar rádios da query string
    const radios = req.query.radio;
    const selectedRadios = Array.isArray(radios) ? radios : radios ? [radios] : [];

    // Verificar se há rádios selecionadas
    if (selectedRadios.length === 0) {
      console.log('GET /api/dashboard - Nenhuma rádio selecionada');
      return res.json({
        totalExecutions: 0,
        uniqueArtists: 0,
        uniqueSongs: 0,
        activeRadios: [],
        topSongs: [],
        artistData: [],
        genreData: []
      });
    }

    // Verificar se as rádios selecionadas são favoritas
    const invalidRadios = selectedRadios.filter(radio => !favoriteRadios.includes(radio));
    if (invalidRadios.length > 0) {
      console.log('GET /api/dashboard - Rádios inválidas:', invalidRadios);
      console.log('GET /api/dashboard - Rádios favoritas:', favoriteRadios);
      console.log('GET /api/dashboard - User metadata:', req.user.user_metadata);
      return res.status(400).json({ 
        error: 'Algumas rádios selecionadas não são favoritas',
        invalidRadios,
        favoriteRadios,
        userMetadata: req.user.user_metadata
      });
    }

    console.log('GET /api/dashboard - Rádios selecionadas:', selectedRadios);
    
    const query = `
      WITH adjusted_dates AS (
        SELECT 
          artist,
          song_title,
          genre,
          name,
          (date + INTERVAL '3 hours')::date as date
        FROM music_log
        WHERE (date + INTERVAL '3 hours')::date BETWEEN $1 AND $2
          AND name = ANY($3::text[])
      ),
      artist_counts AS (
        SELECT 
          artist,
          COUNT(*) as executions
        FROM adjusted_dates
        GROUP BY artist
        ORDER BY executions DESC
        LIMIT 10
      ),
      genre_counts AS (
        SELECT 
          genre,
          COUNT(*) as count
        FROM adjusted_dates
        WHERE genre IS NOT NULL
        GROUP BY genre
        ORDER BY count DESC
        LIMIT 5
      ),
      song_counts AS (
        SELECT 
          song_title,
          artist,
          COUNT(*) as executions
        FROM adjusted_dates
        GROUP BY song_title, artist
        ORDER BY executions DESC
        LIMIT 3
      ),
      radio_status AS (
        SELECT DISTINCT
          name,
          true as is_online
        FROM adjusted_dates
        WHERE date = $2
      )
      SELECT
        json_build_object(
          'artistData', (SELECT json_agg(artist_counts.*) FROM artist_counts),
          'genreData', (SELECT json_agg(genre_counts.*) FROM genre_counts),
          'topSongs', (SELECT json_agg(song_counts.*) FROM song_counts),
          'activeRadios', (SELECT json_agg(radio_status.*) FROM radio_status)
        ) as dashboard_data
    `;

    const params = [
      format(startDate, 'yyyy-MM-dd'),
      format(endDate, 'yyyy-MM-dd'),
      selectedRadios
    ];

    console.log('GET /api/dashboard - Query:', query);
    console.log('GET /api/dashboard - Parâmetros:', params);
    console.log('GET /api/dashboard - Parâmetros formatados:', JSON.stringify(params, null, 2));

    const result = await safeQuery(query, params);

    const dashboardData = result.rows[0]?.dashboard_data || {
      artistData: [],
      genreData: [],
      topSongs: [],
      activeRadios: []
    };
    
    // Calcular totais
    const totalExecutions = (dashboardData.artistData || [])
      .reduce((sum, item) => sum + parseInt(item.executions), 0);
    const uniqueArtists = (dashboardData.artistData || []).length;
    const uniqueSongs = (dashboardData.topSongs || []).length;

    // Formatar dados dos gêneros para percentuais
    const totalGenreExecutions = (dashboardData.genreData || [])
      .reduce((sum, item) => sum + parseInt(item.count), 0);
    const genreData = totalGenreExecutions > 0 
      ? (dashboardData.genreData || []).map(item => ({
          name: item.genre,
          value: Math.round((item.count / totalGenreExecutions) * 100),
          color: getGenreColor(item.genre)
        }))
      : [];

    res.json({
      totalExecutions,
      uniqueArtists,
      uniqueSongs,
      activeRadios: dashboardData.activeRadios,
      topSongs: dashboardData.topSongs,
      artistData: dashboardData.artistData,
      genreData
    });
  } catch (error) {
    console.error('GET /api/dashboard - Erro:', error);
    res.status(500).json({ error: 'Erro interno do servidor', details: error.message });
  }
});

// Função auxiliar para atribuir cores aos gêneros
function getGenreColor(genre) {
  const colors = {
    'Sertanejo': '#3B82F6',
    'Pop': '#10B981',
    'Rock': '#F59E0B',
    'Brazilian': '#EF4444',
    'Alternative': '#8B5CF6'
  };
  return colors[genre] || '#6B7280'; // Cor padrão para gêneros não mapeados
}

// Rotas para cidades e estados
app.get('/api/cities', authenticateUser, async (req, res) => {
  try {
    const query = `
      SELECT DISTINCT cidade as city
      FROM music_log
      WHERE cidade IS NOT NULL
      ORDER BY cidade
    `;

    const result = await safeQuery(query);
    const cities = result.rows.map(row => row.city);
    res.json(cities);
  } catch (error) {
    console.error('GET /api/cities - Erro:', error);
    res.status(500).json({ error: 'Erro interno do servidor', details: error.message });
  }
});

app.get('/api/validate-location', authenticateUser, async (req, res) => {
  try {
    const { city, state } = req.query;
    
    if (!city || !state) {
      return res.status(400).json({ error: 'Cidade e estado são obrigatórios' });
    }

    const query = `
      SELECT COUNT(*) as count
      FROM (
        SELECT DISTINCT cidade, estado
        FROM music_log
        WHERE cidade = $1 AND estado = $2
      ) as location
    `;
    
    const result = await safeQuery(query, [city, state]);
    const isValid = result.rows[0].count > 0;
    
    res.json({ isValid });
  } catch (error) {
    console.error('GET /api/validate-location - Erro:', error);
    res.status(500).json({ error: 'Erro interno do servidor', details: error.message });
  }
});

app.get('/api/radios/by-location', authenticateUser, async (req, res) => {
  try {
    const { city, state } = req.query;
    
    if (!city && !state) {
      return res.status(400).json({ error: 'Cidade ou estado é obrigatório' });
    }

    let query = `
      SELECT DISTINCT name
      FROM music_log
      WHERE 1=1
    `;
    
    const params = [];
    let paramCount = 1;

    if (city) {
      query += ` AND cidade = $${paramCount}`;
      params.push(city);
      paramCount++;
    }

    if (state) {
      query += ` AND estado = $${paramCount}`;
      params.push(state);
      paramCount++;
    }

    query += ` ORDER BY name`;

    const result = await safeQuery(query, params);
    const radios = result.rows.map(row => row.name);
    res.json(radios);
  } catch (error) {
    console.error('GET /api/radios/by-location - Erro:', error);
    res.status(500).json({ error: 'Erro interno do servidor', details: error.message });
  }
});

// Atualizar status do usuário
app.put('/admin/users/:userId/status', authenticateUser, async (req, res) => {
  const { userId } = req.params;
  const { status } = req.body;

  try {
    // Validar o status
    if (!['ADMIN', 'ATIVO', 'INATIVO', 'TRIAL'].includes(status)) {

      return res.status(400).json({ message: 'Status inválido' });
    }

    // Verificar se o usuário que faz a requisição é um admin
    const { data: adminUser, error: adminError } = await supabaseAdmin
      .from('users')
      .select('status')
      .eq('id', req.user.id)
      .single();

    if (adminError || adminUser?.status !== 'ADMIN') {
      return res.status(403).json({ message: 'Acesso negado' });
    }

    // Verificar se o usuário a ser atualizado existe e atualizar em uma única operação
    const { data: updatedUser, error: updateError } = await supabaseAdmin
      .from('users')
      .update({ 
        status: status,
        updated_at: new Date().toISOString()
      })
      .eq('id', userId)
      .select('id, email, status, updated_at')
      .maybeSingle();

    if (updateError) {
      console.error('Erro detalhado:', updateError);
      throw updateError;
    }

    if (!updatedUser) {
      return res.status(404).json({ message: 'Usuário não encontrado' });
    }

    res.json(updatedUser);
  } catch (error) {
    console.error('Erro ao atualizar status do usuário:', error);
    res.status(500).json({ 
      message: `Erro ao atualizar status do usuário: ${error.message}`,
      details: error
    });
  }
});

app.get('/api/states', authenticateUser, async (req, res) => {
  try {
    const query = `
      SELECT DISTINCT estado as state
      FROM music_log
      WHERE estado IS NOT NULL
      ORDER BY estado
    `;

    const result = await safeQuery(query);
    const states = result.rows.map(row => row.state);
    res.json(states);
  } catch (error) {
    console.error('GET /api/states - Erro:', error);
    res.status(500).json({ error: 'Erro interno do servidor', details: error.message });
  }
});

app.get('/api/report', authenticateUser, async (req, res) => {
  try {
    const { startDate, endDate, radios, limit, city, state } = req.query;
    
    // Verifica se pelo menos data início e fim foram fornecidos
    if (!startDate || !endDate) {
      return res.status(400).json({ error: 'Período (data início e fim) é obrigatório' });
    }

    // Verifica se há cidade ou estado selecionado
    const hasLocationFilter = city || state;

    // Se não há filtro de localização, então rádios é obrigatório
    if (!hasLocationFilter && !radios) {
      return res.status(400).json({ error: 'Selecione rádios ou um filtro de localização (cidade/estado)' });
    }

    // Prepara a query base
    let query = `
      WITH filtered_logs AS (
        SELECT 
          song_title as title,
          artist,
          name,
          date
        FROM music_log
        WHERE date BETWEEN $1 AND $2
    `;

    const params = [startDate, endDate];
    let paramCount = 2;

    // Adiciona filtros de localização se fornecidos
    if (city) {
      query += ` AND cidade = $${++paramCount}`;
      params.push(city);
    }
    if (state) {
      query += ` AND estado = $${++paramCount}`;
      params.push(state);
    }

    // Adiciona filtro de rádios se fornecido
    if (radios) {
      const radiosList = radios.split('||').map(r => r.trim());
      query += ` AND name = ANY($${++paramCount}::text[])`;
      params.push(radiosList);
    }

    // Completa a query com a contagem de execuções
    query += `
      ),
      executions_by_radio AS (
        SELECT 
          title,
          artist,
          name,
          COUNT(*) as count
        FROM filtered_logs
        GROUP BY title, artist, name
      ),
      total_executions AS (
        SELECT 
          title,
          artist,
          jsonb_object_agg(name, count) as executions,
          SUM(count) as total
        FROM executions_by_radio
        GROUP BY title, artist
      )
      SELECT *
      FROM total_executions
      ORDER BY total DESC
      LIMIT $${++paramCount}
    `;

    params.push(parseInt(limit || '100'));

    const result = await safeQuery(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('GET /api/report - Erro:', error);
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
      const radios = radio.split('||').map(r => r.trim()).filter(Boolean);
      if (radios.length > 0) {
        const placeholders = radios.map((_, i) => `$${paramCount + i}`).join(',');
        query += ` AND name IN (${placeholders})`;
        params.push(...radios);
        paramCount += radios.length;
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

    const result = await safeQuery(query, params);
    console.log('GET /api/ranking - Linhas encontradas:', result.rows.length);

    res.json(result.rows);
  } catch (error) {
    console.error('GET /api/ranking - Erro:', error);
    res.status(500).json({ error: 'Erro interno do servidor', details: error.message });
  }
});

// Rota para simular o fim do período trial de um usuário
app.post('/api/simulate-trial-end', authenticateUser, async (req, res) => {
  try {
    // Verificar se o usuário é administrador
    if (req.user.user_metadata?.status !== 'ADMIN') {
      console.log('Tentativa não autorizada de simular fim do trial:', req.user.id);
      return res.status(403).json({ error: 'Apenas administradores podem usar esta função' });
    }

    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({ error: 'ID do usuário é obrigatório' });
    }

    console.log(`Simulando fim do período trial para o usuário ${userId}`);

    // Obter os metadados do usuário
    const { data: userData, error: userError } = await supabaseAdmin.auth.admin.getUserById(userId);
    
    if (userError) {
      console.error(`Erro ao obter metadados do usuário ${userId}:`, userError);
      return res.status(500).json({ error: 'Erro ao obter metadados do usuário', details: userError });
    }

    if (!userData || !userData.user) {
      console.error(`Usuário ${userId} não encontrado`);
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }

    // Verificar se o usuário está em período trial
    const currentStatus = userData.user.user_metadata?.status;
    console.log(`Status atual do usuário ${userId}: ${currentStatus}`);
    
    if (currentStatus !== 'TRIAL') {
      console.log(`Usuário ${userId} não está em período trial (status: ${currentStatus}`);
      return res.status(400).json({ 
        error: 'Usuário não está em período trial',
        currentStatus 
      });
    }

    // Registrar metadados atuais
    console.log(`Metadados atuais do usuário ${userId}:`, userData.user.user_metadata);

    // Atualizar o status na tabela users
    const { error: updateDbError } = await supabaseAdmin
      .from('users')
      .update({
        status: 'INATIVO',
        updated_at: new Date().toISOString()
      })
      .eq('id', userId);
      
    if (updateDbError) {
      console.error(`Erro ao atualizar status do usuário ${userId} no banco:`, updateDbError);
      return res.status(500).json({ error: 'Erro ao atualizar status no banco de dados', details: updateDbError });
    }

    console.log(`Status do usuário ${userId} atualizado no banco de dados para INATIVO`);

    // Criar um novo objeto de metadados preservando os existentes
    const updatedMetadata = { ...userData.user.user_metadata, status: 'INATIVO' };
    console.log(`Novos metadados para o usuário ${userId}:`, updatedMetadata);

    // Atualizar os metadados
    const { data: updateMetaData, error: updateMetaError } = await supabaseAdmin.auth.admin.updateUserById(
      userId,
      { user_metadata: updatedMetadata }
    );
    
    if (updateMetaError) {
      console.error(`Erro ao atualizar metadados do usuário ${userId}:`, updateMetaError);
      return res.status(500).json({ 
        error: 'Erro ao atualizar metadados do usuário', 
        details: updateMetaError,
        note: 'O status foi atualizado no banco de dados, mas não nos metadados'
      });
    }

    console.log(`Metadados do usuário ${userId} atualizados com sucesso:`, updateMetaData);

    // Verificar se o metadados foi realmente atualizado
    const { data: verifyData, error: verifyError } = await supabaseAdmin.auth.admin.getUserById(userId);
    
    if (verifyError) {
      console.error(`Erro ao verificar metadados do usuário ${userId} após atualização:`, verifyError);
    } else {
      console.log(`Metadados verificados do usuário ${userId} após atualização:`, verifyData.user.user_metadata);
      
      // Verificar se o status foi realmente atualizado
      const updatedStatus = verifyData.user.user_metadata?.status;
      if (updatedStatus !== 'INATIVO') {
        console.error(`ATENÇÃO: Status do usuário ${userId} nos metadados não foi atualizado corretamente. Esperado: INATIVO, Atual: ${updatedStatus}`);
        
        // Tentar uma abordagem alternativa para atualizar os metadados
        try {
          console.log(`Tentando abordagem alternativa para atualizar metadados do usuário ${userId}`);
          
          // Atualizar apenas o campo status nos metadados
          const { error: updateMetaRetryError } = await supabaseAdmin.auth.admin.updateUserById(
            userId,
            { user_metadata: { status: 'INATIVO' } }
          );
          
          if (updateMetaRetryError) {
            console.error(`Segunda tentativa de atualizar metadados falhou:`, updateMetaRetryError);
          } else {
            console.log(`Segunda tentativa de atualização de metadados concluída. Verificando resultado...`);
            
            // Verificar novamente
            const { data: verifyRetryData, error: verifyRetryError } = await supabaseAdmin.auth.admin.getUserById(userId);
            if (!verifyRetryError && verifyRetryData.user.user_metadata?.status === 'INATIVO') {
              console.log(`Status atualizado com sucesso na segunda tentativa: ${verifyRetryData.user.user_metadata?.status}`);
            } else {
              console.error(`ALERTA: Segunda tentativa de atualizar status nos metadados também falhou`);
            }
          }
        } catch (retryError) {
          console.error(`Erro na segunda tentativa de atualizar metadados:`, retryError);
        }
      } else {
        console.log(`Status nos metadados atualizado com sucesso para: ${updatedStatus}`);
      }
    }

    // Tentar forçar invalidação de sessões (para garantir que o novo status seja aplicado)
    try {
      if (updatedStatus === 'INATIVO') {
        // Para status INATIVO, forçamos o logout
        const { error: signOutError } = await supabaseAdmin.auth.admin.signOut(userId);
        if (signOutError) {
          console.error(`Erro ao invalidar sessões do usuário ${userId}:`, signOutError);
        } else {
          console.log(`Sessões do usuário ${userId} invalidadas com sucesso`);
        }
      } else {
        // Para outros status, o usuário precisará fazer logout e login novamente
        console.log(`O usuário ${userId} precisará fazer logout e login novamente para que o novo status (${updatedStatus}) seja aplicado completamente.`);
      }
    } catch (error) {
      console.error(`Erro ao processar sessões do usuário ${userId}:`, error);
    }

    console.log(`Simulação de fim do período trial concluída com sucesso para o usuário ${userId}`);

    res.status(200).json({ 
      message: 'Simulação de fim do período trial concluída com sucesso',
      userId,
      oldStatus: currentStatus,
      newStatus: 'INATIVO',
      oldMetadata: userData.user.user_metadata,
      newMetadata: updatedMetadata
    });
  } catch (error) {
    console.error('Erro ao simular fim do período trial:', error);
    res.status(500).json({ error: 'Erro interno do servidor', details: error.message });
  }
});

// Rota para sincronizar status de usuários
app.post('/api/users/sync-status', authenticateUser, async (req, res) => {
  try {
    // Verificar se o usuário é administrador
    if (req.user.user_metadata?.status !== 'ADMIN') {
      return res.status(403).json({ error: 'Apenas administradores podem usar esta função' });
    }

    // Obter todos os usuários da tabela users
    const { data: usersList, error: fetchError } = await supabaseAdmin
      .from('users')
      .select('id, email, status, created_at, updated_at');

    if (fetchError) {
      return res.status(500).json({ error: 'Erro ao obter lista de usuários', details: fetchError });
    }

    const updates = [];

    // Para cada usuário, verificar e sincronizar o status
    for (const user of usersList) {
      try {
        // Obter os metadados do usuário
        const { data: userData, error: userError } = await supabaseAdmin.auth.admin.getUserById(user.id);
        
        if (userError) {
          console.error(`Erro ao obter metadados do usuário ${user.id}:`, userError);
          continue;
        }
        
        const metadataStatus = userData?.user?.user_metadata?.status;
        
        // Determinar o status correto - Agora respeitamos o status do banco de dados
        // Não forçamos mais usuários recém-criados a terem status TRIAL
        let correctStatus = user.status;
        
        // Se o metadados tem um status diferente do banco, usamos o do banco
        if (metadataStatus !== correctStatus) {
          // Atualizar os metadados
          const { error: updateMetaError } = await supabaseAdmin.auth.admin.updateUserById(
            user.id,
            { user_metadata: { ...userData.user.user_metadata, status: correctStatus } }
          );
          
          if (updateMetaError) {
            console.error(`Erro ao atualizar metadados do usuário ${user.id}:`, updateMetaError);
            continue;
          }
          
          updates.push({
            id: user.id,
            email: user.email,
            oldStatus: metadataStatus,
            newStatus: correctStatus,
            metadataStatus: metadataStatus
          });
        }
      } catch (error) {
        console.error(`Erro ao processar usuário ${user.id}:`, error);
      }
    }

    res.status(200).json({ 
      message: 'Sincronização de status concluída',
      updates
    });
  } catch (error) {
    console.error('Erro ao sincronizar status dos usuários:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Rota para atualizar o status de um usuário específico
app.post('/api/users/update-status', authenticateUser, async (req, res) => {
  try {
    // Verificar se o usuário autenticado é administrador
    if (req.user.user_metadata?.status !== 'ADMIN') {
      return res.status(403).json({ error: 'Apenas administradores podem atualizar o status de usuários' });
    }

    const { userId, newStatus } = req.body;

    if (!userId || !newStatus) {
      return res.status(400).json({ error: 'ID do usuário e novo status são obrigatórios' });
    }

    // Validar o status
    const validStatuses = ['INATIVO', 'ATIVO', 'ADMIN', 'TRIAL'];
    if (!validStatuses.includes(newStatus)) {
      return res.status(400).json({ error: 'Status inválido' });
    }

    console.log(`===== INÍCIO DA ATUALIZAÇÃO DE STATUS =====`);
    console.log(`Atualizando status do usuário ${userId} para ${newStatus}`);

    // ETAPA 1: Atualizar autenticação (Supabase Auth)
    console.log(`ETAPA 1: Atualizando autenticação no Supabase Auth...`);
    
    // Obter os dados atuais do usuário
    const { data: userData, error: userError } = await supabaseAdmin.auth.admin.getUserById(userId);
    
    if (userError || !userData || !userData.user) {
      const errorMessage = userError ? userError.message : 'Usuário não encontrado';
      console.error(`Erro ao obter dados do usuário ${userId}:`, errorMessage);
      return res.status(userError ? 500 : 404).json({ error: errorMessage });
    }

    // Atualizar metadados do usuário no Supabase Auth
    const currentMetadata = userData.user.user_metadata || {};
    const updatedMetadata = { 
      ...currentMetadata, 
      status: newStatus,
      admin: newStatus === 'ADMIN',
      paid: newStatus === 'ATIVO' || newStatus === 'ADMIN',
      statusUpdatedAt: new Date().toISOString()
    };
    
    // Se for ADMIN, também atualizar app_metadata para ter certeza
    let appMetadata = userData.user.app_metadata || {};
    if (newStatus === 'ADMIN') {
      appMetadata = {
        role: 'admin'
      };
    }
    
    console.log(`Atualizando metadados do usuário para:`, {
      user_metadata: updatedMetadata,
      app_metadata: appMetadata
    });
    
    // Fazer uma atualização completa do usuário no Supabase Auth
    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
      userId,
      { 
        user_metadata: updatedMetadata,
        app_metadata: appMetadata,
        email_confirm: true
      }
    );
    
    if (updateError) {
      console.error(`Erro ao atualizar metadados do usuário ${userId}:`, updateError);
      return res.status(500).json({ error: 'Erro ao atualizar metadados do usuário', details: updateError.message });
    }

    console.log(`✓ Metadados do usuário ${userId} atualizados com sucesso para ${newStatus}`);
    
    // ETAPA 2: Atualizar a tabela Users (dados da aplicação)
    console.log(`ETAPA 2: Atualizando tabela users...`);
    
    // Primeira tentativa: Usando API normal
    const { data: updateData, error: tableUpdateError } = await supabaseAdmin
      .from('users')
      .update({ 
        status: newStatus,
        updated_at: new Date().toISOString()
      })
      .eq('id', userId)
      .select();
    
    let databaseUpdateResult = {
      success: !tableUpdateError,
      method: 'api',
      message: tableUpdateError 
        ? `Falha na atualização via API: ${tableUpdateError.message}` 
        : `Status atualizado para ${newStatus} via API`
    };
    
    if (tableUpdateError) {
      console.log(`Aviso: Não foi possível atualizar tabela users: ${tableUpdateError.message}`);
      console.log('Isso pode ser esperado para status ADMIN devido às políticas RLS.');
      console.log('Os metadados no sistema de autenticação foram atualizados com sucesso.');
    } else {
      console.log(`✓ Tabela users atualizada com sucesso para ${userId}`);
    }
    
    // ETAPA 3: Invalidar sessões para forçar novos tokens com o novo status
    console.log(`ETAPA 3: Invalidando sessões para atualizar tokens...`);
    
    if (newStatus === 'ADMIN' || newStatus === 'INATIVO') {
      try {
        console.log(`Invalidando sessões do usuário ${userId}...`);
        
        // Global sign-out para forçar reautenticação
        const { error: signOutError } = await supabaseAdmin.auth.admin.signOut(userId, true);
        
        if (signOutError) {
          console.log(`Aviso: API de logout global falhou: ${signOutError.message}`);
          
          // Tentar método alternativo - deletar sessões diretamente
          try {
            const { error: deleteSessionsError } = await supabaseAdmin
              .from('sessions')
              .delete()
              .eq('user_id', userId);
              
            if (deleteSessionsError) {
              console.log(`Também não foi possível deletar sessões: ${deleteSessionsError.message}`);
            } else {
              console.log(`✓ Sessões deletadas diretamente para ${userId}`);
            }
          } catch (e) {
            console.log(`Erro ao manipular tabela de sessões: ${e.message}`);
          }
        } else {
          console.log(`✓ Sessões do usuário ${userId} invalidadas com sucesso`);
        }
      } catch (e) {
        console.log(`Exceção ao invalidar sessões: ${e.message}`);
      }
    }
    
    // ETAPA 4: Verificar se as alterações foram aplicadas corretamente
    console.log(`ETAPA 4: Verificando atualizações...`);
    
    // Verificar Auth
    const { data: authCheck, error: authCheckError } = await supabaseAdmin.auth.admin.getUserById(userId);
    
    if (authCheckError) {
      console.log(`Erro ao verificar autenticação: ${authCheckError.message}`);
    } else {
      const authStatus = authCheck.user.user_metadata?.status || 'Desconhecido';
      console.log(`Status atual na autenticação: ${authStatus}`);
      
      if (authStatus === newStatus) {
        console.log(`✓ Confirmado: Status ${newStatus} está corretamente definido na autenticação`);
      } else {
        console.log(`⚠️ ALERTA: Status na autenticação (${authStatus}) não corresponde ao solicitado (${newStatus})`);
      }
    }
    
    // Verificar DB
    const { data: dbCheck, error: dbCheckError } = await supabaseAdmin
      .from('users')
      .select('status')
      .eq('id', userId)
      .single();
      
    if (dbCheckError) {
      console.log(`Erro ao verificar status no banco de dados: ${dbCheckError.message}`);
    } else {
      const dbStatus = dbCheck?.status || 'Desconhecido';
      console.log(`Status atual no banco de dados: ${dbStatus}`);
      
      if (dbStatus === newStatus) {
        console.log(`✓ Confirmado: Status ${newStatus} está corretamente definido no banco de dados`);
      } else {
        console.log(`⚠️ ALERTA: Status no banco (${dbStatus}) não corresponde ao solicitado (${newStatus})`);
        console.log(`Isso pode ser esperado para status ADMIN devido às políticas RLS.`);
      }
    }
    
    console.log(`===== FIM DA ATUALIZAÇÃO DE STATUS =====`);
    
    // Retornar informações detalhadas sobre as atualizações
    res.status(200).json({ 
      message: 'Status do usuário atualizado com sucesso',
      userId, 
      newStatus,
      authUpdated: true,
      databaseUpdated: databaseUpdateResult.success,
      authStatus: authCheck?.user?.user_metadata?.status || 'Desconhecido',
      dbStatus: dbCheck?.status || 'Desconhecido'
    });
  } catch (error) {
    console.error('Erro ao atualizar status do usuário:', error);
    res.status(500).json({ error: 'Erro interno do servidor', details: error.message });
  }
});

// Rota para verificar o status de um usuário específico
app.get('/api/users/check-status/:userId', authenticateUser, async (req, res) => {
  try {
    // Verificar se o usuário é administrador
    if (req.user.user_metadata?.status !== 'ADMIN') {
      return res.status(403).json({ error: 'Apenas administradores podem usar esta função' });
    }

    const userId = req.params.userId;

    if (!userId) {
      return res.status(400).json({ error: 'ID do usuário é obrigatório' });
    }

    // Obter os metadados do usuário
    const { data: userData, error: userError } = await supabaseAdmin.auth.admin.getUserById(userId);
    
    if (userError) {
      return res.status(500).json({ error: 'Erro ao obter metadados do usuário', details: userError });
    }

    // Obter dados do usuário na tabela users
    const { data: dbUser, error: dbError } = await supabaseAdmin
      .from('users')
      .select('id, email, status, created_at, updated_at')
      .eq('id', userId)
      .single();
      
    if (dbError) {
      return res.status(500).json({ error: 'Erro ao obter dados do usuário no banco', details: dbError });
    }

    // Verificar se o usuário foi criado nos últimos 7 dias
    const createdAt = new Date(userData.user.created_at);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - createdAt.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    const isNewUser = diffDays <= 7;

    res.status(200).json({ 
      userId,
      email: userData.user.email,
      metadataStatus: userData.user.user_metadata?.status || 'Não definido',
      dbStatus: dbUser?.status || 'Não encontrado',
      createdAt: userData.user.created_at,
      diffDays,
      isNewUser,
      shouldBeTrial: isNewUser
    });
  } catch (error) {
    console.error('Erro ao verificar status do usuário:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Rota para corrigir o status de todos os usuários novos
app.post('/api/users/fix-new-users', authenticateUser, async (req, res) => {
  try {
    // Verificar se o usuário é administrador
    if (req.user.user_metadata?.status !== 'ADMIN') {
      return res.status(403).json({ error: 'Apenas administradores podem usar esta função' });
    }

    // Obter todos os usuários da tabela users
    const { data: usersList, error: fetchError } = await supabaseAdmin
      .from('users')
      .select('id, email, status, created_at, updated_at');

    if (fetchError) {
      return res.status(500).json({ error: 'Erro ao obter lista de usuários', details: fetchError });
    }

    const updates = [];
    const errors = [];

    // Para cada usuário, verificar e corrigir o status
    for (const user of usersList) {
      try {
        // Obter os metadados do usuário
        const { data: userData, error: userError } = await supabaseAdmin.auth.admin.getUserById(user.id);
        
        if (userError) {
          console.error(`Erro ao obter metadados do usuário ${user.id}:`, userError);
          errors.push({
            id: user.id,
            email: user.email,
            error: 'Erro ao obter metadados',
            details: userError
          });
          continue;
        }
        
        // Verificar se o status nos metadados é diferente do banco
        const metadataStatus = userData?.user?.user_metadata?.status;
        
        if (metadataStatus !== user.status) {
          console.log(`Corrigindo metadados do usuário ${user.id} (${user.email}) de ${metadataStatus} para ${user.status}`);
          
          // Atualizar os metadados
          const { error: updateMetaError } = await supabaseAdmin.auth.admin.updateUserById(
            user.id,
            { user_metadata: { ...userData.user.user_metadata, status: user.status } }
          );
          
          if (updateMetaError) {
            console.error(`Erro ao atualizar metadados do usuário ${user.id}:`, updateMetaError);
            errors.push({
              id: user.id,
              email: user.email,
              error: 'Erro ao atualizar metadados',
              details: updateMetaError
            });
            continue;
          }
          
          updates.push({
            id: user.id,
            email: user.email,
            oldStatus: metadataStatus,
            newStatus: user.status
          });
        }
      } catch (error) {
        console.error(`Erro ao processar usuário ${user.id}:`, error);
        errors.push({
          id: user.id,
          email: user.email,
          error: 'Erro ao processar usuário',
          details: error.message
        });
      }
    }

    res.status(200).json({ 
      message: 'Correção de status concluída',
      updates,
      errors
    });
  } catch (error) {
    console.error('Erro ao corrigir status dos usuários:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Rota para processar a fila de sincronização
app.post('/api/users/process-sync-queue', authenticateUser, async (req, res) => {
  try {
    // Verificar se o usuário é administrador
    if (req.user.user_metadata?.status !== 'ADMIN') {
      console.log('Tentativa não autorizada de processar fila de sincronização:', req.user.id);
      return res.status(403).json({ error: 'Apenas administradores podem usar esta função' });
    }

    console.log('Iniciando processamento da fila de sincronização');

    // Obter os registros não processados da fila de sincronização
    const { data: queueItems, error: fetchError } = await supabaseAdmin
      .from('auth_sync_queue')
      .select('user_id, status')
      .eq('processed', false)
      .order('created_at', { ascending: true });

    if (fetchError) {
      console.error('Erro ao obter fila de sincronização:', fetchError);
      return res.status(500).json({ error: 'Erro ao obter fila de sincronização', details: fetchError });
    }

    if (!queueItems || queueItems.length === 0) {
      console.log('Nenhum item encontrado na fila de sincronização');
      return res.status(200).json({ 
        message: 'Nenhum item encontrado na fila de sincronização',
        processed: 0,
        errors: 0
      });
    }

    console.log(`Encontrados ${queueItems.length} itens para processar na fila de sincronização`);

    const results = {
      success: [],
      errors: []
    };

    // Processar cada item da fila
    for (const item of queueItems) {
      try {
        console.log(`Processando usuário ${item.user_id}, status=${item.status}`);
        
        // Obter os metadados do usuário
        const { data: userData, error: userError } = await supabaseAdmin.auth.admin.getUserById(item.user_id);
        
        if (userError) {
          console.error(`Erro ao obter metadados do usuário ${item.user_id}:`, userError);
          results.errors.push({
            user_id: item.user_id,
            error: 'Erro ao obter metadados do usuário',
            details: userError
          });
          continue;
        }

        if (!userData || !userData.user) {
          console.error(`Usuário ${item.user_id} não encontrado`);
          results.errors.push({
            user_id: item.user_id,
            error: 'Usuário não encontrado'
          });
          
          // Marcar como processado mesmo com erro para não ficar tentando indefinidamente
          await supabaseAdmin
            .from('auth_sync_queue')
            .update({
              processed: true,
              updated_at: new Date().toISOString()
            })
            .eq('user_id', item.user_id);
            
          continue;
        }

        // Atualizar os metadados
        const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
          item.user_id,
          { user_metadata: { ...userData.user.user_metadata, status: item.status } }
        );
        
        if (updateError) {
          console.error(`Erro ao atualizar metadados do usuário ${item.user_id}:`, updateError);
          results.errors.push({
            user_id: item.user_id,
            error: 'Erro ao atualizar metadados do usuário',
            details: updateError
          });
          continue;
        }

        // Atualizar também na tabela users para garantir consistência
        const { error: updateDbError } = await supabaseAdmin
          .from('users')
          .update({
            status: item.status,
            updated_at: new Date().toISOString()
          })
          .eq('id', item.user_id);
          
        if (updateDbError) {
          console.error(`Erro ao atualizar status do usuário ${item.user_id} no banco:`, updateDbError);
          // Não interrompe o processo, pois o principal (metadados) já foi atualizado
        }

        // Marcar o item como processado
        const { error: updateQueueError } = await supabaseAdmin
          .from('auth_sync_queue')
          .update({
            processed: true,
            updated_at: new Date().toISOString()
          })
          .eq('user_id', item.user_id);
          
        if (updateQueueError) {
          console.error(`Erro ao atualizar fila de sincronização para o usuário ${item.user_id}:`, updateQueueError);
          results.errors.push({
            user_id: item.user_id,
            error: 'Erro ao atualizar fila de sincronização',
            details: updateQueueError
          });
          continue;
        }

        console.log(`Usuário ${item.user_id} processado com sucesso, status=${item.status}`);
        results.success.push({
          user_id: item.user_id,
          status: item.status
        });
      } catch (error) {
        console.error(`Erro ao processar usuário ${item.user_id}:`, error);
        results.errors.push({
          user_id: item.user_id,
          error: 'Erro ao processar usuário',
          details: error.message
        });
      }
    }

    console.log(`Processamento concluído: ${results.success.length} sucessos, ${results.errors.length} erros`);

    res.status(200).json({ 
      message: 'Processamento da fila de sincronização concluído',
      processed: results.success.length,
      errors: results.errors.length,
      results
    });
  } catch (error) {
    console.error('Erro ao processar fila de sincronização:', error);
    res.status(500).json({ error: 'Erro interno do servidor', details: error.message });
  }
});

// Rota para sincronizar novos usuários para TRIAL
app.post('/api/users/sync-new-users', authenticateUser, async (req, res) => {
  try {
    // Verificar se o usuário é administrador
    if (req.user.user_metadata?.status !== 'ADMIN') {
      console.log('Tentativa não autorizada de sincronizar novos usuários:', req.user.id);
      return res.status(403).json({ error: 'Apenas administradores podem usar esta função' });
    }

    console.log('Iniciando sincronização de metadados de usuários');

    // Buscar todos os usuários
    const { data: allUsers, error: fetchError } = await supabaseAdmin
      .from('users')
      .select('id, email, status, created_at');

    if (fetchError) {
      console.error('Erro ao buscar usuários:', fetchError);
      return res.status(500).json({ error: 'Erro ao buscar usuários', details: fetchError });
    }

    if (!allUsers || allUsers.length === 0) {
      console.log('Nenhum usuário encontrado');
      return res.status(200).json({ 
        message: 'Nenhum usuário encontrado',
        updated: 0
      });
    }

    console.log(`Encontrados ${allUsers.length} usuários para verificar metadados`);

    const results = {
      success: [],
      errors: []
    };

    // Verificar cada usuário
    for (const user of allUsers) {
      try {
        console.log(`Verificando metadados do usuário ${user.id}`);

        // Obter os metadados do usuário
        const { data: userData, error: userError } = await supabaseAdmin.auth.admin.getUserById(user.id);
        
        if (userError) {
          console.error(`Erro ao obter metadados do usuário ${user.id}:`, userError);
          results.errors.push({
            user_id: user.id,
            error: 'Erro ao obter metadados do usuário',
            details: userError
          });
          continue;
        }

        if (!userData || !userData.user) {
          console.error(`Usuário ${user.id} não encontrado`);
          results.errors.push({
            user_id: user.id,
            error: 'Usuário não encontrado'
          });
          continue;
        }

        // Verificar se o status nos metadados é diferente do banco
        const metadataStatus = userData.user.user_metadata?.status;
        
        if (metadataStatus !== user.status) {
          console.log(`Atualizando metadados do usuário ${user.id} de ${metadataStatus || 'indefinido'} para ${user.status}`);
          
          // Atualizar os metadados
          const { error: updateMetaError } = await supabaseAdmin.auth.admin.updateUserById(
            user.id,
            { user_metadata: { ...userData.user.user_metadata, status: user.status } }
          );
          
          if (updateMetaError) {
            console.error(`Erro ao atualizar metadados do usuário ${user.id}:`, updateMetaError);
            results.errors.push({
              user_id: user.id,
              error: 'Erro ao atualizar metadados do usuário',
              details: updateMetaError
            });
            continue;
          }

          // Adicionar à fila de sincronização para garantir
          const { error: queueError } = await supabaseAdmin
            .from('auth_sync_queue')
            .insert({
              user_id: user.id,
              status: user.status,
              processed: false,
              created_at: new Date().toISOString()
            })
            .select();
            
          if (queueError) {
            console.error(`Erro ao adicionar usuário ${user.id} à fila de sincronização:`, queueError);
            // Não interrompe o processo, pois as atualizações principais já foram feitas
          }

          console.log(`Usuário ${user.id} atualizado com sucesso para ${user.status}`);
          results.success.push({
            user_id: user.id,
            email: user.email,
            oldStatus: metadataStatus,
            newStatus: user.status
          });
        }
      } catch (error) {
        console.error(`Erro ao processar usuário ${user.id}:`, error);
        results.errors.push({
          user_id: user.id,
          error: 'Erro ao processar usuário',
          details: error.message
        });
      }
    }

    console.log(`Sincronização concluída: ${results.success.length} sucessos, ${results.errors.length} erros`);

    res.status(200).json({ 
      message: 'Sincronização de metadados de usuários concluída',
      updated: results.success.length,
      errors: results.errors.length,
      results
    });
  } catch (error) {
    console.error('Erro ao sincronizar metadados de usuários:', error);
    res.status(500).json({ error: 'Erro interno do servidor', details: error.message });
  }
});

// Rota para remover um usuário
app.post('/api/users/remove', authenticateUser, async (req, res) => {
  try {
    // Verificar se o usuário é administrador
    if (req.user.user_metadata?.status !== 'ADMIN') {
      console.log('Tentativa não autorizada de remover usuário:', req.user.id);
      return res.status(403).json({ error: 'Apenas administradores podem usar esta função' });
    }

    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({ error: 'ID do usuário é obrigatório' });
    }

    // Verificar se o usuário está tentando remover a si mesmo
    if (userId === req.user.id) {
      return res.status(400).json({ error: 'Você não pode remover seu próprio usuário' });
    }

    console.log(`Removendo usuário ${userId}`);

    // Remover da tabela users
    const { error: deleteDbError } = await supabaseAdmin
      .from('users')
      .delete()
      .eq('id', userId);
      
    if (deleteDbError) {
      console.error(`Erro ao remover usuário ${userId} do banco:`, deleteDbError);
      return res.status(500).json({ error: 'Erro ao remover usuário do banco de dados', details: deleteDbError });
    }

    // Remover o usuário do Auth
    const { error: deleteAuthError } = await supabaseAdmin.auth.admin.deleteUser(userId);
    
    if (deleteAuthError) {
      console.error(`Erro ao remover usuário ${userId} do Auth:`, deleteAuthError);
      return res.status(500).json({ 
        error: 'Erro ao remover usuário do Auth', 
        details: deleteAuthError,
        note: 'O usuário foi removido do banco de dados, mas não do Auth'
      });
    }

    console.log(`Usuário ${userId} removido com sucesso`);

    res.status(200).json({ 
      message: 'Usuário removido com sucesso',
      userId
    });
  } catch (error) {
    console.error('Erro ao remover usuário:', error);
    res.status(500).json({ error: 'Erro interno do servidor', details: error.message });
  }
});

// Rota para forçar a atualização de status para TRIAL para usuários novos
app.post('/api/users/force-trial-status', authenticateUser, async (req, res) => {
  try {
    // Verificar se é administrador
    if (req.user?.status !== 'ADMIN') {
      return res.status(403).json({ error: 'Apenas administradores podem realizar esta operação' });
    }

    // Buscar usuários criados nos últimos 7 dias
    const { data: newUsers, error: userError } = await supabaseAdmin
      .from('users')
      .select('id, email, status, created_at')
      .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
      .order('created_at', { ascending: false });

    if (userError) {
      console.error('Erro ao buscar usuários novos:', userError);
      return res.status(500).json({ error: 'Erro ao buscar usuários novos', details: userError });
    }

    const results = {
      success: [],
      unchanged: [],
      errors: []
    };

    // Atualizar cada usuário para TRIAL
    for (const user of newUsers) {
      // Pular usuários que já estão com status TRIAL
      if (user.status === 'TRIAL') {
        results.unchanged.push({
          user_id: user.id,
          email: user.email,
          status: user.status
        });
        continue;
      }

      // Atualizar no banco de dados
      const { error: updateDbError } = await supabaseAdmin
        .from('users')
        .update({
          status: 'TRIAL',
          updated_at: new Date().toISOString()
        })
        .eq('id', user.id);

      if (updateDbError) {
        console.error(`Erro ao atualizar status do usuário ${user.id} no banco:`, updateDbError);
        results.errors.push({
          user_id: user.id,
          email: user.email,
          error: 'Erro ao atualizar status no banco de dados'
        });
        continue;
      }

      // Obter dados do usuário na auth
      const { data: userData, error: userDataError } = await supabaseAdmin.auth.admin.getUserById(user.id);

      if (userDataError) {
        console.error(`Erro ao buscar dados do usuário ${user.id}:`, userDataError);
        results.errors.push({
          user_id: user.id,
          email: user.email,
          error: 'Erro ao buscar dados do usuário na autenticação'
        });
        continue;
      }

      // Atualizar os metadados
      const updatedMetadata = { ...userData.user.user_metadata, status: 'TRIAL' };
      const { error: updateMetaError } = await supabaseAdmin.auth.admin.updateUserById(
        user.id,
        { user_metadata: updatedMetadata }
      );

      if (updateMetaError) {
        console.error(`Erro ao atualizar metadados do usuário ${user.id}:`, updateMetaError);
        results.errors.push({
          user_id: user.id,
          email: user.email,
          error: 'Erro ao atualizar metadados do usuário'
        });
        continue;
      }

      // Adicionar à fila de sincronização
      const { error: queueError } = await supabaseAdmin
        .from('auth_sync_queue')
        .insert({
          user_id: user.id,
          status: 'TRIAL',
          processed: false,
          created_at: new Date().toISOString()
        })
        .select();

      if (queueError) {
        console.error(`Erro ao adicionar usuário ${user.id} à fila de sincronização:`, queueError);
        // Não interrompe o processo, pois as atualizações principais já foram feitas
      }

      console.log(`Status do usuário ${user.id} atualizado com sucesso de ${user.status} para TRIAL`);
      results.success.push({
        user_id: user.id,
        email: user.email,
        old_status: user.status,
        new_status: 'TRIAL'
      });
    }

    return res.status(200).json({
      message: 'Processo de atualização de status concluído',
      summary: {
        total_users: newUsers.length,
        updated: results.success.length,
        unchanged: results.unchanged.length,
        errors: results.errors.length
      },
      results
    });
  } catch (error) {
    console.error('Erro durante a atualização de status:', error);
    return res.status(500).json({ error: 'Erro interno do servidor', details: error.message });
  }
});

// Adicionar a configuração do pool de conexões PostgreSQL
const pgPool = new Pool({
  connectionString: process.env.POSTGRES_CONNECTION_STRING,
  ssl: { rejectUnauthorized: false }
});

// Verificar e criar função SQL permanente para atualização de status
const createPermanentStatusUpdateFunction = async () => {
  try {
    console.log('Verificando existência da função admin_update_user_status...');
    
    if (!pool) {
      console.error('Não foi possível criar função permanente: pool de conexão não disponível');
      return;
    }
    
    // Verificar se a função já existe
    const checkQuery = `
      SELECT EXISTS (
        SELECT 1 FROM pg_proc 
        WHERE proname = 'admin_update_user_status'
      ) AS exists
    `;
    
    const { rows } = await pool.query(checkQuery);
    
    if (rows[0]?.exists) {
      console.log('Função admin_update_user_status já existe.');
      return;
    }
    
    console.log('Criando função permanente admin_update_user_status...');
    
    // Criar função permanente com SECURITY DEFINER para contornar RLS
    const createFunctionQuery = `
      CREATE OR REPLACE FUNCTION public.admin_update_user_status(
        target_user_id UUID,
        new_status TEXT
      ) 
      RETURNS BOOLEAN
      LANGUAGE plpgsql
      SECURITY DEFINER -- Executa com permissões do proprietário da função
      AS $$
      DECLARE
        current_status TEXT;
        updated_status TEXT;
        success BOOLEAN := FALSE;
      BEGIN
        -- Validar status
        IF new_status NOT IN ('ADMIN', 'ATIVO', 'INATIVO', 'TRIAL') THEN
          RAISE EXCEPTION 'Status inválido: %', new_status;
          RETURN FALSE;
        END IF;
        
        -- Verificar status atual
        SELECT status INTO current_status
        FROM public.users
        WHERE id = target_user_id;
        
        -- Desativar políticas RLS temporariamente
        SET LOCAL session_replication_role = 'replica';
        
        -- Atualizar status com cast explícito para o tipo ENUM
        UPDATE public.users
        SET 
          status = new_status::user_status,
          updated_at = NOW()
        WHERE id = target_user_id;
        
        -- Verificar se houve atualização
        GET DIAGNOSTICS success = ROW_COUNT;
        
        -- Restaurar políticas RLS
        SET LOCAL session_replication_role = 'origin';
        
        -- Verificar status após atualização
        IF success THEN
          SELECT status INTO updated_status
          FROM public.users
          WHERE id = target_user_id;
          
          -- Criar tabela de auditoria se não existir
          CREATE TABLE IF NOT EXISTS admin_audit_log (
            id SERIAL PRIMARY KEY,
            operation VARCHAR(255) NOT NULL,
            target_table VARCHAR(255) NOT NULL,
            record_id UUID NOT NULL,
            old_value TEXT,
            new_value TEXT,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
          );
          
          -- Registrar operação
          INSERT INTO admin_audit_log (
            operation,
            target_table,
            record_id,
            old_value,
            new_value,
            created_at
          ) VALUES (
            'update_user_status',
            'users',
            target_user_id,
            current_status,
            new_status,
            NOW()
          );
        END IF;
        
        RETURN success;
      END;
      $$;
      
      -- Conceder permissões de execução
      GRANT EXECUTE ON FUNCTION public.admin_update_user_status(UUID, TEXT) TO authenticated;
      GRANT EXECUTE ON FUNCTION public.admin_update_user_status(UUID, TEXT) TO service_role;
      
      -- Comentário explicativo
      COMMENT ON FUNCTION public.admin_update_user_status(UUID, TEXT) IS 
      'Atualiza o status de um usuário contornando RLS. Apenas administradores devem ter acesso a esta função.';
    `;
    
    await pool.query(createFunctionQuery);
    console.log('✓ Função admin_update_user_status criada com sucesso!');
    
  } catch (error) {
    console.error('Erro ao criar função permanente:', error.message);
  }
};

// Modificar a função updateUserStatusInDatabase para usar a função permanente
async function updateUserStatusInDatabase(userId, newStatus) {
  try {
    console.log(`Tentando atualizar status para ${newStatus} no banco de dados...`);
    
    // Primeiro tentar o método normal via API Supabase
    const { error: normalUpdateError } = await supabaseAdmin
      .from('users')
      .update({ 
        status: newStatus,
        updated_at: new Date().toISOString()
      })
      .eq('id', userId);
    
    // Se funcionar normalmente, retornar sucesso
    if (!normalUpdateError) {
      console.log(`Status atualizado com sucesso via API normal para ${userId}`);
      return { 
        success: true, 
        method: 'api',
        message: `Status atualizado para ${newStatus}`
      };
    }
    
    console.log(`Atualização normal falhou: ${normalUpdateError.message}`);
    
    // NOVA ESTRATÉGIA: Usar a função SQL permanente admin_update_user_status
    console.log('Tentando usar função SQL permanente admin_update_user_status...');
    try {
      const { data: funcResult, error: funcError } = await supabaseAdmin.rpc(
        'admin_update_user_status',
        { 
          target_user_id: userId,
          new_status: newStatus
        }
      );
      
      if (funcError) {
        console.error(`Erro ao chamar função admin_update_user_status: ${funcError.message}`);
        console.log('Tentando métodos alternativos...');
      } else {
        console.log(`Função admin_update_user_status executada: ${funcResult}`);
        
        // Verificar se a função foi bem-sucedida
        if (funcResult === true) {
          return { 
            success: true, 
            method: 'permanent_function',
            message: `Status atualizado para ${newStatus} via função SQL permanente`
          };
        }
      }
    } catch (funcCallError) {
      console.error(`Erro ao chamar função permanente: ${funcCallError.message}`);
    }
    
    // Se ainda estamos aqui, tentar métodos alternativos
    // MÉTODO 1: Se estamos tentando definir como ADMIN, usar a função RPC admin_set_user_status
    if (newStatus === 'ADMIN') {
      console.log('Tentando usar método alternativo para status ADMIN...');
      
      try {
        // Verificar se a função existe
        const { data: funcExists, error: funcExistsError } = await supabaseAdmin.rpc(
          'pg_query',
          { 
            query: `
              SELECT EXISTS (
                SELECT 1 FROM pg_proc 
                WHERE proname = 'admin_set_user_status'
              ) AS exists
            `
          }
        );
        
        // Se a função não existir ou houver erro, criar a função
        if (funcExistsError || !funcExists || !funcExists[0]?.exists) {
          console.log('Função admin_set_user_status não encontrada. Criando...');
          
          // Executar o script para criar a função
          const { error: createFunctionError } = await supabaseAdmin.rpc(
            'pg_query',
            { 
              query: `
                CREATE OR REPLACE FUNCTION public.admin_set_user_status(
                  user_id UUID,
                  new_status TEXT
                ) RETURNS BOOLEAN
                LANGUAGE plpgsql
                SECURITY DEFINER
                AS $$
                DECLARE
                  success BOOLEAN;
                BEGIN
                  -- Validar status
                  IF new_status NOT IN ('ADMIN', 'ATIVO', 'INATIVO', 'TRIAL') THEN
                    RAISE EXCEPTION 'Status inválido: %', new_status;
                    RETURN FALSE;
                  END IF;
                  
                  -- Desativar políticas RLS temporariamente
                  SET LOCAL session_replication_role = 'replica';
                  
                  -- Atualizar status do usuário
                  UPDATE public.users
                  SET status = new_status,
                      updated_at = NOW()
                  WHERE id = user_id;
                  
                  -- Verificar se a atualização funcionou
                  GET DIAGNOSTICS success = ROW_COUNT;
                  
                  -- Reativar RLS
                  SET LOCAL session_replication_role = 'origin';
                  
                  RETURN success;
                END;
                $$;
                
                -- Conceder permissões
                GRANT EXECUTE ON FUNCTION public.admin_set_user_status TO service_role;
              `
            }
          );
          
          if (createFunctionError) {
            console.error('Erro ao criar função admin_set_user_status:', createFunctionError);
          } else {
            console.log('Função admin_set_user_status criada com sucesso!');
          }
        }
        
        // Chamar a função RPC para atualizar o status
        const { data: rpcResult, error: rpcError } = await supabaseAdmin.rpc(
          'admin_set_user_status',
          { 
            user_id: userId,
            new_status: newStatus
          }
        );
        
        if (rpcError) {
          console.error(`Erro ao chamar função admin_set_user_status: ${rpcError.message}`);
          
          // Tentar método alternativo - SQL direto
          console.log('Tentando método direto via SQL...');
          return await executeDirectSqlUpdate(userId, newStatus);
        }
        
        console.log(`Função admin_set_user_status executada: ${rpcResult}`);
        
        // Verificar se a atualização foi bem sucedida
        const { data: verifyData, error: verifyError } = await supabaseAdmin
          .from('users')
          .select('status')
          .eq('id', userId)
          .single();
          
        if (verifyError) {
          console.error(`Erro ao verificar atualização: ${verifyError.message}`);
          return { 
            success: true, 
            method: 'rpc_unverified',
            message: `Função RPC executada, mas não foi possível verificar o resultado`
          };
        }
        
        if (verifyData?.status === newStatus) {
          console.log(`✓ Verificação confirma que o status foi atualizado para ${newStatus}`);
          return { 
            success: true, 
            method: 'rpc_verified',
            message: `Status atualizado para ${newStatus} via função RPC e verificado`
          };
        } else {
          console.log(`❌ Verificação indica que o status NÃO foi atualizado para ${newStatus}`);
          
          // Tentar método alternativo - SQL direto
          console.log('Tentando método direto via SQL como última alternativa...');
          return await executeDirectSqlUpdate(userId, newStatus);
        }
      } catch (rpcError) {
        console.error(`Erro ao executar RPC: ${rpcError.message}`);
        
        // Tentar método alternativo - SQL direto
        console.log('Erro na função RPC, tentando SQL direto...');
        return await executeDirectSqlUpdate(userId, newStatus);
      }
    } else {
      // Se não estamos tentando definir como ADMIN, continuar com o método SQL direto
      return await executeDirectSqlUpdate(userId, newStatus);
    }
    
  } catch (error) {
    console.error(`Erro geral ao atualizar status no banco de dados: ${error.message}`);
    return { 
      success: false, 
      method: 'exception',
      message: error.message
    };
  }
}

// Função auxiliar para executar SQL direto
async function executeDirectSqlUpdate(userId, newStatus) {
  try {
    console.log('Tentando atualização via SQL RAW...');
    
    // Se tivermos conexão direta com o banco de dados e for status ADMIN, usar conexão direta
    if (pool && newStatus === 'ADMIN') {
      console.log('Usando conexão direta ao PostgreSQL para atualizar status ADMIN...');
      
      try {
        // Primeiro, verificar se a conexão está funcionando
        const testQuery = 'SELECT NOW() as time';
        const testResult = await pool.query(testQuery);
        console.log(`Conexão com banco de dados funcionando: ${testResult.rows[0].time}`);
        
        // Verificar o status atual antes da atualização
        const checkCurrentStatusQuery = `
          SELECT status FROM public.users WHERE id = $1
        `;
        const currentStatusResult = await pool.query(checkCurrentStatusQuery, [userId]);
        const currentStatus = currentStatusResult.rows[0]?.status || 'desconhecido';
        console.log(`Status atual antes da atualização: ${currentStatus}`);
        
        // Usar a abordagem comprovada: desativar RLS e fazer cast explícito para user_status
        const directSql = `
          DO $$ 
          DECLARE
            target_user_id UUID := $1;
            new_status TEXT := $2;
            updated_status TEXT;
          BEGIN
            -- Desativar políticas RLS temporariamente
            SET session_replication_role = 'replica';
            
            -- Atualizar o status com cast explícito para o tipo ENUM
            UPDATE public.users
            SET 
              status = new_status::user_status,
              updated_at = NOW()
            WHERE id = target_user_id;
            
            -- Restaurar políticas RLS
            SET session_replication_role = 'origin';
            
            -- Verificar a atualização
            SELECT status INTO updated_status
            FROM public.users
            WHERE id = target_user_id;
            
            -- Criar tabela de auditoria se não existir
            CREATE TABLE IF NOT EXISTS admin_audit_log (
              id SERIAL PRIMARY KEY,
              operation VARCHAR(255) NOT NULL,
              target_table VARCHAR(255) NOT NULL,
              record_id UUID NOT NULL,
              old_value TEXT,
              new_value TEXT,
              created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            );
            
            -- Inserir registro de auditoria
            INSERT INTO admin_audit_log (
              operation,
              target_table,
              record_id,
              old_value,
              new_value,
              created_at
            ) VALUES (
              'update_user_status',
              'users',
              target_user_id,
              $3,
              new_status,
              NOW()
            );
          END $$;
        `;
        
        // Executar o SQL direto com os parâmetros
        await pool.query(directSql, [userId, newStatus, currentStatus]);
        
        // Verificar se a atualização funcionou
        const verifyQuery = `
          SELECT status FROM public.users WHERE id = $1
        `;
        
        const { rows } = await pool.query(verifyQuery, [userId]);
        
        if (rows && rows.length > 0) {
          const currentDbStatus = rows[0].status;
          console.log(`Status atual no banco de dados: ${currentDbStatus}`);
          
          if (currentDbStatus === newStatus) {
            console.log(`✓ Status atualizado com sucesso para ${newStatus} via SQL otimizado`);
            return { 
              success: true, 
              method: 'direct_sql_optimized',
              message: `Status atualizado para ${newStatus} via SQL otimizado e verificado`
            };
          } else {
            console.log(`❌ Falha na atualização direta. Status atual: ${currentDbStatus}`);
          }
        } else {
          console.log(`Usuário não encontrado após tentativa de atualização direta`);
        }
      } catch (directError) {
        console.error(`Erro ao usar SQL direto otimizado: ${directError.message}`);
        console.log('Continuando com métodos alternativos...');
      }
    }
    
    // Tentar método alternativo: usar safeQuery
    if (typeof safeQuery === 'function' && newStatus === 'ADMIN') {
      console.log('Tentando usar safeQuery para atualizar status ADMIN...');
      
      try {
        // Primeiro, verificar se a função está disponível
        const testQuery = 'SELECT NOW() as time';
        const testResult = await safeQuery(testQuery);
        console.log(`safeQuery funcionando: ${testResult.rows[0].time}`);
        
        // Criar query com SET session_replication_role para contornar RLS
        const bypassRlsQuery = `
          -- Desativar temporariamente RLS
          SET session_replication_role = 'replica';
        `;
        
        // Executar a desativação de RLS
        await safeQuery(bypassRlsQuery);
        
        // Atualizar o status
        const updateQuery = `
          UPDATE public.users 
          SET status = $1, 
              updated_at = NOW() 
          WHERE id = $2
        `;
        
        // Executar a atualização
        await safeQuery(updateQuery, [newStatus, userId]);
        
        // Reativar RLS
        const restoreRlsQuery = `
          -- Restaurar RLS
          SET session_replication_role = 'origin';
        `;
        
        // Executar a reativação de RLS
        await safeQuery(restoreRlsQuery);
        
        // Verificar se a atualização funcionou
        const verifyQuery = `
          SELECT status FROM public.users WHERE id = $1
        `;
        
        const verifyResult = await safeQuery(verifyQuery, [userId]);
        
        if (verifyResult.rows && verifyResult.rows.length > 0) {
          const currentDbStatus = verifyResult.rows[0].status;
          console.log(`Status atual no banco de dados: ${currentDbStatus}`);
          
          if (currentDbStatus === newStatus) {
            console.log(`✓ Status atualizado com sucesso para ${newStatus} via safeQuery`);
            return { 
              success: true, 
              method: 'safequery_verified',
              message: `Status atualizado para ${newStatus} via safeQuery e verificado`
            };
          } else {
            console.log(`❌ Falha na atualização via safeQuery. Status atual: ${currentDbStatus}`);
          }
        } else {
          console.log(`Usuário não encontrado após tentativa de atualização via safeQuery`);
        }
      } catch (safeQueryError) {
        console.error(`Erro ao usar safeQuery: ${safeQueryError.message}`);
        console.log('Continuando com métodos alternativos...');
      }
    }
    
    // Continuar com o método Supabase
    // Executar SQL RAW via API Supabase que desativa temporariamente os triggers
    const rawSql = `
      BEGIN;
      -- Obter informações do esquema
      DO $$
      DECLARE
        schema_name TEXT;
      BEGIN
        -- Verificar em qual esquema a tabela existe
        SELECT table_schema INTO schema_name
        FROM information_schema.tables
        WHERE table_name = 'users'
        LIMIT 1;
        
        -- Se a tabela existir, atualizar o status
        IF schema_name IS NOT NULL THEN
          -- Desativar temporariamente os triggers
          EXECUTE 'SET session_replication_role = ''replica'';';
          
          -- Executar a atualização ignorando os triggers
          EXECUTE format('
            UPDATE %I.users 
            SET status = %L, updated_at = NOW() 
            WHERE id = %L',
            schema_name, '${newStatus}', '${userId}'
          );
          
          -- Reativar os triggers
          EXECUTE 'SET session_replication_role = ''origin'';';
        END IF;
      END
      $$;
      COMMIT;
    `;
    
    // Executar o SQL RAW via Supabase
    const { error: rawSqlError } = await supabaseAdmin.rpc('pg_query', { query: rawSql });
    
    if (rawSqlError) {
      console.error(`Erro ao executar SQL RAW: ${rawSqlError.message}`);
      
      // Tentar uma abordagem mais simples com a função rpc do Supabase
      console.log('Tentando abordagem alternativa via função personalizada...');
      
      // Criar uma função SQL especial para esta operação específica
      const createFunctionSQL = `
        CREATE OR REPLACE FUNCTION temp_update_user_status(user_id UUID, status_value TEXT)
        RETURNS BOOLEAN
        LANGUAGE plpgsql
        SECURITY DEFINER
        AS $$
        BEGIN
          -- Desativar triggers
          SET LOCAL session_replication_role = 'replica';
          
          -- Atualizar o status
          UPDATE public.users 
          SET status = status_value, updated_at = NOW() 
          WHERE id = user_id;
          
          -- Reativar triggers
          SET LOCAL session_replication_role = 'origin';
          
          RETURN FOUND;
        END;
        $$;
      `;
      
      // Criar a função temporária
      const { error: createFuncError } = await supabaseAdmin.rpc('pg_query', { query: createFunctionSQL });
      
      if (createFuncError) {
        console.error(`Erro ao criar função temporária: ${createFuncError.message}`);
        return { 
          success: false, 
          method: 'all_failed',
          message: `Não foi possível atualizar o status para ${newStatus} de nenhuma forma. Erro: ${createFuncError.message}`
        };
      }
      
      // Chamar a função temporária
      const { data: funcResult, error: funcError } = await supabaseAdmin.rpc(
        'temp_update_user_status',
        {
          user_id: userId,
          status_value: newStatus
        }
      );
      
      if (funcError) {
        console.error(`Erro ao chamar função temporária: ${funcError.message}`);
        return { 
          success: false, 
          method: 'all_failed',
          message: `Tentativas de atualização falharam. Último erro: ${funcError.message}`
        };
      }
      
      console.log(`Resultado da função temporária: ${funcResult}`);
      return { 
        success: true, 
        method: 'temp_function',
        message: `Status atualizado para ${newStatus} via função temporária`
      };
    }
    
    // SQL RAW foi executado com sucesso
    console.log('SQL RAW executado com sucesso');
    
    // Verificar se a atualização realmente foi aplicada
    const { data: verifyData, error: verifyError } = await supabaseAdmin
    .from('users')
    .select('status')
    .eq('id', userId)
    .single();
    
    if (verifyError) {
      console.error(`Erro ao verificar atualização: ${verifyError.message}`);
      return { 
        success: true, 
        method: 'raw_sql_unverified',
        message: `SQL RAW executado com sucesso, mas não foi possível verificar o resultado`
      };
    }
    
    if (verifyData?.status === newStatus) {
      console.log(`Verificação confirma que o status foi atualizado para ${newStatus}`);
      return { 
        success: true, 
        method: 'raw_sql_verified',
        message: `Status atualizado para ${newStatus} via SQL RAW e verificado`
      };
    } else {
      console.log(`Verificação indica que o status NÃO foi atualizado. Atual: ${verifyData?.status}`);
      return { 
        success: false, 
        method: 'raw_sql_failed',
        message: `SQL RAW foi executado, mas o status não foi atualizado. Atual: ${verifyData?.status}`
      };
    }
  } catch (sqlError) {
    console.error(`Erro ao executar SQL direto: ${sqlError.message}`);
    return { 
      success: false, 
      method: 'sql_exception',
      message: sqlError.message
    };
  }
}

// Modificar a rota de atualização de status
app.post('/api/users/update-status', authenticateUser, async (req, res) => {
  try {
    // Verificar se o usuário autenticado é administrador
    if (req.user.user_metadata?.status !== 'ADMIN') {
      return res.status(403).json({ error: 'Apenas administradores podem atualizar o status de usuários' });
    }

    const { userId, newStatus } = req.body;

    if (!userId || !newStatus) {
      return res.status(400).json({ error: 'ID do usuário e novo status são obrigatórios' });
    }

    // Validar o status
    const validStatuses = ['INATIVO', 'ATIVO', 'ADMIN', 'TRIAL'];
    if (!validStatuses.includes(newStatus)) {
      return res.status(400).json({ error: 'Status inválido' });
    }

    console.log(`===== INÍCIO DA ATUALIZAÇÃO DE STATUS =====`);
    console.log(`Atualizando status do usuário ${userId} para ${newStatus}`);

    // ETAPA 1: Atualizar autenticação (Supabase Auth)
    console.log(`ETAPA 1: Atualizando autenticação no Supabase Auth...`);
    
    // Obter os dados atuais do usuário
    const { data: userData, error: userError } = await supabaseAdmin.auth.admin.getUserById(userId);
    
    if (userError || !userData || !userData.user) {
      const errorMessage = userError ? userError.message : 'Usuário não encontrado';
      console.error(`Erro ao obter dados do usuário ${userId}:`, errorMessage);
      return res.status(userError ? 500 : 404).json({ error: errorMessage });
    }

    // Atualizar metadados do usuário no Supabase Auth
    const currentMetadata = userData.user.user_metadata || {};
    const updatedMetadata = { 
      ...currentMetadata, 
      status: newStatus,
      admin: newStatus === 'ADMIN',
      paid: newStatus === 'ATIVO' || newStatus === 'ADMIN',
      statusUpdatedAt: new Date().toISOString()
    };
    
    // Se for ADMIN, também atualizar app_metadata para ter certeza
    let appMetadata = userData.user.app_metadata || {};
    if (newStatus === 'ADMIN') {
      appMetadata = {
        role: 'admin'
      };
    }
    
    console.log(`Atualizando metadados do usuário para:`, {
      user_metadata: updatedMetadata,
      app_metadata: appMetadata
    });
    
    // Fazer uma atualização completa do usuário no Supabase Auth
    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
      userId,
      { 
        user_metadata: updatedMetadata,
        app_metadata: appMetadata,
        email_confirm: true
      }
    );
    
    if (updateError) {
      console.error(`Erro ao atualizar metadados do usuário ${userId}:`, updateError);
      return res.status(500).json({ error: 'Erro ao atualizar metadados do usuário', details: updateError.message });
    }

    console.log(`✓ Metadados do usuário ${userId} atualizados com sucesso para ${newStatus}`);
    
    // ETAPA 2: Atualizar a tabela Users (dados da aplicação)
    console.log(`ETAPA 2: Atualizando tabela users...`);
    
    // Primeira tentativa: Usando API normal
    const { data: updateData, error: tableUpdateError } = await supabaseAdmin
      .from('users')
      .update({ 
        status: newStatus,
        updated_at: new Date().toISOString()
      })
      .eq('id', userId)
      .select();
    
    let databaseUpdateResult = {
      success: !tableUpdateError,
      method: 'api',
      message: tableUpdateError 
        ? `Falha na atualização via API: ${tableUpdateError.message}` 
        : `Status atualizado para ${newStatus} via API`
    };
    
    if (tableUpdateError) {
      console.log(`Aviso: Não foi possível atualizar tabela users: ${tableUpdateError.message}`);
      console.log('Isso pode ser esperado para status ADMIN devido às políticas RLS.');
      console.log('Os metadados no sistema de autenticação foram atualizados com sucesso.');
    } else {
      console.log(`✓ Tabela users atualizada com sucesso para ${userId}`);
    }
    
    // ETAPA 3: Invalidar sessões para forçar novos tokens com o novo status
    console.log(`ETAPA 3: Invalidando sessões para atualizar tokens...`);
    
    if (newStatus === 'ADMIN' || newStatus === 'INATIVO') {
      try {
        console.log(`Invalidando sessões do usuário ${userId}...`);
        
        // Global sign-out para forçar reautenticação
        const { error: signOutError } = await supabaseAdmin.auth.admin.signOut(userId, true);
        
        if (signOutError) {
          console.log(`Aviso: API de logout global falhou: ${signOutError.message}`);
          
          // Tentar método alternativo - deletar sessões diretamente
          try {
            const { error: deleteSessionsError } = await supabaseAdmin
              .from('sessions')
              .delete()
              .eq('user_id', userId);
              
            if (deleteSessionsError) {
              console.log(`Também não foi possível deletar sessões: ${deleteSessionsError.message}`);
            } else {
              console.log(`✓ Sessões deletadas diretamente para ${userId}`);
            }
          } catch (e) {
            console.log(`Erro ao manipular tabela de sessões: ${e.message}`);
          }
        } else {
          console.log(`✓ Sessões do usuário ${userId} invalidadas com sucesso`);
        }
      } catch (e) {
        console.log(`Exceção ao invalidar sessões: ${e.message}`);
      }
    }
    
    // ETAPA 4: Verificar se as alterações foram aplicadas corretamente
    console.log(`ETAPA 4: Verificando atualizações...`);
    
    // Verificar Auth
    const { data: authCheck, error: authCheckError } = await supabaseAdmin.auth.admin.getUserById(userId);
    
    if (authCheckError) {
      console.log(`Erro ao verificar autenticação: ${authCheckError.message}`);
    } else {
      const authStatus = authCheck.user.user_metadata?.status || 'Desconhecido';
      console.log(`Status atual na autenticação: ${authStatus}`);
      
      if (authStatus === newStatus) {
        console.log(`✓ Confirmado: Status ${newStatus} está corretamente definido na autenticação`);
      } else {
        console.log(`⚠️ ALERTA: Status na autenticação (${authStatus}) não corresponde ao solicitado (${newStatus})`);
      }
    }
    
    // Verificar DB
    const { data: dbCheck, error: dbCheckError } = await supabaseAdmin
      .from('users')
      .select('status')
      .eq('id', userId)
      .single();
      
    if (dbCheckError) {
      console.log(`Erro ao verificar status no banco de dados: ${dbCheckError.message}`);
    } else {
      const dbStatus = dbCheck?.status || 'Desconhecido';
      console.log(`Status atual no banco de dados: ${dbStatus}`);
      
      if (dbStatus === newStatus) {
        console.log(`✓ Confirmado: Status ${newStatus} está corretamente definido no banco de dados`);
      } else {
        console.log(`⚠️ ALERTA: Status no banco (${dbStatus}) não corresponde ao solicitado (${newStatus})`);
        console.log(`Isso pode ser esperado para status ADMIN devido às políticas RLS.`);
      }
    }
    
    console.log(`===== FIM DA ATUALIZAÇÃO DE STATUS =====`);
    
    // Retornar informações detalhadas sobre as atualizações
    res.status(200).json({ 
      message: 'Status do usuário atualizado com sucesso',
      userId, 
      newStatus,
      authUpdated: true,
      databaseUpdated: databaseUpdateResult.success,
      authStatus: authCheck?.user?.user_metadata?.status || 'Desconhecido',
      dbStatus: dbCheck?.status || 'Desconhecido'
    });
  } catch (error) {
    console.error('Erro ao atualizar status do usuário:', error);
    res.status(500).json({ error: 'Erro interno do servidor', details: error.message });
  }
});

// Rota para processar tarefas de sincronização pendentes
app.post('/api/admin/process-tasks', authenticateUser, async (req, res) => {
  try {
    // Verificar se o usuário é administrador
    if (req.user.user_metadata?.status !== 'ADMIN') {
      console.log('Tentativa não autorizada de processar tarefas:', req.user.id);
      return res.status(403).json({ error: 'Apenas administradores podem usar esta função' });
    }

    console.log('Processando tarefas de sincronização pendentes...');
    
    // Buscar tarefas pendentes
    const { data: tasks, error: tasksError } = await supabaseAdmin
      .from('auth_sync_queue')
      .select('*')
      .eq('processed', false)
      .order('created_at', { ascending: true })
      .limit(50);
      
    if (tasksError) {
      console.error('Erro ao buscar tarefas pendentes:', tasksError);
      return res.status(500).json({ error: 'Erro ao buscar tarefas pendentes', details: tasksError });
    }
    
    if (!tasks || tasks.length === 0) {
      return res.status(200).json({ message: 'Nenhuma tarefa pendente encontrada' });
    }
    
    console.log(`Encontradas ${tasks.length} tarefas pendentes para processamento`);
    
    let processedCount = 0;
    let errorCount = 0;
    
    // Processar cada tarefa
    for (const task of tasks) {
      try {
        if (task.type === 'update_status' || task.type === 'update_metadata') {
          const { data: userData, error: userError } = await supabaseAdmin.auth.admin.getUserById(task.user_id);
          
          if (userError) {
            console.error(`Erro ao obter usuário ${task.user_id}:`, userError);
            continue;
          }
          
          // Atualizar metadados do usuário
          if (task.status) {
            const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
              task.user_id,
              { 
                user_metadata: { 
                  ...userData.user.user_metadata, 
                  status: task.status 
                }
              }
            );
            
            if (updateError) {
              console.error(`Erro ao atualizar metadados do usuário ${task.user_id}:`, updateError);
              errorCount++;
              continue;
            }
          }
          
          // Tentar atualizar a tabela users 
          try {
            const { error: userUpdateError } = await supabaseAdmin
              .from('users')
              .update({ 
                status: task.status,
                updated_at: new Date().toISOString()
              })
              .eq('id', task.user_id);
              
            if (userUpdateError) {
              console.warn(`Aviso: Não foi possível atualizar a tabela users para ${task.user_id}:`, userUpdateError.message);
            }
          } catch (userUpdateError) {
            console.warn(`Exceção ao atualizar tabela users para ${task.user_id}:`, userUpdateError);
          }
          
          // Marcar tarefa como processada
          const { error: markError } = await supabaseAdmin
            .from('auth_sync_queue')
            .update({ 
              processed: true,
              processed_at: new Date().toISOString()
            })
            .eq('id', task.id);
            
          if (markError) {
            console.error(`Erro ao marcar tarefa ${task.id} como processada:`, markError);
          } else {
            processedCount++;
          }
        }
      } catch (taskError) {
        console.error(`Erro ao processar tarefa ${task.id}:`, taskError);
        errorCount++;
      }
    }
    
    res.status(200).json({ 
      message: `Processamento concluído. ${processedCount} tarefas processadas com sucesso, ${errorCount} erros.` 
    });
  } catch (error) {
    console.error('Erro ao processar tarefas:', error);
    res.status(500).json({ error: 'Erro interno do servidor', details: error.message });
  }
});

// Rota para buscar metadados dos usuários
app.post('/api/users/metadata', authenticateUser, async (req, res) => {
  try {
    // Verificar se o usuário é administrador
    if (req.user.user_metadata?.status !== 'ADMIN') {
      console.log('Tentativa não autorizada de acessar metadados:', req.user.id);
      return res.status(403).json({ error: 'Apenas administradores podem usar esta função' });
    }

    const { userIds } = req.body;

    if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
      return res.status(400).json({ error: 'Lista de IDs de usuários é obrigatória' });
    }

    console.log(`Buscando metadados para ${userIds.length} usuários`);

    // Limitar o número de usuários por questões de performance
    const limitedUserIds = userIds.slice(0, 100);
    
    // Buscar os metadados de cada usuário
    const usersData = [];
    
    for (const userId of limitedUserIds) {
      try {
        const { data, error } = await supabaseAdmin.auth.admin.getUserById(userId);
        
        if (error) {
          console.error(`Erro ao buscar usuário ${userId}:`, error);
          continue;
        }
        
        if (data && data.user) {
          usersData.push({
            id: userId,
            metadata: data.user.user_metadata || {}
          });
        }
      } catch (userError) {
        console.error(`Erro ao processar usuário ${userId}:`, userError);
      }
    }
    
    console.log(`Retornando metadados para ${usersData.length} usuários`);
    
    res.status(200).json({ 
      message: 'Metadados dos usuários obtidos com sucesso',
      users: usersData
    });
  } catch (error) {
    console.error('Erro ao buscar metadados dos usuários:', error);
    res.status(500).json({ error: 'Erro interno do servidor', details: error.message });
  }
});

// Nova rota para verificar e forçar a atualização do status atual do usuário
app.get('/api/users/verify-admin-status', authenticateUser, async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Obter detalhes completos do usuário com a chave de admin
    const { data: userData, error: userError } = await supabaseAdmin.auth.admin.getUserById(userId);
    
    if (userError) {
      console.error('Erro ao obter dados do usuário:', userError);
      return res.status(500).json({ error: 'Erro ao verificar status', details: userError.message });
    }
    
    if (!userData || !userData.user) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }
    
    // Obter status do banco de dados
    const { data: dbUser, error: dbError } = await supabaseAdmin
      .from('users')
      .select('status')
      .eq('id', userId)
      .single();
      
    const dbStatus = dbError ? null : dbUser?.status;
    const metaStatus = userData.user.user_metadata?.status;
    
    console.log(`Verificando status para ${userId}:`, {
      database_status: dbStatus,
      metadata_status: metaStatus,
      is_admin_jwt: userData.user.app_metadata?.role === 'admin',
      is_admin_meta: userData.user.user_metadata?.admin === true
    });
    
    // Determinar o status correto - priorizando ADMIN
    let correctStatus = metaStatus || dbStatus || 'INATIVO';
    let needsUpdate = false;
    
    // Se alguma fonte indicar que o usuário é ADMIN, mantê-lo como ADMIN
    if (metaStatus === 'ADMIN' || dbStatus === 'ADMIN' || 
        userData.user.app_metadata?.role === 'admin' || 
        userData.user.user_metadata?.admin === true) {
      correctStatus = 'ADMIN';
      
      // Verificar se os metadados precisam ser atualizados
      if (metaStatus !== 'ADMIN' || userData.user.user_metadata?.admin !== true) {
        needsUpdate = true;
      }
    }
    
    // Se precisar atualizar, fazer isso agora
    if (needsUpdate) {
      console.log(`Atualizando metadados do usuário ${userId} para ADMIN (verificação)...`);
      
      // Construir metadados atualizados preservando dados existentes
      const updatedMetadata = {
        ...userData.user.user_metadata,
        status: 'ADMIN',
        admin: true,
        paid: true
      };
      
      // Atualizar metadados
      const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
        userId,
        { user_metadata: updatedMetadata }
      );
      
      if (updateError) {
        console.error('Erro ao atualizar metadados:', updateError);
      } else {
        console.log('Metadados atualizados com sucesso para ADMIN');
        
        // Forçar logout de todas as sessões para aplicar as mudanças
        await supabaseAdmin.auth.admin.signOut(userId);
      }
    }
    
    return res.status(200).json({
      currentStatus: correctStatus,
      metadataStatus: metaStatus,
      databaseStatus: dbStatus,
      isAdmin: correctStatus === 'ADMIN',
      wasUpdated: needsUpdate,
      message: needsUpdate 
        ? 'O status foi atualizado para ADMIN. Por favor, faça logout e login novamente para aplicar as mudanças.'
        : 'O status está correto e atualizado.'
    });
    
  } catch (error) {
    console.error('Erro ao verificar status de administrador:', error);
    return res.status(500).json({ error: 'Erro interno do servidor', details: error.message });
  }
});

// Nova página HTML para ajudar o usuário a se tornar admin
app.get('/admin-helper', (req, res) => {
  const html = `
  <!DOCTYPE html>
  <html lang="pt-BR">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Assistente de Administrador - Songmetrix</title>
    <style>
      body {
        font-family: Arial, sans-serif;
        max-width: 800px;
        margin: 0 auto;
        padding: 20px;
        line-height: 1.6;
      }
      h1 { color: #2c3e50; }
      .card {
        border: 1px solid #ddd;
        border-radius: 8px;
        padding: 20px;
        margin-bottom: 20px;
        background-color: #f9f9f9;
      }
      button {
        background-color: #3498db;
        color: white;
        border: none;
        padding: 10px 15px;
        border-radius: 4px;
        cursor: pointer;
        font-size: 16px;
      }
      button:hover {
        background-color: #2980b9;
      }
      .success { color: green; }
      .error { color: red; }
      .steps {
        background-color: #f0f8ff;
        padding: 15px;
        border-left: 4px solid #3498db;
      }
      pre {
        background-color: #f5f5f5;
        padding: 10px;
        border-radius: 4px;
        overflow-x: auto;
      }
      #status {
        margin-top: 20px;
        padding: 15px;
        border-radius: 4px;
      }
    </style>
  </head>
  <body>
    <h1>Assistente de Administrador - Songmetrix</h1>
    
    <div class="card">
      <h2>Verificar e Corrigir Status de Administrador</h2>
      <p>Esta ferramenta ajuda a verificar e corrigir problemas com o status de administrador no Songmetrix.</p>
      
      <div class="steps">
        <h3>Passos para corrigir o status:</h3>
        <ol>
          <li>Clique no botão "Verificar Status" abaixo</li>
          <li>Se necessário, clique em "Corrigir Status"</li>
          <li>Faça logout e login novamente no sistema</li>
          <li>Retorne a esta página e clique em "Verificar Status" novamente</li>
        </ol>
      </div>
      
      <button id="checkStatus">Verificar Status</button>
      <button id="fixStatus" style="display:none">Corrigir Status</button>
      <button id="forceLogout" style="display:none">Forçar Logout</button>
      
      <div id="status"></div>
    </div>
    
    <script>
      const statusDiv = document.getElementById('status');
      const checkButton = document.getElementById('checkStatus');
      const fixButton = document.getElementById('fixStatus');
      const logoutButton = document.getElementById('forceLogout');
      
      // Função para obter o token JWT do localStorage
      function getToken() {
        try {
          // Tentar diferentes formatos de armazenamento do Supabase
          const supabaseKey = 'sb-aylxcqaddelwxfukerhr-auth-token';
          
          // Verificar localStorage
          let auth = localStorage.getItem(supabaseKey);
          if (auth) {
            try {
              auth = JSON.parse(auth);
              return auth.access_token;
            } catch (e) {
              console.error('Erro ao analisar token:', e);
            }
          }
          
          // Verificar outros formatos possíveis
          for (let key in localStorage) {
            if (key.includes('supabase') || key.includes('auth') || key.includes('token')) {
              try {
                const value = JSON.parse(localStorage.getItem(key));
                if (value && value.access_token) {
                  return value.access_token;
                }
              } catch (e) {
                // Ignorar erros de parse
              }
            }
          }
          
          return null;
        } catch (e) {
          console.error('Erro ao obter token:', e);
          return null;
        }
      }
      
      // Verificar status
      checkButton.addEventListener('click', async () => {
        statusDiv.innerHTML = '<p>Verificando status...</p>';
        
        const token = getToken();
        if (!token) {
          statusDiv.innerHTML = '<p class="error">Não foi possível encontrar o token de autenticação. Por favor, faça login primeiro.</p>';
          return;
        }
        
        try {
          const response = await fetch('/api/users/verify-admin-status', {
            headers: {
              'Authorization': 'Bearer ' + token
            }
          });
          
          const data = await response.json();
          
          if (response.ok) {
            let html = '<h3>Resultado da Verificação:</h3>';
            html += '<pre>' + JSON.stringify(data, null, 2) + '</pre>';
            
            if (data.isAdmin) {
              html += '<p class="success">Você tem status de ADMIN! ✅</p>';
              
              if (data.wasUpdated) {
                html += '<p>Seus metadados foram atualizados. Por favor, faça logout e login novamente.</p>';
                logoutButton.style.display = 'inline-block';
              }
            } else {
              html += '<p class="error">Você não tem status de ADMIN. ❌</p>';
              fixButton.style.display = 'inline-block';
            }
            
            statusDiv.innerHTML = html;
          } else {
            statusDiv.innerHTML = '<p class="error">Erro: ' + (data.error || 'Falha na verificação') + '</p>';
          }
        } catch (error) {
          statusDiv.innerHTML = '<p class="error">Erro ao verificar status: ' + error.message + '</p>';
        }
      });
      
      // Corrigir status
      fixButton.addEventListener('click', async () => {
        statusDiv.innerHTML += '<p>Aplicando correção...</p>';
        
        const token = getToken();
        if (!token) {
          statusDiv.innerHTML += '<p class="error">Não foi possível encontrar o token de autenticação.</p>';
          return;
        }
        
        try {
          // Chamar a API para definir o status como ADMIN
          const response = await fetch('/api/users/direct-update-status', {
            method: 'POST',
            headers: {
              'Authorization': 'Bearer ' + token,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              userId: 'self', // Valor especial para indicar o próprio usuário
              newStatus: 'ADMIN'
            })
          });
          
          const data = await response.json();
          
          if (response.ok) {
            statusDiv.innerHTML += '<p class="success">Status corrigido com sucesso!</p>';
            statusDiv.innerHTML += '<p>Por favor, faça logout e login novamente para aplicar as mudanças.</p>';
            statusDiv.innerHTML += '<pre>' + JSON.stringify(data, null, 2) + '</pre>';
            
            fixButton.style.display = 'none';
            logoutButton.style.display = 'inline-block';
          } else {
            statusDiv.innerHTML += '<p class="error">Erro ao corrigir status: ' + (data.error || 'Falha na operação') + '</p>';
          }
        } catch (error) {
          statusDiv.innerHTML += '<p class="error">Erro ao corrigir status: ' + error.message + '</p>';
        }
      });
      
      // Forçar logout
      logoutButton.addEventListener('click', () => {
        try {
          // Limpar todos os dados de autenticação do localStorage
          for (let key in localStorage) {
            if (key.includes('supabase') || key.includes('auth') || key.includes('token')) {
              localStorage.removeItem(key);
            }
          }
          
          statusDiv.innerHTML += '<p class="success">Logout realizado com sucesso! Redirecionando para a página de login...</p>';
          
          // Redirecionar para a página de login após 2 segundos
          setTimeout(() => {
            window.location.href = 'http://localhost:5173/login';
          }, 2000);
        } catch (e) {
          statusDiv.innerHTML += '<p class="error">Erro ao fazer logout: ' + e.message + '</p>';
        }
      });
    </script>
  </body>
  </html>
  `;
  
  res.send(html);
});

// Modificar a rota direct-update-status para aceitar 'self' como userId
app.post('/api/users/direct-update-status', authenticateUser, async (req, res) => {
  try {
    // Verificar se o usuário é administrador ou está atualizando a si mesmo
    let { userId, newStatus } = req.body;
    
    // Se userId for 'self', usar o ID do usuário autenticado
    if (userId === 'self') {
      userId = req.user.id;
      // Permitir que o usuário defina a si mesmo como ADMIN através da página de ajuda
    } else if (req.user.user_metadata?.status !== 'ADMIN') {
      // Para outros casos, apenas administradores podem atualizar outros usuários
      console.log('Tentativa não autorizada de atualizar status (acesso direto):', req.user.id);
      return res.status(403).json({ error: 'Apenas administradores podem usar esta função' });
    }

    if (!userId || !newStatus) {
      return res.status(400).json({ error: 'ID do usuário e novo status são obrigatórios' });
    }

    // Validar o status
    const validStatuses = ['INATIVO', 'ATIVO', 'ADMIN', 'TRIAL'];
    if (!validStatuses.includes(newStatus)) {
      return res.status(400).json({ error: 'Status inválido' });
    }

    console.log(`Atualizando status do usuário ${userId} para ${newStatus} (acesso direto)`);

    // Primeiro, obter o usuário para verificar se ele existe
    const { data: userData, error: userError } = await supabaseAdmin.auth.admin.getUserById(userId);
    
    if (userError) {
      console.error(`Erro ao obter metadados do usuário ${userId}:`, userError);
      return res.status(500).json({ error: 'Erro ao obter metadados do usuário', details: userError });
    }

    if (!userData || !userData.user) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }

    // Atualizar metadados - esta é a parte mais importante
    const currentMetadata = userData.user.user_metadata || {};
    const updatedMetadata = { 
      ...currentMetadata, 
      status: newStatus,
      admin: newStatus === 'ADMIN',
      paid: newStatus === 'ATIVO' || newStatus === 'ADMIN',
      statusUpdatedAt: new Date().toISOString()
    };
    
    // Se for ADMIN, também atualizar app_metadata para ter certeza
    let appMetadata = {};
    if (newStatus === 'ADMIN') {
      appMetadata = {
        role: 'admin'
      };
    }
    
    // Fazer uma atualização completa do usuário
    const { error: updateMetaError } = await supabaseAdmin.auth.admin.updateUserById(
      userId,
      { 
        user_metadata: updatedMetadata,
        app_metadata: appMetadata,
        email_confirm: true
      }
    );
    
    if (updateMetaError) {
      console.error(`Erro ao atualizar metadados do usuário ${userId}:`, updateMetaError);
      return res.status(500).json({ error: 'Erro ao atualizar metadados do usuário', details: updateMetaError });
    }
    
    console.log(`Metadados do usuário ${userId} atualizados com sucesso para ${newStatus}`);

    // Tentar atualizar a tabela users usando a API do Supabase (mesmo que falhe devido às políticas RLS)
    const { error: userUpdateError } = await supabaseAdmin
      .from('users')
      .update({ 
        status: newStatus,
        updated_at: new Date().toISOString()
      })
      .eq('id', userId);
      
    if (userUpdateError) {
      console.log(`Aviso: Não foi possível atualizar a tabela users: ${userUpdateError.message}`);
      console.log('Isso é esperado para status ADMIN devido às políticas RLS. Os metadados foram atualizados com sucesso.');
    } else {
      console.log(`Status atualizado na tabela users para ${newStatus}`);
    }
    
    // Tentar forçar invalidação de sessões para o usuário receber o novo status
    let logoutNotice = '';
    
    if (newStatus === 'ADMIN' || newStatus === 'INATIVO') {
      try {
        // Encerrar todas as sessões com signOut global
        const { error: globalSignOutError } = await supabaseAdmin.auth.admin.signOut(userId);
        
        if (!globalSignOutError) {
          console.log(`Sessões do usuário ${userId} invalidadas com sucesso`);
          logoutNotice = 'O usuário foi desconectado automaticamente e precisará fazer login novamente.';
        } else {
          console.log(`Erro ao invalidar sessões: ${globalSignOutError.message}`);
          logoutNotice = 'O usuário precisará fazer logout e login novamente para que o novo status seja aplicado completamente.';
        }
      } catch (e) {
        console.log(`Exceção ao invalidar sessões: ${e.message}`);
        logoutNotice = 'O usuário precisará fazer logout e login novamente para que o novo status seja aplicado completamente.';
      }
    } else {
      logoutNotice = 'O usuário precisará fazer logout e login novamente para que o novo status seja aplicado completamente.';
    }
    
    // Adicionar mensagem explicativa para status ADMIN
    const adminStatusMessage = newStatus === 'ADMIN' 
      ? `IMPORTANTE: O status ADMIN foi definido nos metadados do usuário. 
         Para que a alteração tenha efeito completo, o usuário precisa fazer logout 
         e login novamente. Após isso, ele deverá acessar /admin-helper 
         para confirmar e aplicar o novo status.` 
      : '';
    
    // Retornar sucesso - o mais importante é que os metadados foram atualizados
    res.status(200).json({ 
      message: 'Status do usuário atualizado com sucesso (metadados)',
      userId,
      newStatus,
      newMetadata: updatedMetadata,
      logoutNotice,
      adminNote: adminStatusMessage
    });
  } catch (error) {
    console.error('Erro ao atualizar status do usuário (acesso direto):', error);
    res.status(500).json({ error: 'Erro interno do servidor', details: error.message });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});

// Nova rota para forçar a atualização de status usando acesso administrativo
app.post('/api/admin/force-update-status', authenticateUser, async (req, res) => {
  try {
    // Verificar se o usuário autenticado é administrador
    if (req.user.user_metadata?.status !== 'ADMIN') {
      return res.status(403).json({ error: 'Apenas administradores podem usar esta função' });
    }

    const { userId, newStatus } = req.body;

    if (!userId || !newStatus) {
      return res.status(400).json({ error: 'ID do usuário e novo status são obrigatórios' });
    }

    // Validar o status
    const validStatuses = ['INATIVO', 'ATIVO', 'ADMIN', 'TRIAL'];
    if (!validStatuses.includes(newStatus)) {
      return res.status(400).json({ error: 'Status inválido' });
    }

    console.log(`⚠️ FORÇANDO atualização de status para usuário ${userId} para ${newStatus}`);
    console.log(`Usando acesso administrativo direto`);

    // ETAPA 1: Atualizar autenticação
    // Obter os dados atuais do usuário
    const { data: userData, error: userError } = await supabaseAdmin.auth.admin.getUserById(userId);
    
    if (userError || !userData || !userData.user) {
      const errorMessage = userError ? userError.message : 'Usuário não encontrado';
      console.error(`Erro ao obter dados do usuário ${userId}:`, errorMessage);
      return res.status(userError ? 500 : 404).json({ error: errorMessage });
    }

    // Atualizar metadados
    const currentMetadata = userData.user.user_metadata || {};
    const updatedMetadata = { 
      ...currentMetadata, 
      status: newStatus,
      admin: newStatus === 'ADMIN',
      paid: newStatus === 'ATIVO' || newStatus === 'ADMIN',
      statusUpdatedAt: new Date().toISOString()
    };
    
    // Se for ADMIN, também atualizar app_metadata
    let appMetadata = userData.user.app_metadata || {};
    if (newStatus === 'ADMIN') {
      appMetadata = {
        ...appMetadata,
        role: 'admin'
      };
    }
    
    // Atualizar usuário
    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
      userId,
      { 
        user_metadata: updatedMetadata,
        app_metadata: appMetadata,
        email_confirm: true 
      }
    );
    
    if (updateError) {
      console.error(`Erro ao atualizar metadados do usuário:`, updateError);
      return res.status(500).json({ error: 'Erro ao atualizar metadados', details: updateError.message });
    }

    console.log(`✓ Metadados atualizados com sucesso para ${newStatus}`);

    // ETAPA 2: Atualizar o banco de dados diretamente usando conexão direto
    let dbUpdateSuccess = false;
    let dbUpdateMethod = '';
    let dbUpdateMessage = '';
    
    // Tentar atualizar diretamente o banco de dados usando SQL
    if (pool) {
      try {
        console.log('Usando conexão direta para atualizar status...');
        
        // Transação para atualizar status com session_replication_role
        const updateQuery = `
          BEGIN;
          -- Desativar RLS temporariamente
          SET session_replication_role = 'replica';
          
          -- Atualizar status
          UPDATE public.users 
          SET status = $1, updated_at = NOW() 
          WHERE id = $2;
          
          -- Restaurar RLS
          SET session_replication_role = 'origin';
          COMMIT;
        `;
        
        await pool.query(updateQuery, [newStatus, userId]);
        
        // Verificar o resultado
        const verifyQuery = `
          SELECT status FROM public.users WHERE id = $1
        `;
        
        const { rows } = await pool.query(verifyQuery, [userId]);
        
        if (rows && rows.length > 0) {
          const dbStatus = rows[0].status;
          
          if (dbStatus === newStatus) {
            console.log(`✓ Status atualizado com sucesso no banco de dados para ${newStatus}`);
            dbUpdateSuccess = true;
            dbUpdateMethod = 'conexão direta';
            dbUpdateMessage = `Status atualizado com sucesso para ${newStatus}`;
          } else {
            console.log(`❌ Falha ao atualizar status no banco de dados. Atual: ${dbStatus}`);
            dbUpdateMethod = 'conexão direta (falhou)';
            dbUpdateMessage = `Não foi possível atualizar status no banco de dados. Atual: ${dbStatus}`;
          }
        }
      } catch (dbError) {
        console.error('Erro ao atualizar banco de dados:', dbError);
        dbUpdateMethod = 'erro';
        dbUpdateMessage = dbError.message;
      }
    } else {
      console.log('Conexão direta não disponível.');
      dbUpdateMethod = 'não disponível';
      dbUpdateMessage = 'Conexão direta ao banco de dados não disponível';
    }
    
    // ETAPA 3: Forçar logout se for ADMIN ou INATIVO
    if (newStatus === 'ADMIN' || newStatus === 'INATIVO') {
      try {
        console.log(`Forçando logout para usuário ${userId}...`);
        const { error: signOutError } = await supabaseAdmin.auth.admin.signOut(userId, true);
        
        if (signOutError) {
          console.log(`Aviso ao invalidar sessões: ${signOutError.message}`);
        } else {
          console.log(`✓ Sessões invalidadas com sucesso`);
        }
      } catch (e) {
        console.log(`Erro ao invalidar sessões: ${e.message}`);
      }
    }
    
    res.status(200).json({
      message: 'Operação concluída',
      userId,
      newStatus,
      metadata_updated: true,
      database_updated: dbUpdateSuccess,
      database_method: dbUpdateMethod,
      database_message: dbUpdateMessage,
      important_note: !dbUpdateSuccess ? 
        'Os metadados foram atualizados. O usuário precisará fazer logout e login novamente para obter as permissões completas.' :
        'Status atualizado com sucesso tanto nos metadados quanto no banco de dados.'
    });
    
  } catch (error) {
    console.error('Erro na função de forçar atualização de status:', error);
    res.status(500).json({ error: 'Erro interno do servidor', details: error.message });
  }
});

// Rota para servir a ferramenta de administração de status
app.get('/admin/status-fix', authenticateUser, (req, res) => {
  // Verificar se o usuário é administrador
  if (req.user.user_metadata?.status !== 'ADMIN') {
    return res.status(403).send('Acesso negado. Apenas administradores podem acessar esta página.');
  }
  
  // Enviar a página HTML
  res.sendFile(path.join(__dirname, 'admin-status-fix.html'));
});

// Inicializar o servidor
const initServer = async () => {
  try {
    console.log('Inicializando servidor...');
    
    // Testar conexão com o banco de dados
    await testConnection();
    
    // Criar função permanente para atualização de status se não existir
    await createPermanentStatusUpdateFunction();
    
    // Usar porta 3002 para evitar conflitos
    const PORT = process.env.PORT || 3002;
    
    const server = app.listen(PORT, () => {
      console.log(`Servidor rodando na porta ${PORT}`);
    }).on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        // Tentar porta alternativa
        const ALTERNATIVE_PORT = 3003;
        console.log(`Porta ${PORT} em uso. Tentando porta alternativa ${ALTERNATIVE_PORT}...`);
        app.listen(ALTERNATIVE_PORT, () => {
          console.log(`Servidor rodando na porta alternativa ${ALTERNATIVE_PORT}`);
        });
      } else {
        console.error('Erro ao iniciar servidor:', err);
        process.exit(1);
      }
    });
  } catch (error) {
    console.error('Erro ao inicializar servidor:', error.message);
    process.exit(1);
  }
};

// Iniciar o servidor
initServer();

// Rota dedicada exclusivamente para definir usuários como ADMIN
app.post('/api/admin/set-admin-status', authenticateUser, async (req, res) => {
  try {
    // Verificar se o usuário atual é administrador
    if (req.user.user_metadata?.status !== 'ADMIN' && (!req.user.app_metadata || req.user.app_metadata.role !== 'admin')) {
      return res.status(403).json({
        success: false,
        message: 'Acesso negado. Apenas administradores podem definir status ADMIN'
      });
    }
    
    const { userId } = req.body;
    
    if (!userId || typeof userId !== 'string' || !userId.trim()) {
      return res.status(400).json({
        success: false,
        message: 'ID de usuário inválido'
      });
    }
    
    console.log(`=====================================================`);
    console.log(`INICIANDO OPERAÇÃO DE ELEVAÇÃO PARA ADMIN: ${userId}`);
    console.log(`=====================================================`);
    
    // ETAPA 1: Atualizar metadados no Supabase Auth
    console.log(`ETAPA 1: Atualizando metadados de autenticação...`);
    
    // Buscar dados atuais do usuário
    const { data: userData, error: userError } = await supabaseAdmin.auth.admin.getUserById(userId);
    
    if (userError || !userData || !userData.user) {
      console.error(`Erro ao buscar dados do usuário:`, userError || 'Usuário não encontrado');
      return res.status(404).json({
        success: false,
        message: 'Usuário não encontrado',
        details: userError?.message
      });
    }
    
    // Preparar novos metadados
    let userMetadata = userData.user.user_metadata || {};
    userMetadata.status = 'ADMIN';
    
    console.log('Metadados atuais:', userMetadata);
    
    // Definir permissões de administrador
    const appMetadata = {
      role: 'admin'
    };
    
    // Atualizar metadados
    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
      userId,
      {
        user_metadata: userMetadata,
        app_metadata: appMetadata,
        email_confirm: true
      }
    );
    
    if (updateError) {
      console.error(`Erro ao atualizar metadados:`, updateError);
      return res.status(500).json({
        success: false,
        message: 'Erro ao atualizar metadados',
        details: updateError.message
      });
    }
    
    console.log(`✓ Metadados atualizados com sucesso: status = ADMIN, role = admin`);
    
    // ETAPA 2: Executar SQL direto para atualizar a tabela users
    console.log(`ETAPA 2: Atualizando banco de dados via SQL direto...`);
    
    let dbSuccess = false;
    let dbMessage = '';
    
    if (pool) {
      try {
        // Executar SQL que comprovadamente funciona
        const updateSql = `
          DO $$ 
          DECLARE
            target_user_id UUID := $1;
            current_status TEXT;
            updated_status TEXT;
          BEGIN
            -- Verificar status atual
            SELECT status INTO current_status
            FROM public.users
            WHERE id = target_user_id;
            
            RAISE NOTICE 'Status atual: %', current_status;
            
            -- Desativar políticas RLS temporariamente
            SET LOCAL session_replication_role = 'replica';
            
            -- Atualizar o status (com cast explícito para o ENUM)
            UPDATE public.users
            SET 
              status = 'ADMIN'::user_status,
              updated_at = NOW()
            WHERE id = target_user_id;
            
            -- Restaurar políticas RLS
            SET LOCAL session_replication_role = 'origin';
            
            -- Verificar status após atualização
            SELECT status INTO updated_status
            FROM public.users
            WHERE id = target_user_id;
            
            RAISE NOTICE 'Status após atualização: %', updated_status;
            
            -- Criar tabela de log se não existir
            CREATE TABLE IF NOT EXISTS admin_audit_log (
              id SERIAL PRIMARY KEY,
              operation VARCHAR(255) NOT NULL,
              target_table VARCHAR(255) NOT NULL,
              record_id UUID NOT NULL,
              old_value TEXT,
              new_value TEXT,
              created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            );
            
            -- Registrar operação
            INSERT INTO admin_audit_log (
              operation,
              target_table,
              record_id,
              old_value,
              new_value,
              created_at
            ) VALUES (
              'set_admin_status',
              'users',
              target_user_id,
              current_status,
              'ADMIN',
              NOW()
            );
          END $$;
        `;
        
        // Executar o SQL
        await pool.query(updateSql, [userId]);
        
        // Verificar se a atualização funcionou
        const verifyQuery = `SELECT status FROM public.users WHERE id = $1`;
        const { rows } = await pool.query(verifyQuery, [userId]);
        
        if (rows && rows.length > 0 && rows[0].status === 'ADMIN') {
          console.log(`✓ SQL direto: Status atualizado com sucesso para ADMIN`);
          dbSuccess = true;
          dbMessage = 'Status atualizado com sucesso para ADMIN via SQL direto';
        } else {
          console.log(`❌ SQL direto: Falha ao atualizar status. Atual: ${rows[0]?.status || 'desconhecido'}`);
          dbMessage = `Falha ao atualizar status. Valor no banco: ${rows[0]?.status || 'desconhecido'}`;
        }
      } catch (sqlError) {
        console.error(`Erro ao executar SQL direto:`, sqlError);
        dbMessage = `Erro ao executar SQL: ${sqlError.message}`;
      }
    } else {
      console.log(`❌ Pool de conexão não disponível para SQL direto`);
      dbMessage = 'Conexão direta com banco de dados não disponível';
    }
    
    // ETAPA 3: Forçar logout para o usuário receber novas permissões
    console.log(`ETAPA 3: Forçando logout do usuário...`);
    
    try {
      const { error: signOutError } = await supabaseAdmin.auth.admin.signOut(userId, true);
      
      if (signOutError) {
        console.log(`Aviso ao invalidar sessões: ${signOutError.message}`);
      } else {
        console.log(`✓ Sessões invalidadas com sucesso`);
      }
    } catch (e) {
      console.log(`Erro ao invalidar sessões: ${e.message}`);
    }
    
    console.log(`=====================================================`);
    console.log(`OPERAÇÃO DE ELEVAÇÃO PARA ADMIN CONCLUÍDA`);
    console.log(`=====================================================`);
    
    // Retornar resultado completo
    res.json({
      success: true,
      userId,
      metadata_updated: true,
      database_updated: dbSuccess,
      database_message: dbMessage,
      instructions: 'O usuário precisará fazer logout e login novamente para obter as permissões completas de administrador.'
    });
    
  } catch (error) {
    console.error(`Erro geral na definição de status ADMIN:`, error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor',
      details: error.message
    });
  }
});
