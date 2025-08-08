/**
 * Configuração da conexão com o banco de dados music_log
 * Para consultas analíticas de execuções musicais
 */

import pkg from 'pg';
const { Pool } = pkg;
import winston from 'winston';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Configuração do logger Winston
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    })
  ]
});

// Carregar variáveis de ambiente
const envPaths = [
  path.join(dirname(dirname(__dirname)), '.env.production'),
  path.join(dirname(dirname(__dirname)), '.env'),
];

for (const envPath of envPaths) {
  const result = dotenv.config({ path: envPath });
  if (result.error === undefined) {
    logger.info('[MusicLogDb] Loaded environment variables from:', envPath);
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
logger.info('[MusicLogDb] Pool configuration:', {
  user: musicLogDbConfig.user,
  host: musicLogDbConfig.host,
  database: musicLogDbConfig.database,
  port: musicLogDbConfig.port,
  ssl: !!musicLogDbConfig.ssl
});

// Tratamento de erros da pool
musicLogDbPool.on('error', (err) => {
  logger.error('[MusicLogDb] Pool error:', err);
});

// Função para testar a conexão
export const testMusicLogConnection = async () => {
  try {
    const client = await musicLogDbPool.connect();
    await client.query('SELECT 1');
    client.release();
    logger.info('[MusicLogDb] Connection test successful');
    return true;
  } catch (error) {
    logger.error('[MusicLogDb] Connection test failed:', error);
    return false;
  }
};

// Função para fechar a pool quando necessário
export const closeMusicLogPool = async () => {
  try {
    await musicLogDbPool.end();
    logger.info('[MusicLogDb] Pool closed successfully');
  } catch (error) {
    logger.error('[MusicLogDb] Error closing pool:', error);
  }
};