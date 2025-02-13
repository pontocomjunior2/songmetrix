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

async function checkMusicLog() {
  try {
    // Get table structure
    console.log('Table structure:');
    const columns = await pool.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'music_log'
      ORDER BY ordinal_position;
    `);
    console.log(JSON.stringify(columns.rows, null, 2));

    // Get sample data
    console.log('\nSample data:');
    const sample = await pool.query('SELECT * FROM music_log ORDER BY id DESC LIMIT 2');
    console.log(JSON.stringify(sample.rows, null, 2));

    // Get count
    const count = await pool.query('SELECT COUNT(*) as total FROM music_log');
    console.log('\nTotal records:', count.rows[0].total);

    // Get distinct radio names
    const radios = await pool.query('SELECT DISTINCT radio_name FROM music_log ORDER BY radio_name LIMIT 5');
    console.log('\nSample radio names:', radios.rows.map(row => row.radio_name));

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await pool.end();
  }
}

checkMusicLog();
