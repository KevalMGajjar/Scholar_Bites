const { Client } = require('pg');
require('dotenv').config();

const client = new Client({
    connectionString: process.env.DATABASE_URL,
});

async function testConnection() {
    try {
        await client.connect();
        console.log('Connected successfully to PostgreSQL!');
        const res = await client.query('SELECT NOW()');
        console.log('Current time:', res.rows[0]);
        await client.end();
    } catch (err) {
        console.error('Connection error:', err);
        await client.end();
    }
}

testConnection();
