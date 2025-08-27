import express from 'express';
import { authenticateBasicUser } from '../auth-middleware.js';
import supabaseAdmin from '../supabase-admin.js';
import pkg from 'pg';
import { format } from 'date-fns';
import { pool } from '../db.js';
const { Pool } = pkg;

const router = express.Router();

// Função auxiliar para atribuir cores aos gêneros (movida para cá)
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

// Helper function to safely execute database queries (se não for importada)
// Adapte ou importe conforme a estrutura do seu projeto
const safeQuery = async (query, params = []) => {
  if (!pool) {
    console.error('[Dashboard Router] Pool de conexões não disponível');
    return { rows: [] };
  }
  try {
    const result = await pool.query(query, params);
    return result;
  } catch (error) {
    console.error('[Dashboard Router] Erro ao executar query:', error);
    console.error('Query details:', { query, params });
    console.error('Error stack:', error.stack);
    // Retornar estrutura vazia para permitir fallback sem 500
    return { rows: [] };
  }
};

// Rota principal do dashboard (agora é a raiz '/' do router montado em /api/dashboard)
router.get('/', authenticateBasicUser, async (req, res) => {
  console.log('*** [Dashboard Router] Rota / ACESSADA ***');
  try {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 7); // Considerar últimos 7 dias

    // Obter preferências do usuário (segmentos têm prioridade)
    const userMetadata = req.user?.user_metadata || {}; // Usar optional chaining
    const favoriteSegments = userMetadata.favorite_segments || [];
    const favoriteRadios = userMetadata.favorite_radios || []; // Manter para fallback

    console.log('[Dashboard Router] Preferências:', { favoriteSegments, favoriteRadios });

    // Determinar o filtro a ser usado na query
    let filterType = 'none'; // none, segments, radios
    let filterValues = [];

    // Normalizar segmentos (dividir por vírgula, trim e remover duplicatas)
    const normalizedSegments = Array.from(new Set(
      (favoriteSegments || [])
        .flatMap((s) => String(s).split(',').map(t => t.trim()))
        .filter(Boolean)
    ));

    if (normalizedSegments.length > 0) {
      filterType = 'segments';
      filterValues = normalizedSegments;
      console.log('[Dashboard Router] Filtrando por SEGMENTOS favoritos (normalizados):', filterValues.length);
    } else if (favoriteRadios.length > 0) {
       filterType = 'radios';
       filterValues = favoriteRadios;
       console.log('[Dashboard Router] Filtrando por RÁDIOS favoritas (fallback):', filterValues.length);
    } else {
      console.log('[Dashboard Router] Nenhuma preferência (segmento/rádio) encontrada. Buscando todos os dados.');
    }

    // Limitar número de rádios/segmentos se necessário
    const MAX_FILTER_ITEMS = 100;
    if (filterValues.length > MAX_FILTER_ITEMS) {
        console.log(`[Dashboard Router] Limitando filtro de ${filterValues.length} para ${MAX_FILTER_ITEMS} itens.`);
        filterValues = filterValues.slice(0, MAX_FILTER_ITEMS);
    }

    // Obter limites de consulta da query string
    const limitSongs = parseInt(req.query.limit_songs) || 10;
    const limitArtists = parseInt(req.query.limit_artists) || 10;
    const limitGenres = parseInt(req.query.limit_genres) || 5;
    console.log('[Dashboard Router] Limites:', { limitSongs, limitArtists, limitGenres });

    // Montar a Query SQL Dinamicamente com parâmetros corretos
    let filterClause = '';
    let queryParams = [
        format(startDate, 'yyyy-MM-dd'), // $1
        format(endDate, 'yyyy-MM-dd')   // $2
    ];
    let limitArtistIndex = 3;
    let limitGenreIndex = 4;
    let limitSongIndex = 5;

    if (filterType === 'segments') {
      // Produção não possui coluna 'formato'; usar apenas 'segmento'
      filterClause = `AND name IN (SELECT name FROM streams WHERE segmento = ANY($3::text[]))`;
      queryParams.push(filterValues); // $3 = filterValues (segments)
      limitArtistIndex = 4;
      limitGenreIndex = 5;
      limitSongIndex = 6;
      console.log('[Dashboard Router] Usando filtro de SEGMENTOS na query.');
    } else if (filterType === 'radios') {
      filterClause = `AND name = ANY($3::text[])`;
      queryParams.push(filterValues); // $3 = filterValues (radios)
      limitArtistIndex = 4;
      limitGenreIndex = 5;
      limitSongIndex = 6;
      console.log('[Dashboard Router] Usando filtro de RADIOS (fallback) na query.');
    } else {
      console.log('[Dashboard Router] Sem filtro específico (segmentos/rádios) na query.');
    }

    queryParams.push(limitArtists); // $limitArtistIndex
    queryParams.push(limitGenres);  // $limitGenreIndex
    queryParams.push(limitSongs);   // $limitSongIndex

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
          ${filterClause} -- Cláusula de filtro dinâmica
      ),
      artist_counts AS (
        SELECT
          artist,
          COUNT(*) as executions
        FROM adjusted_dates
          GROUP BY artist
          ORDER BY executions DESC
        LIMIT $${limitArtistIndex}
      ),
      genre_counts AS (
        SELECT
          genre,
          COUNT(*) as count
        FROM adjusted_dates
        WHERE genre IS NOT NULL AND genre <> '' -- Garante que não seja nulo OU vazio
        GROUP BY genre
        HAVING COUNT(*) > 0 -- Garante que tenha execuções
        ORDER BY count DESC
        LIMIT $${limitGenreIndex}
      ),
      song_counts AS (
          SELECT 
          song_title,
          artist,
            COUNT(*) as executions
        FROM adjusted_dates
        GROUP BY song_title, artist
          ORDER BY executions DESC
        LIMIT $${limitSongIndex}
      ),
      radio_status AS (
        SELECT DISTINCT
          name,
          true as is_online -- Simplificado: assume online se teve execução no período
        FROM adjusted_dates
        -- WHERE adjusted_date = $2 -- Remover condição de data específica para status online
      )
      SELECT
        json_build_object(
          'artistData', (SELECT json_agg(artist_counts.*) FROM artist_counts WHERE artist_counts.artist IS NOT NULL),
          'genreData', (SELECT json_agg(genre_counts.*) FROM genre_counts WHERE genre_counts.genre IS NOT NULL),
          'topSongs', (SELECT json_agg(song_counts.*) FROM song_counts WHERE song_counts.song_title IS NOT NULL),
          'activeRadios', (SELECT json_agg(radio_status.*) FROM radio_status WHERE radio_status.name IS NOT NULL)
        ) as dashboard_data
    `;

    console.log('[Dashboard Router] Executando consulta com parâmetros:', queryParams);
    // console.log('[Dashboard Router] Query SQL:', query); // Descomentar para debug detalhado da query

    const result = await safeQuery(query, queryParams);

    // Adicionar verificação se result ou result.rows é undefined/null
    if (!result || !result.rows) {
      console.error('[Dashboard Router] A consulta principal não retornou resultados válidos.');
      // Retornar objeto vazio ou erro, dependendo do comportamento desejado
      return res.status(500).json({ error: 'Erro ao buscar dados do dashboard' });
    }

    const dashboardData = result.rows[0]?.dashboard_data || {
      artistData: [],
      genreData: [],
      topSongs: [],
      activeRadios: []
    };

    // Calcular totais com segurança
    const totalExecutions = (dashboardData.artistData || [])
      .reduce((sum, item) => sum + (parseInt(item.executions) || 0), 0);
    const uniqueArtists = (dashboardData.artistData || []).length;
    const uniqueSongs = (dashboardData.topSongs || []).length;

    // Formatar dados dos gêneros para percentuais com segurança
    const totalGenreExecutions = (dashboardData.genreData || [])
      .reduce((sum, item) => sum + (parseInt(item.count) || 0), 0);
    const genreData = totalGenreExecutions > 0
      ? (dashboardData.genreData || []).map(item => ({
          name: item.genre,
          value: Math.round(((parseInt(item.count) || 0) / totalGenreExecutions) * 100),
          color: getGenreColor(item.genre)
        }))
      : [];

    // Log do tamanho dos dados retornados
    console.log('[Dashboard Router] Resultados da consulta:', {
      totalSongs: dashboardData.topSongs?.length ?? 0,
      totalArtists: dashboardData.artistData?.length ?? 0,
      totalGenres: dashboardData.genreData?.length ?? 0,
      totalRadiosStatus: dashboardData.activeRadios?.length ?? 0
    });

    console.log('[Dashboard Router] Final dashboardData object from query:', JSON.stringify(dashboardData, null, 2));

    res.json({
      totalExecutions,
      uniqueArtists,
      uniqueSongs,
      activeRadios: dashboardData.activeRadios || [],
      topSongs: dashboardData.topSongs || [],
      artistData: dashboardData.artistData || [],
      // Enviar no formato bruto esperado pelo frontend (genre/count)
      genreData: dashboardData.genreData || []
    });

  } catch (error) {
    console.error('[Dashboard Router] Erro no handler GET /:', error);
    // Abordagem resiliente: evitar 500 e retornar payload vazio
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