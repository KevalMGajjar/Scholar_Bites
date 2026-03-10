const { Client } = require('pg');

const configs = [
    { user: 'postgres', pass: 'root', db: 'postgres' },
    { user: 'postgres', pass: 'password', db: 'postgres' },
    { user: 'postgres', pass: 'admin', db: 'postgres' },
    { user: 'root', pass: 'root', db: 'postgres' },
    { user: 'admin', pass: 'admin', db: 'postgres' },
];

async function tryConnect(config) {
    const connectionString = `postgresql://${config.user}:${config.pass}@localhost:5432/${config.db}`;
    const client = new Client({ connectionString });
    try {
        await client.connect();
        console.log(`SUCCESS: Connected with User: ${config.user}, Pass: ${config.pass}`);
        await client.end();
        return true;
    } catch (err) {
        console.log(`FAILED: User: ${config.user}, Pass: ${config.pass} - ${err.message}`);
        await client.end();
        return false;
    }
}

async function run() {
    for (const config of configs) {
        if (await tryConnect(config)) {
            process.exit(0);
        }
    }
    console.log('All attempts failed.');
}

run();
