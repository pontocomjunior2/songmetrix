// Arquivo para registrar as rotas no servidor Express
import express from 'express';
import streamsRoutes from './routes/streams.js';

export default function registerRoutes(app) {
  // Registrar as rotas de streams
  app.use('/api/streams', streamsRoutes);
  
  // Aqui podem ser registradas outras rotas no futuro
  
  console.log('Rotas registradas com sucesso');
} 