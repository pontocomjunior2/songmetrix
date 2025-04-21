// Arquivo para registrar as rotas no servidor Express
import express from 'express';
import streamsRoutes from './routes/streams.js';
import uploadsRoutes from './routes/uploads.js';
import dashboardRoutes from './routes/dashboard.js';
import executionsRoutes from './routes/executions.js';
import radiosRoutes from './routes/radios.js';
import relayStreamsRoutes from './routes/relay-streams.js';
import usersRoutes from './routes/users.js';
import rankingRoutes from './ranking.js';
import paymentsRoutes from './routes/payments.js';
import customerRoutes from './routes/customerRoutes.js';
import path from 'path';
import { fileURLToPath } from 'url';
// Remover import de pg e Pool
// import pkg from 'pg'; 
// const { Pool } = pkg;
import { pool } from './db.js'; // <-- Importar pool de db.js

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Remover criação local do pool
// const pool = new Pool({
//   user: process.env.POSTGRES_USER,
//   host: process.env.POSTGRES_HOST,
//   database: process.env.POSTGRES_DB,
//   password: process.env.POSTGRES_PASSWORD,
//   port: process.env.POSTGRES_PORT,
// });

export default function registerRoutes(app) {
  // Servir arquivos estáticos da pasta uploads
  app.use('/uploads', express.static(path.join(__dirname, '..', 'public', 'uploads')));
  
  // Registrar as rotas de streams
  app.use('/api/streams', streamsRoutes);
  
  // Registrar as rotas de uploads
  app.use('/api/uploads', uploadsRoutes);
  
  // Registrar as rotas do dashboard
  app.use('/api/dashboard', dashboardRoutes);
  
  // Registrar as rotas de execuções
  app.use('/api/executions', executionsRoutes);
  
  // Registrar as rotas de rádios
  app.use('/api/radios', radiosRoutes);

  // Registrar as rotas de relay streams
  app.use('/api/relay-streams', relayStreamsRoutes);
  
  // Registrar as rotas de usuários
  app.use('/api/users', usersRoutes);
  
  // Registrar as rotas de ranking
  app.use('/api/ranking', rankingRoutes);
  
  // Registrar as rotas de pagamentos
  app.use('/api/payments', paymentsRoutes);
  
  // Registrar as novas rotas de cliente
  app.use('/api/customers', customerRoutes);
  
  // Rota de diagnóstico para verificar a conexão com o banco de dados
  app.get('/api/diagnostico', async (req, res) => {
    try {
      // Verificar a conexão com o banco de dados (usar pool importado)
      const dbResult = await pool.query('SELECT NOW() as time');
      
      // Verificar variáveis de ambiente
      const env = {
        NODE_ENV: process.env.NODE_ENV,
        VITE_ENV: process.env.VITE_ENV,
        POSTGRES_HOST: process.env.POSTGRES_HOST,
        POSTGRES_DB: process.env.POSTGRES_DB,
        POSTGRES_PORT: process.env.POSTGRES_PORT,
        VITE_SUPABASE_URL: process.env.VITE_SUPABASE_URL ? 'Configurado' : 'Não configurado',
        SUPABASE_URL: process.env.SUPABASE_URL ? 'Configurado' : 'Não configurado',
        VITE_API_BASE_URL: process.env.VITE_API_BASE_URL
      };
      
      res.json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        database: {
          connected: true,
          time: dbResult.rows[0].time
        },
        environment: env,
        routes: {
          streams: '/api/streams',
          uploads: '/api/uploads',
          dashboard: '/api/dashboard',
          executions: '/api/executions',
          radios: '/api/radios',
          relayStreams: '/api/relay-streams'
        }
      });
    } catch (error) {
      console.error('Erro no diagnóstico:', error);
      res.status(500).json({
        status: 'ERROR',
        timestamp: new Date().toISOString(),
        error: error.message,
        stack: process.env.NODE_ENV === 'production' ? null : error.stack
      });
    }
  });
  
  // Aqui podem ser registradas outras rotas no futuro
  
  console.log('Rotas registradas com sucesso');
}