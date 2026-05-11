const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function main() {
  try {
    await pool.query('ALTER TABLE users ADD COLUMN email VARCHAR(255) UNIQUE;');
    console.log('Added email column to users table successfully');
  } catch (error) {
    if (error.code === '42701') {
      console.log('Column email already exists');
    } else {
      console.error('Error adding column:', error);
    }
  } finally {
    await pool.end();
  }
}

main();
