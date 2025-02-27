import pg from 'pg';

const { Pool } = pg;

const pool = new Pool({
  user: 'postgres',
  host: 'songmetrix.com.br',
  database: 'music_log',
  password: 'Conquista@@2',
  port: 5432,
  ssl: {
    rejectUnauthorized: false
  }
});

async function checkDates() {
  try {
    // Get the most recent records with their dates
    const result = await pool.query(`
      SELECT 
        id,
        date,
        time,
        name as radio_name,
        artist,
        song_title
      FROM music_log 
      ORDER BY date DESC, time DESC 
      LIMIT 5;
    `);
    
    console.log('Most recent records:', result.rows);

    // Get the date range in the database
    const dateRange = await pool.query(`
      SELECT 
        MIN(date) as min_date,
        MAX(date) as max_date,
        COUNT(DISTINCT date) as unique_dates
      FROM music_log;
    `);
    
    console.log('\nDate range:', dateRange.rows[0]);

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await pool.end();
  }
}

checkDates();
