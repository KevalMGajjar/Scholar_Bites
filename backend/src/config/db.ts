import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

// Fallback to hardcoded if env fails, but prefer env
const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:root@localhost:5432/canteen_db';

const pool = new Pool({
    connectionString,
});

export default pool;
