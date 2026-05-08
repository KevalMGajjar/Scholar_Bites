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
    const uniId = 'f6cc7c6c-9534-45c7-8658-8855f2ad087b';
    await pool.query(`
      INSERT INTO university_settings (university_id, group_order_visible_students, staff_access_code)
      VALUES ($1, false, '123456')
      ON CONFLICT (university_id) DO NOTHING
    `, [uniId]);
    console.log("Inserted settings record successfully.");
  } catch (err) {
    console.error(err);
  } finally {
    pool.end();
  }
}

run();
