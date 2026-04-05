import { PrismaClient } from '@prisma/client';
import { AHMEDABAD_UNIVERSITY_ID } from '../config/constants';

const prisma = new PrismaClient();

async function main() {
    console.log('Seeding Event Management Restaurant...');

    // Create the restaurant
    const eventRestaurant = await prisma.restaurant.create({
        data: {
            university_id: AHMEDABAD_UNIVERSITY_ID,
            name: 'Event Management',
        },
    });

    console.log(`Created Restaurant: ${eventRestaurant.name} (ID: ${eventRestaurant.id})`);

    // Create the bulk items
    const bulkItems = [
        {
            restaurant_id: eventRestaurant.id,
            name: 'Bulk Samosas (50 pcs)',
            description: 'Fresh and crispy samosas for your club event.',
            price: 500.00,
            category: 'Snacks',
            image_url: 'https://images.unsplash.com/photo-1601050690597-df0568f70950?ixlib=rb-4.0.3&auto=format&fit=crop&w=500&q=60',
            is_available: true,
            stock_quantity: 999,
        },
        {
            restaurant_id: eventRestaurant.id,
            name: 'Standard Buffet Pax (100 people)',
            description: 'Full buffet catering including 2 starters, 2 mains, bread, and dessert.',
            price: 15000.00,
            category: 'Catering',
            image_url: 'https://images.unsplash.com/photo-1555244162-803834f70033?ixlib=rb-4.0.3&auto=format&fit=crop&w=500&q=60',
            is_available: true,
            stock_quantity: 999,
        },
        {
            restaurant_id: eventRestaurant.id,
            name: 'Beverage Crate (24 Cans)',
            description: 'Assorted cold beverages for quick refreshment.',
            price: 1200.00,
            category: 'Drinks',
            image_url: 'https://images.unsplash.com/photo-1622483767028-3f66f32aef97?ixlib=rb-4.0.3&auto=format&fit=crop&w=500&q=60',
            is_available: true,
            stock_quantity: 999,
        }
    ];

    for (const item of bulkItems) {
        const menuItem = await prisma.menuItem.create({ data: item });
        console.log(`Created Menu Item: ${menuItem.name}`);
    }

    console.log('Seeding complete! You can place orders to this restaurant via the app now.');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
