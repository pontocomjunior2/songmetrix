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

async function testQuery() {
  try {
    // Get the most recent date
    const maxDateResult = await pool.query('SELECT MAX(date) as max_date FROM executions');
    console.log('Most recent date:', maxDateResult.rows[0].max_date);

    // Get the oldest date
    const minDateResult = await pool.query('SELECT MIN(date) as min_date FROM executions');
    console.log('Oldest date:', minDateResult.rows[0].min_date);

    // Get total count
    const countResult = await pool.query('SELECT COUNT(*) as total FROM executions');
    console.log('Total records:', countResult.rows[0].total);

    // Get sample of radio names
    const radiosResult = await pool.query('SELECT DISTINCT radio_name FROM executions LIMIT 5');
    console.log('Sample radio names:', radiosResult.rows.map(row => row.radio_name));

    // Get most recent records
    const recentResult = await pool.query('SELECT * FROM executions ORDER BY date DESC, time DESC LIMIT 2');
    console.log('Most recent records:', JSON.stringify(recentResult.rows, null, 2));

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await pool.end();
  }
}

testQuery();
