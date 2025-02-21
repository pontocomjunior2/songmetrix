import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
  user: import.meta.env.VITE_POSTGRES_USER || process.env.POSTGRES_USER,
  host: import.meta.env.VITE_POSTGRES_HOST || process.env.POSTGRES_HOST,
  database: import.meta.env.VITE_POSTGRES_DB || process.env.POSTGRES_DB,
  password: import.meta.env.VITE_POSTGRES_PASSWORD || process.env.POSTGRES_PASSWORD,
  port: parseInt(import.meta.env.VITE_POSTGRES_PORT || process.env.POSTGRES_PORT || '5432'),
  ssl: {
    rejectUnauthorized: false
  }
});

export default pool;
