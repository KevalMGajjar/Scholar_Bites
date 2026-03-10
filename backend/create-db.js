const { Client } = require('pg');

const client = new Client({
    connectionString: 'postgresql://postgres:root@localhost:5432/postgres',
});

async function createDB() {
    try {
        await client.connect();
        console.log('Connected to postgres DB.');

        // Check if db exists
        const res = await client.query("SELECT 1 FROM pg_database WHERE datname = 'canteen_db'");
        if (res.rowCount === 0) {
            console.log('Creating database canteen_db...');
            await client.query('CREATE DATABASE canteen_db');
            console.log('Database created successfully.');
        } else {
            console.log('Database canteen_db already exists.');
        }
    } catch (err) {
        console.error('Error creating database:', err);
    } finally {
        await client.end();
    }
}

createDB();
