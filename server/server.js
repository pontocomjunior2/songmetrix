import express from 'express';
import cors from 'cors';
import pg from 'pg';
import dotenv from 'dotenv';
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
    const userRef = db.collection('users').doc(decodedToken.uid);
    const userDoc = await userRef.get();
    
    if (!userDoc.exists) {
      // Se o usuário não existe no Firestore, criar um novo documento
      await createUser(decodedToken.uid, decodedToken.email);
      const newUserDoc = await userRef.get();
      req.user = { ...decodedToken, ...newUserDoc.data() };
    } else {
      // Verificar e atualizar claims se necessário
      await verifyAndUpdateClaims(decodedToken.uid);
      const userData = userDoc.data();
      req.user = { ...decodedToken, ...userData };
    }

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
    const decodedToken = await auth.verifyIdToken(token);
    
    // Buscar dados do usuário no Firestore
    const userRef = db.collection('users').doc(decodedToken.uid);
    const userDoc = await userRef.get();
    
    if (!userDoc.exists) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }

    const userData = userDoc.data();
    
    // Verifica se o usuário tem acesso pago ou é admin
    if (userData.status !== 'ATIVO' && userData.status !== 'ADMIN') {
      return res.status(403).json({ 
        error: 'Assinatura necessária',
        code: 'subscription_required'
      });
    }

    req.user = { ...decodedToken, ...userData };
    next();
  } catch (error) {
    console.error('Erro de autenticação:', error);
    res.status(401).json({ error: 'Token inválido' });
  }
};

const { Pool } = pg;

let pool;

try {
  pool = new Pool({
    user: process.env.POSTGRES_USER,
    host: process.env.POSTGRES_HOST,
    database: process.env.POSTGRES_DB,
    password: process.env.POSTGRES_PASSWORD,
    port: parseInt(process.env.POSTGRES_PORT),
    ssl: {
      rejectUnauthorized: false
    }
  });

  // Test the connection
  pool.connect((err, client, done) => {
    if (err) {
      console.error('Erro ao conectar ao banco de dados:', err);
    } else {
      console.log('Conexão com o banco de dados estabelecida com sucesso');
      done();
    }
  });
} catch (error) {
  console.error('Erro ao criar pool de conexões:', error);
}

// Helper function to safely execute database queries
const safeQuery = async (query, params = []) => {
  if (!pool) {
    console.error('Pool de conexões não disponível');
    return { rows: [] };
  }

  try {
    return await pool.query(query, params);
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
    // Buscar rádios favoritas do usuário primeiro
    const userRef = db.collection('users').doc(req.user.uid);
    const userDoc = await userRef.get();
    const userData = userDoc.data();
    const favoriteRadios = userData?.favoriteRadios || [];

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

    try {
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

    const userRef = db.collection('users').doc(req.user.uid);
    const userDoc = await userRef.get();
    
    if (!userDoc.exists) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }

    const userData = userDoc.data();
    let favoriteRadios = userData.favoriteRadios || [];

    if (favorite && !favoriteRadios.includes(radioName)) {
      favoriteRadios.push(radioName);
    } else if (!favorite) {
      favoriteRadios = favoriteRadios.filter(radio => radio !== radioName);
    }

    await userRef.update({
      favoriteRadios,
      updatedAt: new Date().toISOString()
    });

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

    // Buscar rádios favoritas do usuário
    const userRef = db.collection('users').doc(req.user.uid);
    const userDoc = await userRef.get();
    const userData = userDoc.data();
    const favoriteRadios = userData?.favoriteRadios || [];

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
      return res.status(400).json({ error: 'Algumas rádios selecionadas não são favoritas' });
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

    const result = await safeQuery(query, params);
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
