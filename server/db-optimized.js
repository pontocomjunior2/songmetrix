import pkg from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Carregar variáveis de ambiente
dotenv.config({ path: path.join(__dirname, '.env') });
dotenv.config({ path: path.join(dirname(__dirname), '.env') });

const { Pool } = pkg;

// Configuração otimizada do pool de conexões para evitar locks
const poolConfig = {
  user: process.env.POSTGRES_USER,
  host: process.env.POSTGRES_HOST,
  database: process.env.POSTGRES_DB,
  password: process.env.POSTGRES_PASSWORD,
  port: parseInt(process.env.POSTGRES_PORT || '5432'),
  
  // Configurações de pool otimizadas
  max: 20,                    // Máximo de conexões no pool
  min: 2,                     // Mínimo de conexões no pool
  idleTimeoutMillis: 30000,   // 30 segundos para conexões inativas
  connectionTimeoutMillis: 10000, // 10 segundos para estabelecer conexão
  
  // Configurações de SSL
  ssl: {
    rejectUnauthorized: false
  },
  
  // Configurações de statement timeout
  statement_timeout: 30000,   // 30 segundos
  query_timeout: 30000,       // 30 segundos
  
  // Configurações de aplicação para identificação
  application_name: 'songmetrix-api'
};

console.log('[db-optimized.js] Inicializando pool de conexões otimizado:', {
    user: poolConfig.user,
    host: poolConfig.host,
    database: poolConfig.database,
    port: poolConfig.port,
    max_connections: poolConfig.max,
    min_connections: poolConfig.min,
    idle_timeout: poolConfig.idleTimeoutMillis,
    connection_timeout: poolConfig.connectionTimeoutMillis
});

export const pool = new Pool(poolConfig);

// Eventos do pool para monitoramento
pool.on('connect', (client) => {
  console.log(`[db-optimized.js] Nova conexão estabelecida. Total ativo: ${pool.totalCount}, Idle: ${pool.idleCount}`);
  
  // Configurar timeout para esta conexão específica
  client.query('SET statement_timeout = 30000');
  client.query('SET lock_timeout = 10000');
  client.query('SET idle_in_transaction_session_timeout = 60000');
});

pool.on('acquire', (client) => {
  console.log(`[db-optimized.js] Conexão adquirida. Total ativo: ${pool.totalCount}, Idle: ${pool.idleCount}`);
});

pool.on('release', (client) => {
  console.log(`[db-optimized.js] Conexão liberada. Total ativo: ${pool.totalCount}, Idle: ${pool.idleCount}`);
});

pool.on('error', (err, client) => {
  console.error('[db-optimized.js] Erro inesperado no pool:', err);
  
  // Tentar reconectar se for um erro de conexão
  if (err.code === 'ECONNRESET' || err.code === 'ENOTFOUND') {
    console.log('[db-optimized.js] Tentando reconectar...');
    setTimeout(() => {
      pool.end().then(() => {
        console.log('[db-optimized.js] Pool encerrado, recriando...');
        // Recriar o pool
        Object.assign(pool, new Pool(poolConfig));
      }).catch(console.error);
    }, 5000);
  }
});

// Função para executar queries com retry e timeout
export const safeQuery = async (query, params = [], options = {}) => {
  const {
    retries = 3,
    timeout = 30000,
    client = null
  } = options;
  
  let lastError = null;
  
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const startTime = Date.now();
      
      // Usar cliente específico ou obter do pool
      const queryClient = client || pool;
      
      // Executar query com timeout
      const result = await Promise.race([
        queryClient.query(query, params),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Query timeout')), timeout)
        )
      ]);
      
      const duration = Date.now() - startTime;
      
      // Log de queries lentas
      if (duration > 1000) {
        console.warn(`[db-optimized.js] Query lenta detectada (${duration}ms):`, {
          query: query.substring(0, 100) + '...',
          params: params.length > 0 ? 'Com parâmetros' : 'Sem parâmetros',
          duration
        });
      }
      
      return result;
      
    } catch (error) {
      lastError = error;
      console.error(`[db-optimized.js] Erro na tentativa ${attempt + 1}/${retries}:`, {
        error: error.message,
        code: error.code,
        query: query.substring(0, 100) + '...'
      });
      
      // Se for timeout, não tentar novamente
      if (error.message === 'Query timeout') {
        break;
      }
      
      // Esperar antes de tentar novamente (backoff exponencial)
      if (attempt < retries - 1) {
        const delay = Math.pow(2, attempt) * 1000; // 1s, 2s, 4s
        console.log(`[db-optimized.js] Aguardando ${delay}ms antes da próxima tentativa...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  console.error(`[db-optimized.js] Todas as ${retries} tentativas falharam. Último erro:`, lastError);
  throw lastError;
};

// Função para executar transações com timeout
export const withTransaction = async (callback, options = {}) => {
  const {
    timeout = 30000,
    isolationLevel = 'READ COMMITTED'
  } = options;
  
  const client = await pool.connect();
  
  try {
    // Configurar timeout para esta transação
    await client.query(`SET statement_timeout = ${timeout}`);
    await client.query(`SET lock_timeout = ${timeout / 3}`);
    await client.query(`SET TRANSACTION ISOLATION LEVEL ${isolationLevel}`);
    
    await client.query('BEGIN');
    
    const result = await callback(client);
    
    await client.query('COMMIT');
    
    return result;
    
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

// Função para verificar saúde do pool
export const checkPoolHealth = () => {
  return {
    total: pool.totalCount,
    idle: pool.idleCount,
    waiting: pool.waitingCount,
    healthy: pool.totalCount > 0 && pool.idleCount >= pool.min
  };
};

// Função para limpar conexões inativas
export const cleanupIdleConnections = async () => {
  try {
    const health = checkPoolHealth();
    console.log('[db-optimized.js] Saúde do pool:', health);
    
    // Se há muitas conexões inativas, forçar cleanup
    if (health.idle > health.total * 0.7) {
      console.log('[db-optimized.js] Muitas conexões inativas, forçando cleanup...');
      await pool.end();
      console.log('[db-optimized.js] Pool encerrado para cleanup');
    }
  } catch (error) {
    console.error('[db-optimized.js] Erro no cleanup:', error);
  }
};

// Testar conexão ao iniciar
pool.connect((err, client, release) => {
  if (err) {
    return console.error('[db-optimized.js] Erro ao adquirir cliente', err.stack);
  }
  
  client.query('SELECT NOW()', (err, result) => {
    release();
    if (err) {
      return console.error('[db-optimized.js] Erro ao executar query', err.stack);
    }
    console.log('[db-optimized.js] Conexão com banco bem-sucedida. Hora do servidor:', result.rows[0].now);
  });
});

// Configurar cleanup periódico
setInterval(cleanupIdleConnections, 5 * 60 * 1000); // A cada 5 minutos

export default pool;
