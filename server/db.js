import pkg from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Carregar variáveis de ambiente (redundante se já carregado em server.js, mas garante independência)
dotenv.config({ path: path.join(__dirname, '.env') });
dotenv.config({ path: path.join(dirname(__dirname), '.env') }); // Tentar nível acima também

const { Pool } = pkg;

// Configuração da conexão com o banco de dados
const poolConfig = {
  user: process.env.POSTGRES_USER,
  host: process.env.POSTGRES_HOST,
  database: process.env.POSTGRES_DB,
  password: process.env.POSTGRES_PASSWORD,
  port: parseInt(process.env.POSTGRES_PORT || '5432'),
  ssl: {
    // Ajuste conforme a configuração do seu servidor PostgreSQL
    // rejectUnauthorized: false // Use com cautela, apenas se necessário e seguro
    // Em produção, considere usar certificados:
    // ca: fs.readFileSync('path/to/server-ca.pem').toString(),
    // key: fs.readFileSync('path/to/client-key.pem').toString(),
    // cert: fs.readFileSync('path/to/client-cert.pem').toString(),
    rejectUnauthorized: false // FORÇADO para false para aceitar certificado autoassinado (Ver Aviso de Segurança)
  }
};

console.log('[db.js] Initializing database pool with config:', {
    user: poolConfig.user,
    host: poolConfig.host,
    database: poolConfig.database,
    port: poolConfig.port,
    ssl_rejectUnauthorized: poolConfig.ssl.rejectUnauthorized
});

export const pool = new Pool(poolConfig);

// Opcional: Testar conexão ao iniciar
pool.connect((err, client, release) => {
  if (err) {
    return console.error('[db.js] Error acquiring client', err.stack);
  }
  client.query('SELECT NOW()', (err, result) => {
    release();
    if (err) {
      return console.error('[db.js] Error executing query', err.stack);
    }
    console.log('[db.js] Database connection successful. Server time:', result.rows[0].now);
  });
});

export default pool; // Exportar como default também, se preferir 