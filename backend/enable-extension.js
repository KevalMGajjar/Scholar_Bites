const { Client } = require('pg');

const client = new Client({
    connectionString: 'postgresql://postgres:root@localhost:5432/canteen_db',
});

async function enableExtension() {
    try {
        await client.connect();
        console.log('Connected to canteen_db.');
        await client.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp";');
        console.log('Extension uuid-ossp enabled.');
    } catch (err) {
        console.error('Error enabling extension:', err);
    } finally {
        await client.end();
    }
}

enableExtension();
