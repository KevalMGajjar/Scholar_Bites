import { Pool } from 'pg';
import bcrypt from 'bcrypt';
import dotenv from 'dotenv';
import path from 'path';

// Ensure .env is loaded from the backend root, not from CWD
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:root@localhost:5432/canteen_db';

console.log('🔗 Connecting to:', connectionString.replace(/:[^:@]+@/, ':***@')); // Log masked URL

const pool = new Pool({
    connectionString,
    ssl: connectionString.includes('localhost') ? false : { rejectUnauthorized: false },
});

async function seedStaff() {
    const client = await pool.connect();
    try {
        // Get the first university
        const uniResult = await client.query('SELECT id, name FROM universities LIMIT 1');
        if (uniResult.rows.length === 0) {
            console.error('❌ No universities found. Please seed universities first.');
            return;
        }
        const university = uniResult.rows[0];
        console.log(`📍 Using university: ${university.name} (${university.id})`);

        // Check if staff table has 'phone' column
        const colCheck = await client.query(`
            SELECT column_name FROM information_schema.columns 
            WHERE table_name = 'staff' AND column_name = 'phone'
        `);
        const hasPhone = colCheck.rows.length > 0;
        if (!hasPhone) {
            console.log('📝 Adding phone column to staff table...');
            await client.query('ALTER TABLE staff ADD COLUMN IF NOT EXISTS phone VARCHAR(15)');
        }

        // Create admin user
        const adminPasswordHash = await bcrypt.hash('admin123', 10);
        await client.query(
            `INSERT INTO staff (email, password_hash, name, role, university_id, phone)
             VALUES ($1, $2, $3, $4, $5, $6)
             ON CONFLICT (email) DO UPDATE SET password_hash = $2, name = $3, role = $4`,
            ['admin@scholarbites.in', adminPasswordHash, 'Admin User', 'admin', university.id, '9999999999']
        );
        console.log('✅ Admin user created: admin@scholarbites.in / admin123');

        // Create staff user
        const staffPasswordHash = await bcrypt.hash('staff123', 10);
        await client.query(
            `INSERT INTO staff (email, password_hash, name, role, university_id, phone)
             VALUES ($1, $2, $3, $4, $5, $6)
             ON CONFLICT (email) DO UPDATE SET password_hash = $2, name = $3, role = $4`,
            ['staff@scholarbites.in', staffPasswordHash, 'Staff Member', 'staff', university.id, '8888888888']
        );
        console.log('✅ Staff user created: staff@scholarbites.in / staff123');

        console.log('\n🎉 Staff seeding complete! You can now log into the admin panel.');
    } catch (error) {
        console.error('❌ Error seeding staff:', error);
    } finally {
        client.release();
        await pool.end();
    }
}

seedStaff();
