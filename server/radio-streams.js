import fs from 'fs/promises';
import path from 'path';
import { authenticateUser } from './auth-middleware.js';

const STREAMS_FILE = '/c/dataradio/finger/streams.json';

// Função para ler o arquivo streams.json
async function readStreamsFile() {
  try {
    const data = await fs.readFile(STREAMS_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Erro ao ler streams.json:', error);
    throw error;
  }
}

// Função para escrever no arquivo streams.json
async function writeStreamsFile(streams) {
  try {
    await fs.writeFile(STREAMS_FILE, JSON.stringify(streams, null, 2), 'utf8');
  } catch (error) {
    console.error('Erro ao escrever streams.json:', error);
    throw error;
  }
}

// Função para validar os dados da rádio
function validateRadio(radio) {
  const requiredFields = ['url', 'name', 'cidade', 'estado', 'regiao', 'segmento'];
  const missingFields = requiredFields.filter(field => !radio[field]);
  
  if (missingFields.length > 0) {
    throw new Error(`Campos obrigatórios faltando: ${missingFields.join(', ')}`);
  }
}

// Endpoints para manipulação das rádios
export const radioStreamsRoutes = (app) => {
  // Listar todas as rádios
  app.get('/api/radio-streams', authenticateUser, async (req, res) => {
    try {
      const streams = await readStreamsFile();
      res.json(streams);
    } catch (error) {
      console.error('Erro ao ler streams.json:', error);
      res.status(500).json({ error: 'Erro ao ler lista de rádios' });
    }
  });

  // Adicionar nova rádio
  app.post('/api/radio-streams', authenticateUser, async (req, res) => {
    try {
      validateRadio(req.body);
      const streams = await readStreamsFile();
      const newRadio = {
        ...req.body,
        index: streams.length.toString()
      };
      streams.push(newRadio);
      await writeStreamsFile(streams);
      res.json(newRadio);
    } catch (error) {
      console.error('Erro ao adicionar rádio:', error);
      res.status(500).json({ error: 'Erro ao adicionar rádio' });
    }
  });

  // Atualizar rádio existente
  app.put('/api/radio-streams/:index', authenticateUser, async (req, res) => {
    try {
      validateRadio(req.body);
      const { index } = req.params;
      const streams = await readStreamsFile();
      const radioIndex = streams.findIndex(r => r.index === index);
      
      if (radioIndex === -1) {
        return res.status(404).json({ error: 'Rádio não encontrada' });
      }

      streams[radioIndex] = { ...req.body, index };
      await writeStreamsFile(streams);
      res.json(streams[radioIndex]);
    } catch (error) {
      console.error('Erro ao atualizar rádio:', error);
      res.status(500).json({ error: 'Erro ao atualizar rádio' });
    }
  });

  // Remover rádio
  app.delete('/api/radio-streams/:index', authenticateUser, async (req, res) => {
    try {
      const { index } = req.params;
      const streams = await readStreamsFile();
      const filteredStreams = streams.filter(r => r.index !== index);
      
      // Reindexar as rádios restantes
      filteredStreams.forEach((radio, idx) => {
        radio.index = idx.toString();
      });

      await writeStreamsFile(filteredStreams);
      res.json({ success: true });
    } catch (error) {
      console.error('Erro ao remover rádio:', error);
      res.status(500).json({ error: 'Erro ao remover rádio' });
    }
  });
}; 