import { Pool } from 'pg';
import * as dotenv from 'dotenv';
import path from 'path';

// Explicitly load .env from the root of the backend folder
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL?.includes('localhost') ? false : { rejectUnauthorized: false }
});

async function main() {
    console.log('🌱 Starting Production Database Seed via pg...');

    if (!process.env.DATABASE_URL) {
        throw new Error('DATABASE_URL is missing in .env file');
    }

    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        // 1. Create Universities
        console.log('Creating Universities in Gujarat...');
        
        const universitiesData = [
            {
                name: 'Ahmedabad University',
                logo_url: 'https://upload.wikimedia.org/wikipedia/en/thumb/9/91/Ahmedabad_University_Logo.svg/1200px-Ahmedabad_University_Logo.svg.png',
                address: 'Navrangpura, Ahmedabad, Gujarat 380009',
                latitude: 23.0374,
                longitude: 72.5411
            },
            {
                name: 'Gujarat University',
                logo_url: 'https://upload.wikimedia.org/wikipedia/en/thumb/4/4c/Gujarat_University_Logo.svg/1200px-Gujarat_University_Logo.svg.png',
                address: 'Navrangpura, Ahmedabad, Gujarat 380009',
                latitude: 23.0360,
                longitude: 72.5448
            },
            {
                name: 'Nirma University',
                logo_url: 'https://upload.wikimedia.org/wikipedia/en/a/a4/Nirma_University_Logo.png',
                address: 'Sarkhej - Gandhinagar Hwy, Ahmedabad, Gujarat 382481',
                latitude: 23.1287,
                longitude: 72.5401
            },
            {
                name: 'Maharaja Sayajirao University of Baroda (MSU)',
                logo_url: 'https://upload.wikimedia.org/wikipedia/en/thumb/c/ca/Maharaja_Sayajirao_University_of_Baroda_logo.svg/1200px-Maharaja_Sayajirao_University_of_Baroda_logo.svg.png',
                address: 'Pratapgunj, Vadodara, Gujarat 390002',
                latitude: 22.3015,
                longitude: 73.1815
            },
            {
                name: 'IIT Gandhinagar',
                logo_url: 'https://upload.wikimedia.org/wikipedia/en/thumb/9/93/Indian_Institute_of_Technology_Gandhinagar_Logo.svg/1200px-Indian_Institute_of_Technology_Gandhinagar_Logo.svg.png',
                address: 'Palaj, Gandhinagar, Gujarat 382355',
                latitude: 23.2114,
                longitude: 72.6842
            },
            {
                name: 'DA-IICT',
                logo_url: 'https://upload.wikimedia.org/wikipedia/en/thumb/3/30/DA-IICT_logo.svg/1200px-DA-IICT_logo.svg.png',
                address: 'Reliance Cross Rd, Gandhinagar, Gujarat 382007',
                latitude: 23.1885,
                longitude: 72.6283
            },
            {
                name: 'SVNIT Surat',
                logo_url: 'https://upload.wikimedia.org/wikipedia/en/thumb/d/d8/National_Institute_of_Technology%2C_Surat_Logo.png/1200px-National_Institute_of_Technology%2C_Surat_Logo.png',
                address: 'Ichchhanath, Surat, Gujarat 395007',
                latitude: 21.1664,
                longitude: 72.7833
            },
            {
                name: 'Pandit Deendayal Energy University (PDEU)',
                logo_url: 'https://upload.wikimedia.org/wikipedia/en/thumb/f/f6/Pandit_Deendayal_Energy_University_logo.png/1200px-Pandit_Deendayal_Energy_University_logo.png',
                address: 'Knowledge Corridor, Raisan Village, Gandhinagar, Gujarat 382007',
                latitude: 23.1565,
                longitude: 72.6318
            },
            {
                name: 'CEPT University',
                logo_url: 'https://upload.wikimedia.org/wikipedia/en/thumb/9/9d/CEPT_University_logo.svg/1200px-CEPT_University_logo.svg.png',
                address: 'Kasturbhai Lalbhai Campus, University Road, Ahmedabad, Gujarat 380009',
                latitude: 23.0375,
                longitude: 72.5501
            },
            {
                name: 'Navrachana University',
                logo_url: 'https://upload.wikimedia.org/wikipedia/en/thumb/5/52/Navrachana_University_logo.png/1200px-Navrachana_University_logo.png',
                address: 'Bhaili, Vadodara, Gujarat 391410',
                latitude: 22.2882,
                longitude: 73.1368
            }
        ];

        let uniId;

        for (const uniData of universitiesData) {
            const uniResult = await client.query(`
                INSERT INTO universities (name, logo_url, address, latitude, longitude) 
                VALUES ($1, $2, $3, $4, $5)
                ON CONFLICT (name) DO UPDATE SET 
                    name = EXCLUDED.name,
                    logo_url = EXCLUDED.logo_url,
                    address = EXCLUDED.address,
                    latitude = EXCLUDED.latitude,
                    longitude = EXCLUDED.longitude
                RETURNING id;
            `, [uniData.name, uniData.logo_url, uniData.address, uniData.latitude, uniData.longitude]);
            
            // We'll attach the restaurants and menu items to Ahmedabad University specifically for the demo
            if (uniData.name === 'Ahmedabad University') {
                uniId = uniResult.rows[0].id;
            }
        }

        // 2. Create Restaurants
        console.log('Creating Restaurants...');
        const res1Result = await client.query(`
            INSERT INTO restaurants (university_id, name, logo_url, cover_url, rating, tags, prep_time_minutes)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING id;
        `, [
            uniId, 'Ahmedabad Canteen', 
            'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&q=80',
            'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&q=80',
            4.8, '{Fast Food, Beverages, Trending}', 15
        ]);
        const res1Id = res1Result.rows[0].id;

        const res2Result = await client.query(`
            INSERT INTO restaurants (university_id, name, logo_url, cover_url, rating, tags, prep_time_minutes)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING id;
        `, [
            uniId, 'Healthy Bytes',
            'https://images.unsplash.com/photo-1490645935967-10de6ba17061?auto=format&fit=crop&q=80',
            'https://images.unsplash.com/photo-1498837167922-41c543210196?auto=format&fit=crop&q=80',
            4.5, '{Healthy, Salads, Vegan}', 10
        ]);
        const res2Id = res2Result.rows[0].id;

        // 3. Create Menu Items
        console.log('Creating Menu Items...');
        
        // Fast Food Menu
        await client.query(`
            INSERT INTO menu_items (restaurant_id, name, description, price, category, image_url, stock_quantity)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
        `, [res1Id, 'Classic Burger', 'Juicy beef patty with fresh lettuce, tomatoes.', 150.00, 'Burger', 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&q=80', 50]);

        await client.query(`
            INSERT INTO menu_items (restaurant_id, name, description, price, category, image_url, stock_quantity)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
        `, [res1Id, 'Peri Peri Fries', 'Crispy french fries tossed in spicy peri peri mix.', 80.00, 'Snacks', 'https://images.unsplash.com/photo-1573080496597-1225bb156c70?auto=format&fit=crop&q=80', 100]);

        await client.query(`
            INSERT INTO menu_items (restaurant_id, name, description, price, category, image_url, stock_quantity)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
        `, [res1Id, 'Cold Coffee', 'Creamy and refreshing cold coffee.', 120.00, 'Drinks', 'https://images.unsplash.com/photo-1461023058943-07fcbe16d735?auto=format&fit=crop&q=80', 30]);

        // Healthy Bytes Menu
        await client.query(`
            INSERT INTO menu_items (restaurant_id, name, description, price, category, image_url, stock_quantity)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
        `, [res2Id, 'Avocado Toast', 'Mashed avocado on toasted sourdough bread.', 180.00, 'Healthy', 'https://images.unsplash.com/photo-1541519227354-08fa5d50c44d?auto=format&fit=crop&q=80', 20]);

        await client.query(`
            INSERT INTO menu_items (restaurant_id, name, description, price, category, image_url, stock_quantity)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
        `, [res2Id, 'Quinoa Salad', 'Fresh quinoa mixed with seasonal vegetables.', 200.00, 'Healthy', 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&q=80', 25]);

        await client.query('COMMIT');
        console.log('✅ Production Database Seeded Successfully!');
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
