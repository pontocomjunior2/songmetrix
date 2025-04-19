import express from 'express';
import { authenticateBasicUser } from '../auth-middleware.js';
import supabaseAdmin from '../supabase-admin.js';
import pkg from 'pg';
const { Pool } = pkg;

const router = express.Router();

// Configuração da conexão com o banco de dados
const pool = new Pool({
  user: process.env.POSTGRES_USER,
  host: process.env.POSTGRES_HOST,
  database: process.env.POSTGRES_DB,
  password: process.env.POSTGRES_PASSWORD,
  port: process.env.POSTGRES_PORT,
});

// Rota principal para o dashboard - usando PostgreSQL diretamente
router.get('/', authenticateBasicUser, async (req, res) => {
  console.log('Requisição recebida: GET /api/dashboard');
  console.log('Usuário autenticado:', req.user);
  
  try {
    const { query } = req;
    const includeAll = query.includeAll === 'true';
    const selectedRadios = Array.isArray(query.radio) ? query.radio : query.radio ? [query.radio] : [];
    const limitSongs = parseInt(query.limit_songs) || 5;
    const limitArtists = parseInt(query.limit_artists) || 5;
    const limitGenres = parseInt(query.limit_genres) || 5;

    console.log('Parâmetros da requisição:', { 
      includeAll, 
      selectedRadios: selectedRadios.length, 
      limitSongs, 
      limitArtists, 
      limitGenres 
    });

    // Preparar dados vazios para retornar em caso de erro
    const emptyResponse = {
      topSongs: [],
      artistData: [],
      genreData: []
    };

    if (!selectedRadios.length && !includeAll) {
      console.log('Sem rádios selecionadas e includeAll=false, retornando dados vazios');
      return res.json(emptyResponse);
    }
    
    try {
      // Consultas SQL para obter os dados do dashboard
      let topSongsQuery, artistDataQuery, genreDataQuery;
      let queryParams = [];
      
      if (includeAll) {
        console.log('Modo includeAll=true, buscando dados de todas as rádios');
        // Consultas sem filtro de rádio
        topSongsQuery = `
          SELECT song_title, artist, COUNT(*) as executions
          FROM music_log
          WHERE date >= CURRENT_DATE - INTERVAL '30 days'
          GROUP BY song_title, artist
          ORDER BY executions DESC
          LIMIT $1
        `;
        
        artistDataQuery = `
          SELECT artist, COUNT(*) as executions
          FROM music_log
          WHERE date >= CURRENT_DATE - INTERVAL '30 days'
          GROUP BY artist
          ORDER BY executions DESC
          LIMIT $1
        `;
        
        genreDataQuery = `
          SELECT genre, COUNT(*) as executions
          FROM music_log
          WHERE date >= CURRENT_DATE - INTERVAL '30 days'
          GROUP BY genre
          ORDER BY executions DESC
          LIMIT $1
        `;
        
        queryParams = [
          [limitSongs],
          [limitArtists],
          [limitGenres]
        ];
      } else {
        console.log('Usando filtro de rádios específicas:', selectedRadios.length, 'rádios');
        // Consultas com filtro de rádio
        topSongsQuery = `
          SELECT song_title, artist, COUNT(*) as executions
          FROM music_log
          WHERE name = ANY($1) AND date >= CURRENT_DATE - INTERVAL '30 days'
          GROUP BY song_title, artist
          ORDER BY executions DESC
          LIMIT $2
        `;
        
        artistDataQuery = `
          SELECT artist, COUNT(*) as executions
          FROM music_log
          WHERE name = ANY($1) AND date >= CURRENT_DATE - INTERVAL '30 days'
          GROUP BY artist
          ORDER BY executions DESC
          LIMIT $2
        `;
        
        genreDataQuery = `
          SELECT 
            COALESCE(genre, 'Desconhecido') as genre, 
            COUNT(*) as executions
          FROM music_log
          WHERE name = ANY($1) AND date >= CURRENT_DATE - INTERVAL '30 days'
          GROUP BY genre
          ORDER BY executions DESC
          LIMIT $2
        `;
        
        queryParams = [
          [selectedRadios, limitSongs],
          [selectedRadios, limitArtists],
          [selectedRadios, limitGenres]
        ];
      }

      // Executar as consultas em paralelo
      let topSongsResult, artistDataResult, genreDataResult;
      
      try {
        console.log('Executando queries em paralelo');
        [topSongsResult, artistDataResult, genreDataResult] = await Promise.all([
          pool.query(topSongsQuery, queryParams[0]).catch(error => {
            console.error('Erro na query de topSongs:', error);
            return { rows: [] };
          }),
          pool.query(artistDataQuery, queryParams[1]).catch(error => {
            console.error('Erro na query de artistData:', error);
            return { rows: [] };
          }),
          pool.query(genreDataQuery, queryParams[2]).catch(error => {
            console.error('Erro na query de genreData:', error);
            return { rows: [] };
          })
        ]);
      } catch (parallelError) {
        console.error('Erro executando queries em paralelo:', parallelError);
        // Executar sequencialmente como fallback
        console.log('Tentando executar queries sequencialmente como fallback');
        
        try {
          topSongsResult = await pool.query(topSongsQuery, queryParams[0])
            .catch(() => ({ rows: [] }));
        } catch (e) {
          topSongsResult = { rows: [] };
        }
        
        try {
          artistDataResult = await pool.query(artistDataQuery, queryParams[1])
            .catch(() => ({ rows: [] }));
        } catch (e) {
          artistDataResult = { rows: [] };
        }
        
        try {
          genreDataResult = await pool.query(genreDataQuery, queryParams[2])
            .catch(() => ({ rows: [] }));
        } catch (e) {
          genreDataResult = { rows: [] };
        }
      }

      // Construir o objeto de resposta
      const response = {
        topSongs: topSongsResult?.rows || [],
        artistData: artistDataResult?.rows || [],
        genreData: genreDataResult?.rows || []
      };

      console.log('Enviando resposta com:', {
        topSongs: response.topSongs.length,
        artistData: response.artistData.length,
        genreData: response.genreData.length
      });
      
      res.json(response);
    } catch (dbError) {
      console.error('Erro nas consultas do dashboard:', dbError);
      // Retornar dados vazios em vez de erro
      res.json(emptyResponse);
    }
  } catch (error) {
    console.error('Erro na rota do dashboard:', error);
    // Retornar dados vazios em vez de erro
    res.json({
      topSongs: [],
      artistData: [],
      genreData: []
    });
  }
});

router.get('/complete', authenticateBasicUser, async (req, res) => {
  console.log('Requisição recebida: GET /api/dashboard/complete');
  console.log('Usuário autenticado:', req.user);
  try {
    const { query } = req;
    const selectedRadios = Array.isArray(query.radio) ? query.radio : query.radio ? [query.radio] : [];

    if (!selectedRadios.length) {
      return res.status(400).json({ error: 'Nenhuma rádio selecionada' });
    }

    // Buscar status das rádios e dados do dashboard em paralelo
    const [radiosStatusResult, dashboardDataResponse] = await Promise.all([
      supabaseAdmin
        .from('streams')
        .select('name')
        .in('name', selectedRadios),
      supabaseAdmin
        .rpc('get_dashboard_data', {
          p_radios: selectedRadios,
          p_start_date: new Date().toISOString().split('T')[0],
          p_end_date: new Date().toISOString().split('T')[0]
        })
    ]);

    if (radiosStatusResult.error) {
      throw new Error('Falha ao buscar status das rádios');
    }

    // Verificar se temos dados do dashboard antes de prosseguir
    if (dashboardDataResponse.error) {
      throw new Error('Falha ao buscar dados do dashboard');
    }

    const [radiosStatus, dashboardData] = [
      radiosStatusResult.data,
      dashboardDataResponse.data
    ];

    // Processar e combinar os dados
    const response = {
      radiosStatus: radiosStatus.map(radio => ({
        name: radio.name,
        status: 'ONLINE' // Status padrão como ONLINE já que não temos a coluna status
      })),
      topSongs: dashboardData?.top_songs || [],
      artistData: dashboardData?.artist_data || [],
      genreData: dashboardData?.genre_data || [],
      totalSongs: dashboardData?.total_songs || 0,
      songsPlayedToday: dashboardData?.songs_played_today || 0
    };

    res.json(response);
  } catch (error) {
    console.error('Erro ao buscar dados do dashboard:', error);
    res.status(500).json({
      error: 'Erro ao carregar dados do dashboard',
      details: error.message
    });
  }
});

export default router;