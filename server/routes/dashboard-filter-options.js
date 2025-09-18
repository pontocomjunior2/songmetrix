import express from 'express';
import { pool } from '../db-optimized.js';
import { authenticateBasicUser } from '../auth-middleware.js';
import { format } from 'date-fns';

// Safe query function
const safeQuery = async (query, params = []) => {
  const client = await pool.connect();
  try {
    const result = await client.query(query, params);
    return result;
  } catch (error) {
    console.error('Database query error:', error);
    throw error;
  } finally {
    client.release();
  }
};

const router = express.Router();

// Cache middleware for filter options (cache for 1 hour)
const filterOptionsCache = (req, res, next) => {
  res.set({
    'Cache-Control': 'public, max-age=3600', // 1 hour
    'ETag': `"filter-options-${Date.now()}"`
  });
  next();
};

// Get available genres for filtering
router.get('/genres', authenticateBasicUser, filterOptionsCache, async (req, res) => {
  console.log('*** [Dashboard Filter Options] Rota /genres ACESSADA ***');
  
  try {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 90); // Last 90 days for more options

    // Get user preferences to filter available options
    const userMetadata = req.user?.user_metadata || {};
    const favoriteSegments = userMetadata.favorite_segments || [];
    const favoriteRadios = userMetadata.favorite_radios || [];

    // Build filter clause based on user preferences
    let filterClause = '';
    let queryParams = [
      format(startDate, 'yyyy-MM-dd'),
      format(endDate, 'yyyy-MM-dd')
    ];

    const normalizedSegments = Array.from(new Set(
      (favoriteSegments || [])
        .flatMap((s) => String(s).split(',').map(t => t.trim()))
        .filter(Boolean)
    ));

    if (normalizedSegments.length > 0) {
      filterClause = `AND name IN (SELECT name FROM streams WHERE segmento = ANY($3::text[]))`;
      queryParams.push(normalizedSegments);
    } else if (favoriteRadios.length > 0) {
      filterClause = `AND name = ANY($3::text[])`;
      queryParams.push(favoriteRadios);
    }

    const query = `
      WITH adjusted_dates AS (
        SELECT
          genre,
          (date + INTERVAL '3 hours')::date as adjusted_date
        FROM music_log
        WHERE (date + INTERVAL '3 hours')::date BETWEEN $1 AND $2
          ${filterClause}
          AND genre IS NOT NULL 
          AND genre <> ''
      )
      SELECT
        genre as value,
        genre as label,
        COUNT(*) as count
      FROM adjusted_dates
      GROUP BY genre
      HAVING COUNT(*) >= 5  -- Only genres with at least 5 occurrences
      ORDER BY count DESC, genre ASC
      LIMIT 50
    `;

    const result = await safeQuery(query, queryParams);
    const genres = result.rows.map(row => ({
      value: row.value,
      label: row.label,
      count: parseInt(row.count)
    }));

    res.json(genres);

  } catch (error) {
    console.error('[Dashboard Filter Options] Erro ao buscar gêneros:', error);
    res.status(500).json({ error: 'Erro ao carregar gêneros disponíveis' });
  }
});

// Get available regions for filtering
router.get('/regions', authenticateBasicUser, filterOptionsCache, async (req, res) => {
  console.log('*** [Dashboard Filter Options] Rota /regions ACESSADA ***');
  
  try {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 90);

    // Get user preferences
    const userMetadata = req.user?.user_metadata || {};
    const favoriteSegments = userMetadata.favorite_segments || [];
    const favoriteRadios = userMetadata.favorite_radios || [];

    // Build filter clause
    let filterClause = '';
    let queryParams = [
      format(startDate, 'yyyy-MM-dd'),
      format(endDate, 'yyyy-MM-dd')
    ];

    const normalizedSegments = Array.from(new Set(
      (favoriteSegments || [])
        .flatMap((s) => String(s).split(',').map(t => t.trim()))
        .filter(Boolean)
    ));

    if (normalizedSegments.length > 0) {
      filterClause = `AND ml.name IN (SELECT name FROM streams WHERE segmento = ANY($3::text[]))`;
      queryParams.push(normalizedSegments);
    } else if (favoriteRadios.length > 0) {
      filterClause = `AND ml.name = ANY($3::text[])`;
      queryParams.push(favoriteRadios);
    }

    const query = `
      WITH adjusted_dates AS (
        SELECT DISTINCT
          ml.name,
          s.regiao,
          (ml.date + INTERVAL '3 hours')::date as adjusted_date
        FROM music_log ml
        LEFT JOIN streams s ON ml.name = s.name
        WHERE (ml.date + INTERVAL '3 hours')::date BETWEEN $1 AND $2
          ${filterClause}
          AND s.regiao IS NOT NULL 
          AND s.regiao <> ''
      )
      SELECT
        regiao as value,
        regiao as label,
        COUNT(DISTINCT name) as count
      FROM adjusted_dates
      GROUP BY regiao
      HAVING COUNT(DISTINCT name) >= 1
      ORDER BY count DESC, regiao ASC
      LIMIT 30
    `;

    const result = await safeQuery(query, queryParams);
    const regions = result.rows.map(row => ({
      value: row.value,
      label: row.label,
      count: parseInt(row.count)
    }));

    res.json(regions);

  } catch (error) {
    console.error('[Dashboard Filter Options] Erro ao buscar regiões:', error);
    res.status(500).json({ error: 'Erro ao carregar regiões disponíveis' });
  }
});

// Get available radio stations for filtering
router.get('/radios', authenticateBasicUser, filterOptionsCache, async (req, res) => {
  console.log('*** [Dashboard Filter Options] Rota /radios ACESSADA ***');
  
  try {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 30); // Last 30 days for radio stations

    // Get user preferences
    const userMetadata = req.user?.user_metadata || {};
    const favoriteSegments = userMetadata.favorite_segments || [];
    const favoriteRadios = userMetadata.favorite_radios || [];

    // Build filter clause
    let filterClause = '';
    let queryParams = [
      format(startDate, 'yyyy-MM-dd'),
      format(endDate, 'yyyy-MM-dd')
    ];

    const normalizedSegments = Array.from(new Set(
      (favoriteSegments || [])
        .flatMap((s) => String(s).split(',').map(t => t.trim()))
        .filter(Boolean)
    ));

    if (normalizedSegments.length > 0) {
      filterClause = `AND ml.name IN (SELECT name FROM streams WHERE segmento = ANY($3::text[]))`;
      queryParams.push(normalizedSegments);
    } else if (favoriteRadios.length > 0) {
      filterClause = `AND ml.name = ANY($3::text[])`;
      queryParams.push(favoriteRadios);
    }

    const query = `
      WITH adjusted_dates AS (
        SELECT DISTINCT
          ml.name,
          s.regiao,
          s.segmento,
          (ml.date + INTERVAL '3 hours')::date as adjusted_date
        FROM music_log ml
        LEFT JOIN streams s ON ml.name = s.name
        WHERE (ml.date + INTERVAL '3 hours')::date BETWEEN $1 AND $2
          ${filterClause}
          AND ml.name IS NOT NULL 
          AND ml.name <> ''
      ),
      radio_stats AS (
        SELECT
          name,
          regiao,
          segmento,
          COUNT(*) as play_count
        FROM adjusted_dates
        GROUP BY name, regiao, segmento
        HAVING COUNT(*) >= 10  -- Only radios with at least 10 plays
      )
      SELECT
        name as value,
        CASE 
          WHEN regiao IS NOT NULL AND regiao <> '' THEN name || ' (' || regiao || ')'
          ELSE name
        END as label,
        play_count as count
      FROM radio_stats
      ORDER BY play_count DESC, name ASC
      LIMIT 100
    `;

    const result = await safeQuery(query, queryParams);
    const radios = result.rows.map(row => ({
      value: row.value,
      label: row.label,
      count: parseInt(row.count)
    }));

    res.json(radios);

  } catch (error) {
    console.error('[Dashboard Filter Options] Erro ao buscar estações de rádio:', error);
    res.status(500).json({ error: 'Erro ao carregar estações de rádio disponíveis' });
  }
});

// Get all filter options in a single request (for better performance)
router.get('/all', authenticateBasicUser, filterOptionsCache, async (req, res) => {
  console.log('*** [Dashboard Filter Options] Rota /all ACESSADA ***');
  
  try {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 90);

    // Get user preferences
    const userMetadata = req.user?.user_metadata || {};
    const favoriteSegments = userMetadata.favorite_segments || [];
    const favoriteRadios = userMetadata.favorite_radios || [];

    // Build filter clause
    let filterClause = '';
    let queryParams = [
      format(startDate, 'yyyy-MM-dd'),
      format(endDate, 'yyyy-MM-dd')
    ];

    const normalizedSegments = Array.from(new Set(
      (favoriteSegments || [])
        .flatMap((s) => String(s).split(',').map(t => t.trim()))
        .filter(Boolean)
    ));

    if (normalizedSegments.length > 0) {
      filterClause = `AND ml.name IN (SELECT name FROM streams WHERE segmento = ANY($3::text[]))`;
      queryParams.push(normalizedSegments);
    } else if (favoriteRadios.length > 0) {
      filterClause = `AND ml.name = ANY($3::text[])`;
      queryParams.push(favoriteRadios);
    }

    const query = `
      WITH adjusted_dates AS (
        SELECT
          ml.genre,
          ml.name as radio_name,
          s.regiao,
          s.segmento,
          (ml.date + INTERVAL '3 hours')::date as adjusted_date
        FROM music_log ml
        LEFT JOIN streams s ON ml.name = s.name
        WHERE (ml.date + INTERVAL '3 hours')::date BETWEEN $1 AND $2
          ${filterClause}
      ),
      genre_stats AS (
        SELECT
          genre as value,
          genre as label,
          COUNT(*) as count
        FROM adjusted_dates
        WHERE genre IS NOT NULL AND genre <> ''
        GROUP BY genre
        HAVING COUNT(*) >= 5
        ORDER BY count DESC, genre ASC
        LIMIT 50
      ),
      region_stats AS (
        SELECT
          regiao as value,
          regiao as label,
          COUNT(DISTINCT radio_name) as count
        FROM adjusted_dates
        WHERE regiao IS NOT NULL AND regiao <> ''
        GROUP BY regiao
        HAVING COUNT(DISTINCT radio_name) >= 1
        ORDER BY count DESC, regiao ASC
        LIMIT 30
      ),
      radio_stats AS (
        SELECT
          radio_name as value,
          CASE 
            WHEN regiao IS NOT NULL AND regiao <> '' THEN radio_name || ' (' || regiao || ')'
            ELSE radio_name
          END as label,
          COUNT(*) as count
        FROM adjusted_dates
        WHERE radio_name IS NOT NULL AND radio_name <> ''
        GROUP BY radio_name, regiao
        HAVING COUNT(*) >= 10
        ORDER BY count DESC, radio_name ASC
        LIMIT 100
      )
      SELECT
        json_build_object(
          'genres', (SELECT json_agg(genre_stats.*) FROM genre_stats),
          'regions', (SELECT json_agg(region_stats.*) FROM region_stats),
          'radioStations', (SELECT json_agg(radio_stats.*) FROM radio_stats)
        ) as filter_options
    `;

    const result = await safeQuery(query, queryParams);
    const filterOptions = result.rows[0]?.filter_options || {
      genres: [],
      regions: [],
      radioStations: []
    };

    res.json(filterOptions);

  } catch (error) {
    console.error('[Dashboard Filter Options] Erro ao buscar todas as opções de filtro:', error);
    res.status(500).json({
      error: 'Erro ao carregar opções de filtro',
      genres: [],
      regions: [],
      radioStations: []
    });
  }
});

export default router;