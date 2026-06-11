import { Pool, types } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

// Return DATE columns (OID 1082) as plain 'YYYY-MM-DD' strings instead of JS Date
// objects. Otherwise pg interprets the date at the server's local midnight, which
// shifts the day by one once the server timezone isn't UTC (calendar off-by-one).
types.setTypeParser(1082, (val) => val);

// Fallback to hardcoded if env fails, but prefer env
const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:root@localhost:5432/canteen_db';

const pool = new Pool({
    connectionString,
    // Provide SSL config if we are connecting to a remote/AWS database
    ssl: connectionString.includes('localhost') ? false : { rejectUnauthorized: false }
});

export default pool;
