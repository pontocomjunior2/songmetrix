import pg from 'pg';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: path.join(dirname(__dirname), '.env') });

const { Pool } = pg;

const pool = new Pool({
  user: process.env.VITE_DB_USER,
  host: process.env.VITE_DB_HOST,
  database: process.env.VITE_DB_NAME,
  password: process.env.VITE_DB_PASSWORD,
  port: parseInt(process.env.VITE_DB_PORT || '5432'),
  ssl: {
    rejectUnauthorized: false
  }
});

async function setupDatabase() {
  try {
    // Create the executions table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS executions (
        id bigint PRIMARY KEY,
        date date NOT NULL,
        time time NOT NULL,
        radio_name text NOT NULL,
        artist text NOT NULL,
        song_title text NOT NULL,
        isrc text,
        city text,
        state text,
        genre text,
        created_at timestamptz DEFAULT now()
      );
    `);
    console.log('Table created successfully');

    // Insert some sample data
    await pool.query(`
      INSERT INTO executions (id, date, time, radio_name, artist, song_title, isrc, city, state, genre)
      VALUES 
        (1, '2024-02-13', '10:00:00', 'Radio 1', 'Artist 1', 'Song 1', 'ISRC1', 'City 1', 'State 1', 'Genre 1'),
        (2, '2024-02-13', '11:00:00', 'Radio 2', 'Artist 2', 'Song 2', 'ISRC2', 'City 2', 'State 2', 'Genre 2')
      ON CONFLICT (id) DO NOTHING;
    `);
    console.log('Sample data inserted successfully');

  } catch (error) {
    console.error('Error setting up database:', error);
  } finally {
    await pool.end();
  }
}

setupDatabase();
