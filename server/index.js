// Arquivo para registrar as rotas no servidor Express
import express from 'express';
import streamsRoutes from './routes/streams.js';
import uploadsRoutes from './routes/uploads.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default function registerRoutes(app) {
  // Servir arquivos estáticos da pasta uploads
  app.use('/uploads', express.static(path.join(__dirname, '..', 'public', 'uploads')));
  
  // Registrar as rotas de streams
  app.use('/api/streams', streamsRoutes);
  
  // Registrar as rotas de uploads
  app.use('/api/uploads', uploadsRoutes);
  
  // Aqui podem ser registradas outras rotas no futuro
  
  console.log('Rotas registradas com sucesso');
} 