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
  port: parseInt(process.env.POSTGRES_PORT || '5432'),
  ssl: {
    rejectUnauthorized: false
  }
});

/**
 * @route GET /api/relay-streams
 * @desc Obter todos os relay streams
 * @access Private
 */
router.get('/', requireAuth, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM relay_streams ORDER BY stream_name ASC');
    res.json(result.rows);
  } catch (error) {
    console.error('Erro ao buscar relay streams:', error);
    res.status(500).json({ error: 'Erro ao buscar relay streams' });
  }
});

/**
 * @route POST /api/relay-streams
 * @desc Criar um novo relay stream
 * @access Private
 */
router.post('/', requireAuth, requireAdmin, async (req, res) => {
  const { stream_name, input_url, output_url } = req.body;

  try {
    const result = await pool.query(
      'INSERT INTO relay_streams (stream_name, input_url, output_url) VALUES ($1, $2, $3) RETURNING *',
      [stream_name, input_url, output_url]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Erro ao criar relay stream:', error);
    res.status(500).json({ error: 'Erro ao criar relay stream' });
  }
});

/**
 * @route PUT /api/relay-streams/:id
 * @desc Atualizar um relay stream
 * @access Private
 */
router.put('/:id', requireAuth, requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { stream_name, input_url, output_url } = req.body;

  try {
    const result = await pool.query(
      'UPDATE relay_streams SET stream_name = $1, input_url = $2, output_url = $3 WHERE id = $4 RETURNING *',
      [stream_name, input_url, output_url, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Relay stream não encontrado' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Erro ao atualizar relay stream:', error);
    res.status(500).json({ error: 'Erro ao atualizar relay stream' });
  }
});

/**
 * @route DELETE /api/relay-streams/:id
 * @desc Excluir um relay stream
 * @access Private
 */
router.delete('/:id', requireAuth, requireAdmin, async (req, res) => {
  const { id } = req.params;

  try {
    const result = await pool.query('DELETE FROM relay_streams WHERE id = $1 RETURNING *', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Relay stream não encontrado' });
    }

    res.json({ message: 'Relay stream excluído com sucesso' });
  } catch (error) {
    console.error('Erro ao excluir relay stream:', error);
    res.status(500).json({ error: 'Erro ao excluir relay stream' });
  }
});

export default router;