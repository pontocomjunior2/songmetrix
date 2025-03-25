// Load environment variables first
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import path from 'path';
import fs from 'fs';
import { createProxyMiddleware } from 'http-proxy-middleware';

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
import pg from 'pg';
import { format } from 'date-fns';
import { authenticateBasicUser, authenticateUser } from './auth-middleware.js';
import { createClient } from '@supabase/supabase-js';
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
  origin: function(origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if(!origin) return callback(null, true);
    
    // Allow localhost and production URL
    const allowedOrigins = ['http://localhost:5173', 'http://localhost:3000', 'https://songmetrix.com.br'];
    if(allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'X-Requested-With'],
  exposedHeaders: ['Content-Range', 'X-Content-Range', 'Content-Type', 'Content-Disposition']
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

// Configurar middleware para servir arquivos estáticos
app.use(express.static(path.join(__dirname, 'public')));
console.log('Diretório de arquivos estáticos:', path.join(__dirname, 'public'));

// Verificar se o diretório de uploads existe
const uploadsDir = path.join(__dirname, 'public', 'uploads', 'logos');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
  console.log('Diretório de uploads criado:', uploadsDir);
} else {
  console.log('Diretório de uploads existente:', uploadsDir);
  // Listar arquivos no diretório de uploads
  try {
    const files = fs.readdirSync(uploadsDir);
    console.log('Arquivos no diretório de uploads:', files);
  } catch (error) {
    console.error('Erro ao listar arquivos no diretório de uploads:', error);
  }
}

// Registrar as rotas
registerRoutes(app);

// Proxy para redirecionar requisições de email para o servidor de email
// Em desenvolvimento, a aplicação client aponta diretamente para o servidor de email
// Em produção, as requisições passam por este proxy
if (process.env.NODE_ENV === 'production') {
  const emailServerUrl = process.env.EMAIL_SERVER_URL || 'http://localhost:3002';
  
  console.log(`Configurando proxy para servidor de email: ${emailServerUrl}`);
  
  app.use('/api/email', createProxyMiddleware({
    target: emailServerUrl,
    changeOrigin: true,
    pathRewrite: {
      '^/api/email': '/api/email'
    },
    onProxyReq: (proxyReq, req, res) => {
      console.log(`Proxy email request to: ${emailServerUrl}${proxyReq.path}`);
    },
    onError: (err, req, res) => {
      console.error('Proxy email error:', err);
      res.writeHead(500, {
        'Content-Type': 'application/json'
      });
      res.end(JSON.stringify({
        error: 'Proxy email error',
        message: err.message
      }));
    }
  }));
}

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

    // Query para buscar todas as rádios e sua última execução
    // A consulta busca a entrada mais recente para cada rádio
    const query = `
      WITH latest_entries AS (
        SELECT 
          name,
          MAX(date + time::time) as last_update
        FROM music_log
        GROUP BY name
      ),
      all_radios AS (
        SELECT name, created_at, updated_at FROM streams ORDER BY name
      )
      SELECT 
        r.name,
        l.last_update,
        r.created_at,
        r.updated_at
      FROM all_radios r
      LEFT JOIN latest_entries l ON r.name = l.name
      ORDER BY r.name;
    `;

    try {
      console.log('Executando consulta para buscar rádios...');
      const result = await safeQuery(query);
      console.log(`Encontradas ${result.rows.length} rádios no banco de dados`);
      
      // Verificar dados recentes para determinar quais rádios estão online
      // Uma consulta adicional para verificar quais rádios tiveram execuções nos últimos 10 minutos
      const recentActivityQuery = `
        SELECT DISTINCT name
        FROM music_log
        WHERE (date + time::time) > NOW() - INTERVAL '10 minutes'
      `;
      
      const recentActivity = await safeQuery(recentActivityQuery);
      console.log(`Rádios com atividade recente: ${recentActivity.rows.length}`);
      
      // Criar um Set com os nomes das rádios com atividade nos últimos 10 minutos
      const onlineRadiosSet = new Set(recentActivity.rows.map(row => row.name));
      
      if (!result.rows || result.rows.length === 0) {
        // Fallback: Buscar todas as rádios da tabela streams
        try {
          const streamsResult = await safeQuery("SELECT name, created_at, updated_at FROM streams ORDER BY name");
          const radiosStatus = streamsResult.rows.map(row => ({
            name: row.name,
            status: onlineRadiosSet.has(row.name) ? 'ONLINE' : 'OFFLINE',
            lastUpdate: row.updated_at || row.created_at,
            isFavorite: favoriteRadios.includes(row.name)
          }));
          
          console.log(`Retornando ${radiosStatus.length} rádios (fallback)`);
          return res.json(radiosStatus);
        } catch (streamsError) {
          console.error('Erro ao buscar streams:', streamsError);
          // Último fallback - retornar apenas favoritas como offline
          const offlineRadios = favoriteRadios.map(name => ({
            name,
            status: 'OFFLINE',
            lastUpdate: null,
            isFavorite: true
          }));
          
          console.log(`Retornando apenas ${offlineRadios.length} rádios favoritas como fallback final`);
          return res.json(offlineRadios);
        }
      }
      
      // Processar os resultados normais da consulta principal
      const radiosStatus = result.rows.map(row => {
        // Uma rádio está online se estiver no set de rádios com atividade recente
        const isOnline = onlineRadiosSet.has(row.name);
        
        return {
          name: row.name,
          status: isOnline ? 'ONLINE' : 'OFFLINE',
          lastUpdate: row.last_update || row.updated_at || row.created_at,
          isFavorite: favoriteRadios.includes(row.name)
        };
      });

      console.log(`Retornando ${radiosStatus.length} rádios ao cliente, ${radiosStatus.filter(r => r.status === 'ONLINE').length} online`);
      res.json(radiosStatus);
    } catch (dbError) {
      console.error('Erro ao consultar banco de dados:', dbError);
      // Fallback se houver erro na consulta principal
      try {
        const streamsResult = await safeQuery("SELECT name, created_at, updated_at FROM streams ORDER BY name");
        console.log(`Fallback: ${streamsResult.rows.length} rádios encontradas na tabela streams`);
        
        // Tentar buscar atividade recente em uma consulta separada
        let onlineRadios = new Set();
        try {
          const recentActivity = await safeQuery(
            "SELECT DISTINCT name FROM music_log WHERE (date + time::time) > NOW() - INTERVAL '10 minutes'"
          );
          onlineRadios = new Set(recentActivity.rows.map(row => row.name));
          console.log(`Rádios com atividade recente (fallback): ${onlineRadios.size}`);
        } catch (e) {
          console.error('Erro ao buscar atividade recente (fallback):', e);
        }
        
        const radiosStatus = streamsResult.rows.map(row => ({
          name: row.name,
          status: onlineRadios.has(row.name) ? 'ONLINE' : 'OFFLINE',
          lastUpdate: row.updated_at || row.created_at,
          isFavorite: favoriteRadios.includes(row.name)
        }));
        
        console.log(`Retornando ${radiosStatus.length} rádios (fallback stream)`);
        return res.json(radiosStatus);
      } catch (streamsError) {
        console.error('Erro ao buscar streams como fallback:', streamsError);
        // Último fallback - retornar apenas favoritas
        const offlineRadios = favoriteRadios.map(name => ({
          name,
          status: 'OFFLINE',
          lastUpdate: null,
          isFavorite: true
        }));
        
        console.log(`Retornando apenas ${offlineRadios.length} rádios favoritas como fallback final`);
        return res.json(offlineRadios);
      }
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
      const isOnline = timeDiff <= 10 * 60 * 1000; // 10 minutos

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
    
    // Verificar se deve incluir todas as rádios (quando favoriteRadios está vazio ou quando includeAll=true)
    const includeAll = req.query.includeAll === 'true' || favoriteRadios.length === 0;
    
    // Se não há rádios favoritas e não é para incluir todas, buscar todas as rádios do banco
    let allRadios = [];
    if (includeAll) {
      try {
        const radiosResult = await pool.query('SELECT name FROM streams ORDER BY name ASC');
        allRadios = radiosResult.rows.map(r => r.name);
        console.log('GET /api/dashboard - Incluindo todas as rádios:', allRadios.length);
      } catch (err) {
        console.error('Erro ao buscar todas as rádios:', err);
      }
    }

    // Pegar rádios da query string
    const radios = req.query.radio;
    let selectedRadios = Array.isArray(radios) ? radios : radios ? [radios] : [];
    
    // Se deve incluir todas as rádios e não há seleção específica, usar todas as rádios disponíveis
    if (includeAll && selectedRadios.length === 0) {
      selectedRadios = allRadios;
    }

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

    // Apenas verificar se as rádios selecionadas são favoritas quando não estamos incluindo todas
    if (!includeAll) {
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
    }

    console.log('GET /api/dashboard - Rádios selecionadas:', selectedRadios.length > 10 ? `${selectedRadios.length} rádios` : selectedRadios);
    
    // Limitar o número de rádios para evitar consultas muito pesadas
    const MAX_RADIOS = 100;
    if (selectedRadios.length > MAX_RADIOS) {
      console.log(`Limitando quantidade de rádios de ${selectedRadios.length} para ${MAX_RADIOS}`);
      selectedRadios = selectedRadios.slice(0, MAX_RADIOS);
    }
    
    // Obter limites de consulta da query string
    const limitSongs = parseInt(req.query.limit_songs) || 10;
    const limitArtists = parseInt(req.query.limit_artists) || 10;
    const limitGenres = parseInt(req.query.limit_genres) || 5;
    
    const query = `
      WITH adjusted_dates AS (
        SELECT 
          artist,
          song_title,
          genre,
          name,
          (date + INTERVAL '3 hours')::date as adjusted_date
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
        LIMIT $4
      ),
      genre_counts AS (
        SELECT 
          genre,
          COUNT(*) as count
        FROM adjusted_dates
        WHERE genre IS NOT NULL
        GROUP BY genre
        ORDER BY count DESC
        LIMIT $5
      ),
      song_counts AS (
        SELECT 
          song_title,
          artist,
          COUNT(*) as executions
        FROM adjusted_dates
        GROUP BY song_title, artist
        ORDER BY executions DESC
        LIMIT $6
      ),
      radio_status AS (
        SELECT DISTINCT
          name,
          true as is_online
        FROM adjusted_dates
        WHERE adjusted_date = $2
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
      selectedRadios,
      limitArtists,
      limitGenres,
      limitSongs
    ];

    console.log('GET /api/dashboard - Executando consulta com limites:', { 
      limitSongs, 
      limitArtists, 
      limitGenres, 
      totalRadios: selectedRadios.length 
    });

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

    // Log do tamanho dos dados retornados
    console.log('GET /api/dashboard - Resultados:', { 
      totalSongs: dashboardData.topSongs?.length || 0,
      totalArtists: dashboardData.artistData?.length || 0,
      totalGenres: dashboardData.genreData?.length || 0,
      totalRadiosStatus: dashboardData.activeRadios?.length || 0
    });

    res.json({
      totalExecutions,
      uniqueArtists,
      uniqueSongs,
      activeRadios: dashboardData.activeRadios || [],
      topSongs: dashboardData.topSongs || [],
      artistData: dashboardData.artistData || [],
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
    // Verificar se o usuário é administrador
    if (req.user.user_metadata?.status !== 'ADMIN') {
      console.log('Tentativa não autorizada de atualizar status:', req.user.id);
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

    console.log(`Atualizando status do usuário ${userId} para ${newStatus}`);

    // Obter os metadados do usuário
    const { data: userData, error: userError } = await supabaseAdmin.auth.admin.getUserById(userId);
    
    if (userError) {
      console.error(`Erro ao obter metadados do usuário ${userId}:`, userError);
      return res.status(500).json({ error: 'Erro ao obter metadados do usuário', details: userError });
    }

    // Verificar se o usuário existe
    if (!userData || !userData.user) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }

    // Registrar metadados atuais
    console.log(`Metadados atuais do usuário ${userId}:`, userData.user.user_metadata);
    const currentStatus = userData.user.user_metadata?.status || 'INATIVO';
    console.log(`Status atual nos metadados: ${currentStatus}, Novo status: ${newStatus}`);

    // Atualizar na tabela users
    const { error: updateDbError } = await supabaseAdmin
      .from('users')
      .update({
        status: newStatus,
        updated_at: new Date().toISOString()
      })
      .eq('id', userId);
      
    if (updateDbError) {
      console.error(`Erro ao atualizar status do usuário ${userId} no banco:`, updateDbError);
      return res.status(500).json({ error: 'Erro ao atualizar status no banco de dados', details: updateDbError });
    }

    console.log(`Status do usuário ${userId} atualizado no banco de dados para ${newStatus}`);

    // Certificar-se de que os metadados incluem o status
    // Criamos um novo objeto com todos os metadados existentes + o novo status
    const currentMetadata = userData.user.user_metadata || {};
    const updatedMetadata = { ...currentMetadata, status: newStatus };
    console.log(`Novos metadados para o usuário ${userId}:`, updatedMetadata);

    // Utilizar a API direta do Supabase para atualização completa dos metadados
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
      if (updatedStatus !== newStatus) {
        console.error(`ATENÇÃO: Status do usuário ${userId} nos metadados não foi atualizado corretamente. Esperado: ${newStatus}, Atual: ${updatedStatus}`);
        
        // Tentar abordagem alternativa: atualizar apenas o campo status diretamente
        try {
          console.log(`Tentando atualização direta do status nos metadados do usuário ${userId}`);
          
          // Abordagem direta para atualizar apenas o campo status usando rawUpdate
          const updateResponse = await supabaseAdmin.auth.admin.updateUserById(
            userId,
            { 
              user_metadata: { status: newStatus } 
            },
            { rawUpdate: true }
          );
          
          if (updateResponse.error) {
            console.error(`Segunda tentativa de atualizar status nos metadados falhou:`, updateResponse.error);
          } else {
            console.log(`Segunda tentativa de atualização de status nos metadados concluída`);
            
            // Verificar novamente
            const { data: verifyRetryData, error: verifyRetryError } = await supabaseAdmin.auth.admin.getUserById(userId);
            if (verifyRetryError) {
              console.error(`Erro ao verificar após segunda tentativa:`, verifyRetryError);
            } else if (verifyRetryData.user.user_metadata?.status !== newStatus) {
              console.error(`ATENÇÃO CRÍTICA: Mesmo após segunda tentativa, o status nos metadados continua incorreto. Atual: ${verifyRetryData.user.user_metadata?.status}`);
            } else {
              console.log(`Status nos metadados atualizado com sucesso na segunda tentativa para: ${verifyRetryData.user.user_metadata?.status}`);
            }
          }
        } catch (retryError) {
          console.error(`Erro na tentativa alternativa de atualizar metadados:`, retryError);
        }
      } else {
        console.log(`Status nos metadados atualizado com sucesso para: ${updatedStatus}`);
      }
    }

    // Tentar forçar invalidação de sessões (para garantir que o novo status seja aplicado)
    try {
      if (newStatus === 'INATIVO') {
        // Para status INATIVO, forçamos o logout
        const { error: signOutError } = await supabaseAdmin.auth.admin.signOut(userId);
        if (signOutError) {
          console.error(`Erro ao invalidar sessões do usuário ${userId}:`, signOutError);
        } else {
          console.log(`Sessões do usuário ${userId} invalidadas com sucesso`);
        }
      } else {
        // Para outros status, o usuário precisará fazer logout e login novamente
        console.log(`O usuário ${userId} precisará fazer logout e login novamente para que o novo status (${newStatus}) seja aplicado completamente.`);
      }
    } catch (error) {
      console.error(`Erro ao processar sessões do usuário ${userId}:`, error);
    }

    // Adicionar à fila de sincronização para garantir
    try {
      const { error: queueError } = await supabaseAdmin
        .from('auth_sync_queue')
        .insert({
          user_id: userId,
          status: newStatus,
          processed: false,
          created_at: new Date().toISOString()
        })
        .select();
        
      if (queueError) {
        console.error(`Erro ao adicionar usuário ${userId} à fila de sincronização:`, queueError);
      } else {
        console.log(`Usuário ${userId} adicionado à fila de sincronização`);
      }
    } catch (error) {
      console.error(`Erro ao adicionar usuário ${userId} à fila de sincronização:`, error);
    }

    console.log(`Status do usuário ${userId} atualizado com sucesso para ${newStatus}`);

    res.status(200).json({ 
      message: 'Status do usuário atualizado com sucesso',
      userId,
      newStatus,
      oldStatus: currentStatus,
      oldMetadata: userData.user.user_metadata,
      newMetadata: updatedMetadata
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

    // Remover o usuário do Auth primeiro
    const { error: deleteAuthError } = await supabaseAdmin.auth.admin.deleteUser(userId);
    
    if (deleteAuthError) {
      console.error(`Erro ao remover usuário ${userId} do Auth:`, deleteAuthError);
      return res.status(500).json({ 
        error: 'Erro ao remover usuário do Auth', 
        details: deleteAuthError
      });
    }

    // Depois remover da tabela users - isso deve acontecer automaticamente via CASCADE,
    // mas vamos garantir que os registros sejam removidos
    const { error: deleteDbError } = await supabaseAdmin
      .from('users')
      .delete()
      .eq('id', userId);
      
    if (deleteDbError) {
      console.error(`Erro ao remover usuário ${userId} do banco:`, deleteDbError);
      console.log('Este erro pode ser ignorado se o CASCADE do Auth já removeu o registro');
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

// Rota para sincronizar manualmente usuários com o Brevo
app.post('/api/brevo/sync-users', authenticateUser, async (req, res) => {
  try {
    // Verificar se o usuário é administrador
    if (req.user.user_metadata?.status !== 'ADMIN') {
      console.log('Tentativa não autorizada de sincronizar com Brevo:', req.user.id);
      return res.status(403).json({ error: 'Apenas administradores podem usar esta função' });
    }

    console.log('Iniciando sincronização manual com Brevo');
    
    // Buscar todos os usuários
    const { data: users, error: fetchError } = await supabaseAdmin
      .from('users')
      .select('id, email, status, full_name, whatsapp, created_at')
      .order('created_at', { ascending: false });
    
    if (fetchError) {
      console.error('Erro ao buscar usuários para sincronização:', fetchError);
      return res.status(500).json({ error: 'Erro ao buscar usuários', details: fetchError });
    }
    
    console.log(`Sincronizando ${users.length} usuários com o Brevo`);
    
    // IDs das listas no Brevo
    const statusListIds = {
      TRIAL: '7',    // Lista para usuários Trial
      ATIVO: '8',    // Lista para usuários Ativos
      INATIVO: '9',  // Lista para usuários Inativos
      ADMIN: '8'     // Admin vai na mesma lista dos Ativos
    };
    
    // Obter a chave de API do Brevo
    const brevoApiKey = process.env.BREVO_API_KEY;
    if (!brevoApiKey) {
      return res.status(500).json({ error: 'API Key do Brevo não configurada' });
    }
    
    // Processar usuários em batches para evitar timeouts
    const batchSize = 10;
    const results = {
      success: 0,
      failed: 0,
      details: []
    };
    
    // Função para processar um usuário
    async function processUser(user) {
      try {
        // Preparar atributos do contato
        const attributes = {};
        
        if (user.full_name) {
          // Dividir nome completo em primeiro nome e sobrenome
          const nameParts = user.full_name.split(' ');
          attributes.FNAME = nameParts[0] || '';
          attributes.LNAME = nameParts.slice(1).join(' ') || '';
          attributes.NOME = user.full_name;
        }
        
        if (user.whatsapp) {
          // Remover caracteres não numéricos e adicionar prefixo se necessário
          let whatsapp = user.whatsapp.replace(/\\D/g, '');
          if (!whatsapp.startsWith('+')) {
            // Se não começar com +, adicionar código do Brasil
            if (!whatsapp.startsWith('55')) {
              whatsapp = '55' + whatsapp;
            }
          }
          attributes.SMS = whatsapp;
          attributes.WHATSAPP = whatsapp;
        }
        
        if (user.status) {
          attributes.STATUS = user.status;
        }
        
        if (user.created_at) {
          attributes.DATA_CADASTRO = new Date(user.created_at).toISOString().split('T')[0];
        }
        
        // Determinar a lista apropriada pelo status do usuário
        const targetListId = statusListIds[user.status];
        
        // Verificar se contato já existe
        let contactExists = false;
        
        try {
          const getContactResponse = await fetch(`https://api.brevo.com/v3/contacts/${encodeURIComponent(user.email)}`, {
            method: 'GET',
            headers: {
              'api-key': brevoApiKey
            }
          });
          
          contactExists = getContactResponse.ok;
          
          if (contactExists) {
            // Atualizar contato existente
            // 1. Atualizar atributos
            await fetch(`https://api.brevo.com/v3/contacts/${encodeURIComponent(user.email)}`, {
              method: 'PUT',
              headers: {
                'Content-Type': 'application/json',
                'api-key': brevoApiKey
              },
              body: JSON.stringify({ attributes })
            });
            
            // 2. Remover de todas as listas exceto a correta
            for (const [status, listId] of Object.entries(statusListIds)) {
              if (listId !== targetListId) {
                await fetch(`https://api.brevo.com/v3/contacts/lists/${listId}/contacts/remove`, {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    'api-key': brevoApiKey
                  },
                  body: JSON.stringify({
                    emails: [user.email]
                  })
                });
              }
            }
            
            // 3. Adicionar à lista correta
            if (targetListId) {
              await fetch(`https://api.brevo.com/v3/contacts/lists/${targetListId}/contacts/add`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'api-key': brevoApiKey
                },
                body: JSON.stringify({
                  emails: [user.email]
                })
              });
            }
            
            return { success: true, action: 'update', email: user.email };
          } else {
            // Criar novo contato
            const brevoContact = {
              email: user.email,
              attributes,
              listIds: targetListId ? [parseInt(targetListId)] : [],
              updateEnabled: true
            };
            
            const createResponse = await fetch('https://api.brevo.com/v3/contacts', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'api-key': brevoApiKey
              },
              body: JSON.stringify(brevoContact)
            });
            
            if (createResponse.ok) {
              return { success: true, action: 'create', email: user.email };
            } else {
              // Verificar se é por contato duplicado
              const createError = await createResponse.json();
              
              if (createResponse.status === 400 && createError.code === 'duplicate_parameter') {
                // Tentar novamente como atualização
                await fetch(`https://api.brevo.com/v3/contacts/${encodeURIComponent(user.email)}`, {
                  method: 'PUT',
                  headers: {
                    'Content-Type': 'application/json',
                    'api-key': brevoApiKey
                  },
                  body: JSON.stringify({ attributes })
                });
                
                // Adicionar à lista correta
                if (targetListId) {
                  await fetch(`https://api.brevo.com/v3/contacts/lists/${targetListId}/contacts/add`, {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json',
                      'api-key': brevoApiKey
                    },
                    body: JSON.stringify({
                      emails: [user.email]
                    })
                  });
                }
                
                return { success: true, action: 'update-after-failed-create', email: user.email };
              } else {
                throw new Error(`Falha na criação: ${JSON.stringify(createError)}`);
              }
            }
          }
        } catch (error) {
          console.error(`Erro ao processar usuário ${user.email}:`, error);
          return { success: false, error: error.message, email: user.email };
        }
      } catch (error) {
        console.error(`Erro geral no processamento de ${user.email}:`, error);
        return { success: false, error: error.message, email: user.email };
      }
    }
    
    // Enviar status inicial
    res.writeHead(200, {
      'Content-Type': 'application/json',
      'Transfer-Encoding': 'chunked'
    });
    
    // Processar todos os usuários em batches
    let processed = 0;
    
    for (let i = 0; i < users.length; i += batchSize) {
      const batch = users.slice(i, i + batchSize);
      const batchResults = await Promise.all(batch.map(processUser));
      
      // Atualizar resultados
      batchResults.forEach(result => {
        if (result.success) {
          results.success++;
        } else {
          results.failed++;
        }
        results.details.push(result);
      });
      
      processed += batch.length;
      
      // Enviar atualização de progresso
      const progressUpdate = {
        progress: {
          total: users.length,
          processed,
          success: results.success,
          failed: results.failed,
          percentage: Math.round((processed / users.length) * 100)
        }
      };
      
      res.write(`${JSON.stringify(progressUpdate)}\n`);
    }
    
    // Enviar resultado final
    const finalResult = {
      final: true,
      message: 'Sincronização concluída',
      total: users.length,
      success: results.success,
      failed: results.failed,
      details: results.details
    };
    
    res.write(`${JSON.stringify(finalResult)}\n`);
    res.end();
  } catch (error) {
    console.error('Erro na sincronização com Brevo:', error);
    
    // Se já enviamos cabeçalhos, enviar erro como chunk
    if (res.headersSent) {
      res.write(JSON.stringify({
        error: true,
        message: error.message
      }));
      res.end();
    } else {
      res.status(500).json({ error: 'Erro na sincronização com Brevo', details: error.message });
    }
  }
});

// Endpoint para sincronização manual com o Brevo (adicionar antes de app.listen)
// Endpoint removido para evitar duplicação

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});

// Atualizar último acesso dos usuários
app.post('/api/users/update-last-sign-in', authenticateUser, async (req, res) => {
  try {
    // Verificar se o usuário é administrador
    const { data: userData, error: userError } = await supabaseAdmin
      .from('users')
      .select('status')
      .eq('id', req.user.id)
      .single();

    if (userError || userData?.status !== 'ADMIN') {
      return res.status(403).json({ error: 'Acesso negado. Apenas administradores podem executar esta ação.' });
    }

    // Atualizar o campo last_sign_in_at para todos os usuários que não têm esse campo preenchido
    const { data, error: updateError } = await supabaseAdmin
      .rpc('update_users_last_sign_in');

    if (updateError) {
      console.error('Erro ao atualizar last_sign_in_at:', updateError);
      return res.status(500).json({ error: `Erro ao atualizar dados: ${updateError.message}` });
    }

    // Contar quantos registros foram atualizados
    const count = data && data.updated_count ? data.updated_count : 0;

    return res.status(200).json({ 
      success: true, 
      message: 'Dados de último acesso atualizados com sucesso',
      count: count 
    });
  } catch (error) {
    console.error('Erro ao processar requisição de atualização de último acesso:', error);
    return res.status(500).json({ error: `Erro interno do servidor: ${error.message}` });
  }
});

// Atualizar status do usuário com API dedicada
app.post('/api/users/update-status', authenticateUser, async (req, res) => {
  try {
    // Verificar se o usuário é administrador
    if (req.user.user_metadata?.status !== 'ADMIN') {
      console.log('Tentativa não autorizada de atualizar status:', req.user.id);
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

    console.log(`Atualizando status do usuário ${userId} para ${newStatus}`);

    // Obter os metadados do usuário
    const { data: userData, error: userError } = await supabaseAdmin.auth.admin.getUserById(userId);
    
    if (userError) {
      console.error(`Erro ao obter metadados do usuário ${userId}:`, userError);
      return res.status(500).json({ error: 'Erro ao obter metadados do usuário', details: userError });
    }

    // Verificar se o usuário existe
    if (!userData || !userData.user) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }

    // Registrar metadados atuais
    console.log(`Metadados atuais do usuário ${userId}:`, userData.user.user_metadata);
    const currentStatus = userData.user.user_metadata?.status || 'INATIVO';
    console.log(`Status atual nos metadados: ${currentStatus}, Novo status: ${newStatus}`);

    // Atualizar na tabela users
    const { error: updateDbError } = await supabaseAdmin
      .from('users')
      .update({
        status: newStatus,
        updated_at: new Date().toISOString()
      })
      .eq('id', userId);
      
    if (updateDbError) {
      console.error(`Erro ao atualizar status do usuário ${userId} no banco:`, updateDbError);
      return res.status(500).json({ error: 'Erro ao atualizar status no banco de dados', details: updateDbError });
    }

    console.log(`Status do usuário ${userId} atualizado no banco de dados para ${newStatus}`);

    // Certificar-se de que os metadados incluem o status
    // Criamos um novo objeto com todos os metadados existentes + o novo status
    const currentMetadata = userData.user.user_metadata || {};
    const updatedMetadata = { ...currentMetadata, status: newStatus };
    console.log(`Novos metadados para o usuário ${userId}:`, updatedMetadata);

    // Utilizar a API direta do Supabase para atualização completa dos metadados
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
      if (updatedStatus !== newStatus) {
        console.error(`ATENÇÃO: Status do usuário ${userId} nos metadados não foi atualizado corretamente. Esperado: ${newStatus}, Atual: ${updatedStatus}`);
        
        // Tentar abordagem alternativa: atualizar apenas o campo status diretamente
        try {
          console.log(`Tentando atualização direta do status nos metadados do usuário ${userId}`);
          
          // Abordagem direta para atualizar apenas o campo status usando rawUpdate
          const updateResponse = await supabaseAdmin.auth.admin.updateUserById(
            userId,
            { 
              user_metadata: { status: newStatus } 
            },
            { rawUpdate: true }
          );
          
          if (updateResponse.error) {
            console.error(`Segunda tentativa de atualizar status nos metadados falhou:`, updateResponse.error);
          } else {
            console.log(`Segunda tentativa de atualização de status nos metadados concluída`);
            
            // Verificar novamente
            const { data: verifyRetryData, error: verifyRetryError } = await supabaseAdmin.auth.admin.getUserById(userId);
            if (verifyRetryError) {
              console.error(`Erro ao verificar após segunda tentativa:`, verifyRetryError);
            } else if (verifyRetryData.user.user_metadata?.status !== newStatus) {
              console.error(`ATENÇÃO CRÍTICA: Mesmo após segunda tentativa, o status nos metadados continua incorreto. Atual: ${verifyRetryData.user.user_metadata?.status}`);
            } else {
              console.log(`Status nos metadados atualizado com sucesso na segunda tentativa para: ${verifyRetryData.user.user_metadata?.status}`);
            }
          }
        } catch (retryError) {
          console.error(`Erro na tentativa alternativa de atualizar metadados:`, retryError);
        }
      } else {
        console.log(`Status nos metadados atualizado com sucesso para: ${updatedStatus}`);
      }
    }

    // Tentar forçar invalidação de sessões (para garantir que o novo status seja aplicado)
    try {
      if (newStatus === 'INATIVO') {
        // Para status INATIVO, forçamos o logout
        const { error: signOutError } = await supabaseAdmin.auth.admin.signOut(userId);
        if (signOutError) {
          console.error(`Erro ao invalidar sessões do usuário ${userId}:`, signOutError);
        } else {
          console.log(`Sessões do usuário ${userId} invalidadas com sucesso`);
        }
      } else {
        // Para outros status, o usuário precisará fazer logout e login novamente
        console.log(`O usuário ${userId} precisará fazer logout e login novamente para que o novo status (${newStatus}) seja aplicado completamente.`);
      }
    } catch (error) {
      console.error(`Erro ao processar sessões do usuário ${userId}:`, error);
    }

    // Adicionar à fila de sincronização para garantir
    try {
      const { error: queueError } = await supabaseAdmin
        .from('auth_sync_queue')
        .insert({
          user_id: userId,
          status: newStatus,
          processed: false,
          created_at: new Date().toISOString()
        })
        .select();
        
      if (queueError) {
        console.error(`Erro ao adicionar usuário ${userId} à fila de sincronização:`, queueError);
      } else {
        console.log(`Usuário ${userId} adicionado à fila de sincronização`);
      }
    } catch (error) {
      console.error(`Erro ao adicionar usuário ${userId} à fila de sincronização:`, error);
    }

    console.log(`Status do usuário ${userId} atualizado com sucesso para ${newStatus}`);

    res.status(200).json({ 
      message: 'Status do usuário atualizado com sucesso',
      userId,
      newStatus,
      oldStatus: currentStatus,
      oldMetadata: userData.user.user_metadata,
      newMetadata: updatedMetadata
    });
  } catch (error) {
    console.error('Erro ao atualizar status do usuário:', error);
    res.status(500).json({ error: 'Erro interno do servidor', details: error.message });
  }
});

