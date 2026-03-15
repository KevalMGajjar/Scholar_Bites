import { Pool } from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function checkTokens() {
    try {
        const res = await pool.query('SELECT id, email, fcm_token FROM users WHERE fcm_token IS NOT NULL');
        console.log(`Users with FCM token: ${res.rowCount}`);
        if (res.rowCount! > 0) {
            console.log(res.rows[0]);
        }
    } catch (e) {
        console.error('DB Error:', e);
    } finally {
        pool.end();
    }
}

checkTokens();
