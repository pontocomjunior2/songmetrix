import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: path.join(dirname(__dirname), '.env') });

const { Pool } = pg;

const pool = new Pool({
  user: process.env.POSTGRES_USER,
  host: process.env.POSTGRES_HOST,
  database: process.env.POSTGRES_DB,
  password: process.env.POSTGRES_PASSWORD,
  port: parseInt(process.env.POSTGRES_PORT),
  ssl: {
    rejectUnauthorized: false
  }
});

async function addColumn() {
  try {
    // Adicionar coluna se não existir
    await pool.query(`
      ALTER TABLE music_log
      ADD COLUMN IF NOT EXISTS abbreviation varchar(3);
    `);
    console.log('Coluna abbreviation adicionada com sucesso');

    // Criar índice
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_music_log_name 
      ON music_log(name);
    `);
    console.log('Índice criado com sucesso');

    // Preencher abreviações padrão
    await pool.query(`
      UPDATE music_log
      SET abbreviation = UPPER(SUBSTRING(name, 1, 3))
      WHERE abbreviation IS NULL;
    `);
    console.log('Abreviações padrão preenchidas com sucesso');

  } catch (error) {
    console.error('Erro:', error);
  } finally {
    await pool.end();
  }
}

addColumn();
