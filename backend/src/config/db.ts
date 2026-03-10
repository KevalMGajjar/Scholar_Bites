import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

// Fallback to hardcoded if env fails, but prefer env
const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:root@localhost:5432/canteen_db';

const pool = new Pool({
    connectionString,
    // Provide SSL config if we are connecting to a remote/AWS database
    ssl: connectionString.includes('localhost') ? false : { rejectUnauthorized: false }
});

export default pool;
