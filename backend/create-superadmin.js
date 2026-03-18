const { Pool } = require('pg');
const bcrypt = require('bcrypt');
require('dotenv').config();

// Connect using the same method as backend/src/config/db.ts
const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:root@localhost:5432/canteen_db';

const pool = new Pool({
    connectionString,
    ssl: connectionString.includes('localhost') ? false : { rejectUnauthorized: false }
});

async function main() {
    const email = 'kevalgajjarm@gmail.com';
    const password = 'Keval2004@@';
    
    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        
        // Find an existing university
        const uniRes = await pool.query('SELECT id FROM universities LIMIT 1');
        const uniId = uniRes.rows.length > 0 ? uniRes.rows[0].id : null;

        if (!uniId) {
            console.log('Error: You need at least one University in the database first.');
            return;
        }

        // Insert the Super Admin (handled gracefully if it already exists)
        await pool.query(
            `INSERT INTO staff (email, password_hash, name, role, university_id)
             VALUES ($1, $2, $3, $4, $5)
             ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash`,
            [email, hashedPassword, 'Keval Gajjar', 'super_admin', uniId]
        );
        
        console.log(`✅ Super Admin created successfully using raw PG!`);
        console.log(`📧 Email: ${email}`);
        console.log(`🔑 Password: ${password}`);
    } catch (err) {
        console.error('Error creating superadmin:', err.message || err);
    } finally {
        await pool.end();
    }
}

main();
