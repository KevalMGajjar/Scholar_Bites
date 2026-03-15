import { verifyToken } from './src/utils/jwt';
import pool from './src/config/db';
import dotenv from 'dotenv';
dotenv.config();

async function testToken() {
    try {
        const res = await pool.query("SELECT active_token FROM users LIMIT 1");
        if (res.rowCount === 0) {
            console.log("No users found");
            process.exit(0);
        }
        console.log("Found an active token hash in DB:", res.rows[0].active_token);
        console.log("Testing complete");
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}
testToken();
