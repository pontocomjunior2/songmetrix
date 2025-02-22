import express from 'express';
import cors from 'cors';
import pg from 'pg';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import path from 'path';
import { auth, db } from './firebase-admin.js';
import { reportQuery } from './report-query.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: path.join(dirname(__dirname), '.env') });

const app = express();

// Configure PostgreSQL connection
const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
});

app.use(cors());
app.use(express.json());

// Middleware de autenticação
const authenticateUser = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Token não fornecido' });
    }

    const token = authHeader.split('Bearer ')[1];
    const decodedToken = await auth.verifyIdToken(token);
    
    const userDoc = await db.collection('users').doc(decodedToken.uid).get();
    const userData = userDoc.data();

    if (!userData) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }

    if (!userData.paid) {
      return res.status(403).json({ error: 'Acesso não autorizado' });
    }

    req.user = { ...decodedToken, ...userData };
    next();
  } catch (error) {
    console.error('Erro na autenticação:', error);
    res.status(401).json({ error: 'Erro na autenticação' });
  }
};

// Endpoint para gerar relatórios
app.get('/api/report', authenticateUser, async (req, res) => {
  try {
    const { startDate, endDate, radios, limit } = req.query;

    if (!startDate || !endDate || !radios) {
      return res.status(400).json({ error: 'Parâmetros obrigatórios não fornecidos' });
    }

    const radioList = radios.split(',');
    const queryLimit = parseInt(limit) || 50;

    const result = await pool.query(reportQuery, [startDate, endDate, radioList, queryLimit]);
    res.json(result.rows);
  } catch (error) {
    console.error('Erro ao gerar relatório:', error);
    res.status(500).json({ error: 'Erro ao gerar relatório' });
  }
});

// Endpoint para status das rádios
app.get('/api/radios/status', authenticateUser, async (req, res) => {
  try {
    const query = `
      SELECT DISTINCT name, status
      FROM radio_status
      WHERE timestamp >= NOW() - INTERVAL '5 minutes'
    `;

    const result = await pool.query(query);
    const radioStatus = result.rows.map(row => ({
      name: row.name,
      status: row.status
    }));

    res.json(radioStatus);
  } catch (error) {
    console.error('Erro ao buscar status das rádios:', error);
    res.status(500).json({ error: 'Erro ao buscar status das rádios' });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

export default app;
