import express from 'express';
import { authenticateBasicUser } from './auth-middleware.js';
import { pool } from './db.js';

const router = express.Router();

router.get('/api/ranking', authenticateBasicUser, async (req, res) => {
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

    const result = await pool.query(query, params);
    console.log('GET /api/ranking - Query executada:', {
      query,
      params,
      rowCount: result.rows.length
    });

    const rankingData = result.rows.map(row => ({
      id: row.id,
      rank: row.id,
      artist: row.artist,
      song_title: row.song_title,
      genre: row.genre,
      executions: parseInt(row.executions)
    }));

    console.log('GET /api/ranking - Dados processados:', rankingData);

    res.json(rankingData);
  } catch (error) {
    console.error('GET /api/ranking - Erro:', error);
    res.status(500).json({ error: 'Erro interno do servidor', details: error.message });
  }
});

export default router;
