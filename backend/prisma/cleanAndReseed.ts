/**
 * Database Cleanup Script
 * 
 * Wipes all duplicate restaurants & menu items, then re-seeds fresh data.
 * Run this ON the EC2 server: npx ts-node prisma/cleanAndReseed.ts
 */
import { Pool } from 'pg';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL?.includes('localhost') ? false : { rejectUnauthorized: false }
});

async function main() {
    console.log('🧹 Starting Database Cleanup...');
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        // ── Step 1: Show current counts ──
        const resBefore = await client.query('SELECT count(*) FROM restaurants');
        const menuBefore = await client.query('SELECT count(*) FROM menu_items');
        console.log(`📊 Before: ${resBefore.rows[0].count} restaurants, ${menuBefore.rows[0].count} menu items`);

        // ── Step 2: Delete ALL menu items and restaurants (clean slate) ──
        console.log('🗑️  Deleting all order_items...');
        await client.query('DELETE FROM order_items');
        
        console.log('🗑️  Deleting all orders...');
        await client.query('DELETE FROM orders');

        console.log('🗑️  Deleting all menu items...');
        await client.query('DELETE FROM menu_items');

        console.log('🗑️  Deleting all restaurants...');
        await client.query('DELETE FROM restaurants');

        // ── Step 3: Get the Ahmedabad University ID ──
        const uniResult = await client.query("SELECT id FROM universities WHERE name = 'Ahmedabad University' LIMIT 1");
        if (uniResult.rows.length === 0) {
            throw new Error('Ahmedabad University not found! Run the university seed first.');
        }
        const uniId = uniResult.rows[0].id;
        console.log(`🎓 Found Ahmedabad University: ${uniId}`);

        // ── Step 4: Re-create restaurants (exactly 2) ──
        console.log('🍽️  Creating restaurants...');
        const res1 = await client.query(`
            INSERT INTO restaurants (university_id, name, logo_url, cover_url, rating, tags, prep_time_minutes)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING id;
        `, [
            uniId, 'Ahmedabad Canteen',
            'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&q=80',
            'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&q=80',
            4.8, '{Fast Food, Beverages, Trending}', 15
        ]);
        const res1Id = res1.rows[0].id;

        const res2 = await client.query(`
            INSERT INTO restaurants (university_id, name, logo_url, cover_url, rating, tags, prep_time_minutes)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING id;
        `, [
            uniId, 'Healthy Bytes',
            'https://images.unsplash.com/photo-1490645935967-10de6ba17061?auto=format&fit=crop&q=80',
            'https://images.unsplash.com/photo-1498837167922-41c543210196?auto=format&fit=crop&q=80',
            4.5, '{Healthy, Salads, Vegan}', 10
        ]);
        const res2Id = res2.rows[0].id;

        // ── Step 5: Re-create menu items (exactly 5) ──
        console.log('🍔 Creating menu items...');
        const menuItems = [
            [res1Id, 'Classic Burger', 'Juicy beef patty with fresh lettuce, tomatoes.', 150.00, 'Burger', 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&q=80', 50],
            [res1Id, 'Peri Peri Fries', 'Crispy french fries tossed in spicy peri peri mix.', 80.00, 'Snacks', 'https://images.unsplash.com/photo-1573080496597-1225bb156c70?auto=format&fit=crop&q=80', 100],
            [res1Id, 'Cold Coffee', 'Creamy and refreshing cold coffee.', 120.00, 'Drinks', 'https://images.unsplash.com/photo-1461023058943-07fcbe16d735?auto=format&fit=crop&q=80', 30],
            [res2Id, 'Avocado Toast', 'Mashed avocado on toasted sourdough bread.', 180.00, 'Healthy', 'https://images.unsplash.com/photo-1541519227354-08fa5d50c44d?auto=format&fit=crop&q=80', 20],
            [res2Id, 'Quinoa Salad', 'Fresh quinoa mixed with seasonal vegetables.', 200.00, 'Healthy', 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&q=80', 25],
        ];

        for (const item of menuItems) {
            await client.query(`
                INSERT INTO menu_items (restaurant_id, name, description, price, category, image_url, stock_quantity)
                VALUES ($1, $2, $3, $4, $5, $6, $7)
            `, item);
        }

        // ── Step 6: Add unique constraints to prevent future dupes ──
        console.log('🔒 Adding unique constraints...');
        try {
            await client.query('ALTER TABLE restaurants ADD CONSTRAINT unique_restaurant_per_university UNIQUE (university_id, name)');
        } catch (e: any) {
            if (e.code === '42710') console.log('   ↳ Restaurant constraint already exists, skipping.');
            else throw e;
        }
        try {
            await client.query('ALTER TABLE menu_items ADD CONSTRAINT unique_menu_item_per_restaurant UNIQUE (restaurant_id, name)');
        } catch (e: any) {
            if (e.code === '42710') console.log('   ↳ Menu item constraint already exists, skipping.');
            else throw e;
        }

        await client.query('COMMIT');

        // ── Step 7: Verify ──
        const resAfter = await client.query('SELECT count(*) FROM restaurants');
        const menuAfter = await client.query('SELECT count(*) FROM menu_items');
        console.log(`\n✅ Done! After: ${resAfter.rows[0].count} restaurants, ${menuAfter.rows[0].count} menu items`);
        console.log('🎉 Database is clean and deduplicated!');

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('❌ Error:', error);
    } finally {
        client.release();
    }
}

main()
    .catch(e => { console.error(e); process.exit(1); })
    .finally(() => pool.end());
