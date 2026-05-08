const { Pool } = require('pg');

const pool = new Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'canteen_db',
  password: 'root',
  port: 5432,
});

async function run() {
  try {
    const result = await pool.query('SELECT * FROM university_settings');
    console.log("Settings:", JSON.stringify(result.rows, null, 2));
  } catch (err) {
    console.error(err);
  } finally {
    pool.end();
  }
}

run();
