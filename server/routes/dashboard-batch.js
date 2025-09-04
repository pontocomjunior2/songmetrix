import express from 'express';
import { authenticateBasicUser } from '../auth-middleware.js';
import { format } from 'date-fns';
import { pool } from '../db.js';

const router = express.Router();

// Helper function to safely execute database queries
const safeQuery = async (query, params = []) => {
  if (!pool) {
    console.error('[Dashboard Batch Router] Pool de conexões não disponível');
    return { rows: [] };
  }
  try {
    const result = await pool.query(query, params);
    return result;
  } catch (error) {
    console.error('[Dashboard Batch Router] Erro ao executar query:', error);
    console.error('Query details:', { query, params });
    console.error('Error stack:', error.stack);
    return { rows: [] };
  }
};

// Helper function to get genre color
function getGenreColor(genre) {
  const colors = {
    'Sertanejo': '#3B82F6',
    'Pop': '#10B981',
    'Rock': '#F59E0B',
    'Brazilian': '#EF4444',
    'Alternative': '#8B5CF6'
  };
  return colors[genre] || '#6B7280';
}

// Batch endpoint for dashboard data - executes multiple queries in parallel
router.post('/batch', authenticateBasicUser, async (req, res) => {
  console.log('*** [Dashboard Batch Router] Rota /batch ACESSADA ***');
  
  try {
    const { queries = [], dateRange = 7, limits = {} } = req.body;
    
    // Default limits
    const defaultLimits = {
      songs: 10,
      artists: 10,
      genres: 5,
      radios: 20
    };
    
    const finalLimits = { ...defaultLimits, ...limits };
    
    // Date range setup
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - dateRange);
    
    // Get user preferences
    const userMetadata = req.user?.user_metadata || {};
    const favoriteSegments = userMetadata.favorite_segments || [];
    const favoriteRadios = userMetadata.favorite_radios || [];
    
    // Determine filter
    let filterType = 'none';
    let filterValues = [];
    
    const normalizedSegments = Array.from(new Set(
      (favoriteSegments || [])
        .flatMap((s) => String(s).split(',').map(t => t.trim()))
        .filter(Boolean)
    ));
    
    if (normalizedSegments.length > 0) {
      filterType = 'segments';
      filterValues = normalizedSegments;
    } else if (favoriteRadios.length > 0) {
      filterType = 'radios';
      filterValues = favoriteRadios;
    }
    
    // Build filter clause
    let filterClause = '';
    let baseParams = [
      format(startDate, 'yyyy-MM-dd'),
      format(endDate, 'yyyy-MM-dd')
    ];
    
    if (filterType === 'segments') {
      filterClause = `AND name IN (SELECT name FROM streams WHERE segmento = ANY($3::text[]))`;
      baseParams.push(filterValues);
    } else if (filterType === 'radios') {
      filterClause = `AND name = ANY($3::text[])`;
      baseParams.push(filterValues);
    }
    
    // Define available query types
    const queryDefinitions = {
      essential: {
        query: `
          WITH adjusted_dates AS (
            SELECT
              artist,
              song_title,
              name,
              (date + INTERVAL '3 hours')::date as adjusted_date
            FROM music_log
            WHERE (date + INTERVAL '3 hours')::date BETWEEN $1 AND $2
              ${filterClause}
          ),
          radio_status AS (
            SELECT DISTINCT
              name,
              true as is_online
            FROM adjusted_dates
          ),
          total_stats AS (
            SELECT
              COUNT(*) as total_executions,
              COUNT(DISTINCT artist) as unique_artists,
              COUNT(DISTINCT song_title) as unique_songs
            FROM adjusted_dates
          )
          SELECT
            json_build_object(
              'totalExecutions', (SELECT total_executions FROM total_stats),
              'uniqueArtists', (SELECT unique_artists FROM total_stats),
              'uniqueSongs', (SELECT unique_songs FROM total_stats),
              'activeRadios', (SELECT json_agg(radio_status.*) FROM radio_status WHERE radio_status.name IS NOT NULL)
            ) as data
        `,
        params: baseParams
      },
      
      artists: {
        query: `
          WITH adjusted_dates AS (
            SELECT
              artist,
              (date + INTERVAL '3 hours')::date as adjusted_date
            FROM music_log
            WHERE (date + INTERVAL '3 hours')::date BETWEEN $1 AND $2
              ${filterClause}
          )
          SELECT
            json_build_object(
              'artistData', (
                SELECT json_agg(artist_data.*)
                FROM (
                  SELECT
                    artist,
                    COUNT(*) as executions
                  FROM adjusted_dates
                  WHERE artist IS NOT NULL
                  GROUP BY artist
                  ORDER BY executions DESC
                  LIMIT ${finalLimits.artists}
                ) artist_data
              )
            ) as data
        `,
        params: baseParams
      },
      
      songs: {
        query: `
          WITH adjusted_dates AS (
            SELECT
              song_title,
              artist,
              (date + INTERVAL '3 hours')::date as adjusted_date
            FROM music_log
            WHERE (date + INTERVAL '3 hours')::date BETWEEN $1 AND $2
              ${filterClause}
          )
          SELECT
            json_build_object(
              'topSongs', (
                SELECT json_agg(song_data.*)
                FROM (
                  SELECT 
                    song_title,
                    artist,
                    COUNT(*) as executions
                  FROM adjusted_dates
                  WHERE song_title IS NOT NULL
                  GROUP BY song_title, artist
                  ORDER BY executions DESC
                  LIMIT ${finalLimits.songs}
                ) song_data
              )
            ) as data
        `,
        params: baseParams
      },
      
      genres: {
        query: `
          WITH adjusted_dates AS (
            SELECT
              genre,
              (date + INTERVAL '3 hours')::date as adjusted_date
            FROM music_log
            WHERE (date + INTERVAL '3 hours')::date BETWEEN $1 AND $2
              ${filterClause}
          )
          SELECT
            json_build_object(
              'genreData', (
                SELECT json_agg(genre_data.*)
                FROM (
                  SELECT
                    genre,
                    COUNT(*) as count
                  FROM adjusted_dates
                  WHERE genre IS NOT NULL AND genre <> ''
                  GROUP BY genre
                  HAVING COUNT(*) > 0
                  ORDER BY count DESC
                  LIMIT ${finalLimits.genres}
                ) genre_data
              )
            ) as data
        `,
        params: baseParams
      },
      
      complete: {
        query: `
          WITH adjusted_dates AS (
            SELECT
              artist,
              song_title,
              genre,
              name,
              (date + INTERVAL '3 hours')::date as adjusted_date
            FROM music_log
            WHERE (date + INTERVAL '3 hours')::date BETWEEN $1 AND $2
              ${filterClause}
          ),
          artist_counts AS (
            SELECT
              artist,
              COUNT(*) as executions
            FROM adjusted_dates
            WHERE artist IS NOT NULL
            GROUP BY artist
            ORDER BY executions DESC
            LIMIT ${finalLimits.artists}
          ),
          genre_counts AS (
            SELECT
              genre,
              COUNT(*) as count
            FROM adjusted_dates
            WHERE genre IS NOT NULL AND genre <> ''
            GROUP BY genre
            HAVING COUNT(*) > 0
            ORDER BY count DESC
            LIMIT ${finalLimits.genres}
          ),
          song_counts AS (
            SELECT 
              song_title,
              artist,
              COUNT(*) as executions
            FROM adjusted_dates
            WHERE song_title IS NOT NULL
            GROUP BY song_title, artist
            ORDER BY executions DESC
            LIMIT ${finalLimits.songs}
          ),
          radio_status AS (
            SELECT DISTINCT
              name,
              true as is_online
            FROM adjusted_dates
          ),
          total_stats AS (
            SELECT
              COUNT(*) as total_executions,
              COUNT(DISTINCT artist) as unique_artists,
              COUNT(DISTINCT song_title) as unique_songs
            FROM adjusted_dates
          )
          SELECT
            json_build_object(
              'totalExecutions', (SELECT total_executions FROM total_stats),
              'uniqueArtists', (SELECT unique_artists FROM total_stats),
              'uniqueSongs', (SELECT unique_songs FROM total_stats),
              'activeRadios', (SELECT json_agg(radio_status.*) FROM radio_status WHERE radio_status.name IS NOT NULL),
              'topSongs', (SELECT json_agg(song_counts.*) FROM song_counts),
              'artistData', (SELECT json_agg(artist_counts.*) FROM artist_counts),
              'genreData', (SELECT json_agg(genre_counts.*) FROM genre_counts)
            ) as data
        `,
        params: baseParams
      }
    };
    
    // Execute requested queries in parallel
    const requestedQueries = queries.length > 0 ? queries : ['complete'];
    const queryPromises = [];
    const queryNames = [];
    
    console.log(`[Dashboard Batch Router] Executing ${requestedQueries.length} queries in parallel:`, requestedQueries);
    
    for (const queryName of requestedQueries) {
      if (queryDefinitions[queryName]) {
        const queryDef = queryDefinitions[queryName];
        queryNames.push(queryName);
        queryPromises.push(safeQuery(queryDef.query, queryDef.params));
      } else {
        console.warn(`[Dashboard Batch Router] Unknown query type: ${queryName}`);
      }
    }
    
    // Execute all queries in parallel
    const startTime = Date.now();
    const results = await Promise.all(queryPromises);
    const executionTime = Date.now() - startTime;
    
    console.log(`[Dashboard Batch Router] Parallel execution completed in ${executionTime}ms`);
    
    // Combine results
    const combinedData = {};
    
    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      const queryName = queryNames[i];
      
      if (result && result.rows && result.rows.length > 0) {
        const data = result.rows[0].data || {};
        
        // Merge data into combined result
        Object.assign(combinedData, data);
      }
    }
    
    // Process genre data for frontend format
    if (combinedData.genreData) {
      const totalGenreExecutions = combinedData.genreData
        .reduce((sum, item) => sum + (parseInt(item.count) || 0), 0);
      
      if (totalGenreExecutions > 0) {
        combinedData.genreData = combinedData.genreData.map(item => ({
          name: item.genre,
          value: Math.round(((parseInt(item.count) || 0) / totalGenreExecutions) * 100),
          color: getGenreColor(item.genre)
        }));
      }
    }
    
    // Ensure all expected fields exist
    const response = {
      totalExecutions: combinedData.totalExecutions || 0,
      uniqueArtists: combinedData.uniqueArtists || 0,
      uniqueSongs: combinedData.uniqueSongs || 0,
      activeRadios: combinedData.activeRadios || [],
      topSongs: combinedData.topSongs || [],
      artistData: combinedData.artistData || [],
      genreData: combinedData.genreData || [],
      metadata: {
        executionTime,
        queriesExecuted: queryNames,
        dateRange: {
          start: format(startDate, 'yyyy-MM-dd'),
          end: format(endDate, 'yyyy-MM-dd')
        },
        filters: {
          type: filterType,
          values: filterValues.length
        }
      }
    };
    
    console.log(`[Dashboard Batch Router] Response prepared with ${Object.keys(response).length} fields`);
    res.json(response);
    
  } catch (error) {
    console.error('[Dashboard Batch Router] Erro no handler POST /batch:', error);
    res.status(500).json({
      error: 'Erro ao executar consultas em lote',
      details: error.message,
      fallback: {
        totalExecutions: 0,
        uniqueArtists: 0,
        uniqueSongs: 0,
        activeRadios: [],
        topSongs: [],
        artistData: [],
        genreData: []
      }
    });
  }
});

// Health check endpoint for batch API
router.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'dashboard-batch',
    timestamp: new Date().toISOString(),
    availableQueries: ['essential', 'artists', 'songs', 'genres', 'complete']
  });
});

export default router;