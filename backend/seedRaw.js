const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://postgres:root@localhost:5432/canteen_db',
});

async function main() {
  console.log('Seeding restaurants and menu items via PG...');

  try {
    const uniRes = await pool.query('SELECT id FROM universities LIMIT 1');
    if (uniRes.rows.length === 0) {
      console.log('No university found. Please create one first.');
      return;
    }
    const uniId = uniRes.rows[0].id;

    // Insert Restaurants
    const res1 = await pool.query(`
      INSERT INTO restaurants (university_id, name, logo_url, cover_url, rating, tags, is_open) 
      VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
      [uniId, 'Ahmedabad Canteen', 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&q=80', 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&q=80', 4.8, ['Fast Food', 'Beverages', 'Trending'], true]
    );

    const res2 = await pool.query(`
      INSERT INTO restaurants (university_id, name, logo_url, cover_url, rating, tags, is_open) 
      VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
      [uniId, 'Healthy Bytes', 'https://images.unsplash.com/photo-1490645935967-10de6ba17061?auto=format&fit=crop&q=80', 'https://images.unsplash.com/photo-1498837167922-41c543210196?auto=format&fit=crop&q=80', 4.5, ['Healthy', 'Salads', 'Vegan'], true]
    );

    const r1Id = res1.rows[0].id;
    const r2Id = res2.rows[0].id;

    // Insert Menu Items
    await pool.query(`
      INSERT INTO menu_items (restaurant_id, name, description, price, category, image_url, stock_quantity, nutritional_info)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    `, [r1Id, 'Classic Burger', 'Juicy beef patty with fresh lettuce', 150.00, 'Burger', 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&q=80', 50, JSON.stringify({calories: 550, weight: 200})]);

    await pool.query(`
      INSERT INTO menu_items (restaurant_id, name, description, price, category, image_url, stock_quantity, nutritional_info)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    `, [r1Id, 'Peri Peri Fries', 'Crispy french fries tossed in spicy peri peri mix.', 80.00, 'Snacks', 'https://images.unsplash.com/photo-1573080496597-1225bb156c70?auto=format&fit=crop&q=80', 100, JSON.stringify({calories: 350, weight: 150})]);

    await pool.query(`
      INSERT INTO menu_items (restaurant_id, name, description, price, category, image_url, stock_quantity, nutritional_info)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    `, [r2Id, 'Avocado Toast', 'Mashed avocado on toasted sourdough', 180.00, 'Healthy', 'https://images.unsplash.com/photo-1541519227354-08fa5d50c44d?auto=format&fit=crop&q=80', 20, JSON.stringify({calories: 300, weight: 180})]);

    console.log('Seed completed successfully via pg.');
  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}

main();
