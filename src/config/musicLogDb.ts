/**
 * Configuração da conexão com o banco de dados music_log
 * Para consultas analíticas de execuções musicais
 */

import { Pool } from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Carregar variáveis de ambiente
const envPaths = [
  path.join(dirname(dirname(__dirname)), '.env.production'),
  path.join(dirname(dirname(__dirname)), '.env'),
];

for (const envPath of envPaths) {
  const result = dotenv.config({ path: envPath });
  if (result.error === undefined) {
    console.log('[MusicLogDb] Loaded environment variables from:', envPath);
    break;
  }
}

// Configuração da pool de conexão para music_log
const musicLogDbConfig = {
  user: process.env.POSTGRES_USER || 'postgres',
  host: process.env.POSTGRES_HOST || 'localhost',
  database: process.env.POSTGRES_DB || 'music_log',
  password: process.env.POSTGRES_PASSWORD,
  port: parseInt(process.env.POSTGRES_PORT || '5432'),
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  max: 10, // Máximo de conexões na pool
  idleTimeoutMillis: 30000, // Tempo limite para conexões inativas
  connectionTimeoutMillis: 2000, // Tempo limite para estabelecer conexão
};

// Criar pool de conexão
export const musicLogDbPool = new Pool(musicLogDbConfig);

// Log da configuração (sem mostrar senha)
console.log('[MusicLogDb] Pool configuration:', {
  user: musicLogDbConfig.user,
  host: musicLogDbConfig.host,
  database: musicLogDbConfig.database,
  port: musicLogDbConfig.port,
  ssl: !!musicLogDbConfig.ssl
});

// Tratamento de erros da pool
musicLogDbPool.on('error', (err) => {
  console.error('[MusicLogDb] Pool error:', err);
});

// Função para testar a conexão
export const testMusicLogConnection = async (): Promise<boolean> => {
  try {
    const client = await musicLogDbPool.connect();
    await client.query('SELECT 1');
    client.release();
    console.log('[MusicLogDb] Connection test successful');
    return true;
  } catch (error) {
    console.error('[MusicLogDb] Connection test failed:', error);
    return false;
  }
};

// Função para fechar a pool quando necessário
export const closeMusicLogPool = async (): Promise<void> => {
  try {
    await musicLogDbPool.end();
    console.log('[MusicLogDb] Pool closed successfully');
  } catch (error) {
    console.error('[MusicLogDb] Error closing pool:', error);
  }
};