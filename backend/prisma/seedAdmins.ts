import { Pool } from 'pg';
import * as dotenv from 'dotenv';
import path from 'path';
import bcrypt from 'bcrypt';

// Explicitly load .env from the root of the backend folder
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL?.includes('localhost') ? false : { rejectUnauthorized: false }
});

const BCRYPT_ROUNDS = 12;

async function main() {
    console.log('🌱 Starting Admin/Staff Database Seed...');

    if (!process.env.DATABASE_URL) {
        throw new Error('DATABASE_URL is missing in .env file');
    }

    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        // 1. Get the university ID (Ahmedabad University)
        const uniResult = await client.query(`SELECT id FROM universities WHERE name = 'Ahmedabad University' LIMIT 1;`);
        if (uniResult.rows.length === 0) {
            throw new Error('Ahmedabad University not found. Run seedProduction.ts first.');
        }
        const uniId = uniResult.rows[0].id;

        const password = 'password123';
        const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

        console.log('Inserting Super Admin...');
        await client.query(`
            INSERT INTO staff (university_id, email, password_hash, name, role, permissions)
            VALUES ($1, $2, $3, $4, $5, $6)
            ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash
        `, [uniId, 'superadmin@scholarbites.com', passwordHash, 'Super Admin', 'super_admin', '{}']);

        console.log('Inserting Admin...');
        await client.query(`
            INSERT INTO staff (university_id, email, password_hash, name, role, permissions)
            VALUES ($1, $2, $3, $4, $5, $6)
            ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash
        `, [uniId, 'admin@scholarbites.com', passwordHash, 'Admin User', 'admin', '{}']);

        console.log('Inserting Dean...');
        await client.query(`
            INSERT INTO deans (university_id, email, password_hash, name, school_name, total_budget, used_budget)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash
        `, [uniId, 'dean@scholarbites.com', passwordHash, 'Dean John Doe', 'School of Engineering', 10000.00, 0.00]);

        await client.query('COMMIT');
        
        console.log('✅ Admins seeded successfully!');
        console.log('----------------------------------------------------');
        console.log('Super Admin Login : superadmin@scholarbites.com / password123');
        console.log('Admin Login       : admin@scholarbites.com / password123');
        console.log('Dean Login        : dean@scholarbites.com / password123');
        console.log('----------------------------------------------------');
        
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('❌ Error in Seeding:', error);
    } finally {
        client.release();
    }
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(() => {
        pool.end();
    });
