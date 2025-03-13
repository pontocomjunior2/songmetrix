import express from 'express';
import pkg from 'pg';
const { Pool } = pkg;
import { requireAuth, requireAdmin } from '../middleware/auth.js';

const router = express.Router();

// Configuração da conexão com o banco de dados
const pool = new Pool({
  user: process.env.POSTGRES_USER,
  host: process.env.POSTGRES_HOST,
  database: process.env.POSTGRES_DB,
  password: process.env.POSTGRES_PASSWORD,
  port: process.env.POSTGRES_PORT,
});

/**
 * @route GET /api/streams
 * @desc Obter todos os streams
 * @access Private
 */
router.get('/', requireAuth, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM streams ORDER BY name ASC');
    res.json(result.rows);
  } catch (error) {
    console.error('Erro ao buscar streams:', error);
    res.status(500).json({ error: 'Erro ao buscar streams' });
  }
});

/**
 * @route GET /api/streams/:id
 * @desc Obter um stream pelo ID
 * @access Private
 */
router.get('/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('SELECT * FROM streams WHERE id = $1', [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Stream não encontrado' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Erro ao buscar stream:', error);
    res.status(500).json({ error: 'Erro ao buscar stream' });
  }
});

/**
 * @route POST /api/streams
 * @desc Criar um novo stream
 * @access Private (Admin)
 */
router.post('/', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { 
      url, name, sheet, cidade, estado, regiao, segmento, index,
      formato, frequencia, pais, facebook, instagram, twitter, youtube, site, monitoring_url, logo_url 
    } = req.body;
    
    // Validação básica dos campos obrigatórios
    if (!url || !name || !sheet || !cidade || !estado || !regiao || !segmento || !index) {
      return res.status(400).json({ error: 'Todos os campos obrigatórios devem ser preenchidos' });
    }
    
    const result = await pool.query(
      `INSERT INTO streams (
        url, name, sheet, cidade, estado, regiao, segmento, index,
        formato, frequencia, pais, facebook, instagram, twitter, youtube, site, monitoring_url, logo_url
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18) RETURNING *`,
      [
        url, name, sheet, cidade, estado, regiao, segmento, index,
        formato || segmento, frequencia, pais || 'Brasil', facebook, instagram, twitter, youtube, site, monitoring_url, logo_url
      ]
    );
    
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Erro ao criar stream:', error);
    res.status(500).json({ error: 'Erro ao criar stream' });
  }
});

/**
 * @route PUT /api/streams/:id
 * @desc Atualizar um stream existente
 * @access Private (Admin)
 */
router.put('/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    console.log('Atualizando stream com ID:', id);
    console.log('Dados recebidos:', req.body);
    
    const { 
      url, name, sheet, cidade, estado, regiao, segmento, index,
      formato, frequencia, pais, facebook, instagram, twitter, youtube, site, monitoring_url, logo_url 
    } = req.body;
    
    // Validação básica dos campos obrigatórios
    if (!url || !name || !sheet || !cidade || !estado || !regiao || !segmento || !index) {
      console.log('Validação falhou. Campos obrigatórios faltando.');
      return res.status(400).json({ error: 'Todos os campos obrigatórios devem ser preenchidos' });
    }
    
    // Verificar se o stream existe
    const checkResult = await pool.query('SELECT * FROM streams WHERE id = $1', [id]);
    if (checkResult.rows.length === 0) {
      console.log('Stream não encontrado com ID:', id);
      return res.status(404).json({ error: 'Stream não encontrado' });
    }
    
    console.log('Stream encontrado. Atualizando...');
    
    const queryText = `UPDATE streams SET 
      url = $1, name = $2, sheet = $3, cidade = $4, estado = $5, regiao = $6, segmento = $7, index = $8,
      formato = $9, frequencia = $10, pais = $11, facebook = $12, instagram = $13, twitter = $14, youtube = $15, site = $16,
      monitoring_url = $17, logo_url = $18, updated_at = NOW() 
    WHERE id = $19 RETURNING *`;
    
    const values = [
      url, name, sheet, cidade, estado, regiao, segmento, index,
      formato || segmento, frequencia, pais || 'Brasil', facebook, instagram, twitter, youtube, site,
      monitoring_url, logo_url, id
    ];
    
    console.log('Query SQL:', queryText);
    console.log('Valores:', values);
    
    const result = await pool.query(queryText, values);
    
    console.log('Atualização bem-sucedida. Linhas afetadas:', result.rowCount);
    console.log('Dados atualizados:', result.rows[0]);
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Erro ao atualizar stream:', error);
    res.status(500).json({ error: 'Erro ao atualizar stream' });
  }
});

/**
 * @route DELETE /api/streams/:id
 * @desc Excluir um stream
 * @access Private (Admin)
 */
router.delete('/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Verificar se o stream existe
    const checkResult = await pool.query('SELECT * FROM streams WHERE id = $1', [id]);
    if (checkResult.rows.length === 0) {
      return res.status(404).json({ error: 'Stream não encontrado' });
    }
    
    await pool.query('DELETE FROM streams WHERE id = $1', [id]);
    
    res.json({ message: 'Stream excluído com sucesso' });
  } catch (error) {
    console.error('Erro ao excluir stream:', error);
    res.status(500).json({ error: 'Erro ao excluir stream' });
  }
});

/**
 * @route GET /api/streams/search
 * @desc Buscar streams por termo
 * @access Private
 */
router.get('/search', requireAuth, async (req, res) => {
  try {
    const { query } = req.query;
    
    if (!query) {
      return res.status(400).json({ error: 'Termo de busca é obrigatório' });
    }
    
    const searchTerm = `%${query}%`;
    
    const result = await pool.query(
      'SELECT * FROM streams WHERE name ILIKE $1 OR cidade ILIKE $1 OR segmento ILIKE $1 ORDER BY name ASC',
      [searchTerm]
    );
    
    res.json(result.rows);
  } catch (error) {
    console.error('Erro ao buscar streams:', error);
    res.status(500).json({ error: 'Erro ao buscar streams' });
  }
});

/**
 * @route GET /api/streams/filter
 * @desc Filtrar streams por região, estado, cidade ou segmento
 * @access Private
 */
router.get('/filter', requireAuth, async (req, res) => {
  try {
    const { region, state, city, segment } = req.query;
    
    let query = 'SELECT * FROM streams WHERE 1=1';
    const params = [];
    
    if (region) {
      params.push(region);
      query += ` AND regiao = $${params.length}`;
    }
    
    if (state) {
      params.push(state);
      query += ` AND estado = $${params.length}`;
    }
    
    if (city) {
      params.push(city);
      query += ` AND cidade = $${params.length}`;
    }
    
    if (segment) {
      params.push(`%${segment}%`);
      query += ` AND segmento ILIKE $${params.length}`;
    }
    
    query += ' ORDER BY name ASC';
    
    const result = await pool.query(query, params);
    
    res.json(result.rows);
  } catch (error) {
    console.error('Erro ao filtrar streams:', error);
    res.status(500).json({ error: 'Erro ao filtrar streams' });
  }
});

export default router; 