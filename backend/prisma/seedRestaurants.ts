import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding restaurants and menu items...');

  // Get first university (assume Ahmedabad University is seeded or we fetch whatever is there)
  const university = await prisma.university.findFirst();

  if (!university) {
    console.log('No university found. Please run main seed first.');
    return;
  }

  // 1. Create Restaurants
  const res1 = await prisma.restaurant.create({
    data: {
      university_id: university.id,
      name: 'Ahmedabad Canteen',
      logo_url: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&q=80',
      cover_url: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&q=80',
      rating: 4.8,
      tags: ['Fast Food', 'Beverages', 'Trending'],
    }
  });

  const res2 = await prisma.restaurant.create({
    data: {
      university_id: university.id,
      name: 'Healthy Bytes',
      logo_url: 'https://images.unsplash.com/photo-1490645935967-10de6ba17061?auto=format&fit=crop&q=80',
      cover_url: 'https://images.unsplash.com/photo-1498837167922-41c543210196?auto=format&fit=crop&q=80',
      rating: 4.5,
      tags: ['Healthy', 'Salads', 'Vegan'],
    }
  });

  // 2. Create Menu Items
  // Restaurant 1: Fast Food
  await prisma.menuItem.create({
    data: {
      restaurant_id: res1.id,
      name: 'Classic Burger',
      description: 'Juicy beef patty with fresh lettuce, tomatoes, and house sauce.',
      price: 150.00,
      category: 'Burger',
      image_url: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&q=80',
      stock_quantity: 50,
      nutritional_info: { calories: 550, weight: 200 }
    }
  });

  await prisma.menuItem.create({
    data: {
      restaurant_id: res1.id,
      name: 'Peri Peri Fries',
      description: 'Crispy french fries tossed in spicy peri peri mix.',
      price: 80.00,
      category: 'Snacks',
      image_url: 'https://images.unsplash.com/photo-1573080496597-1225bb156c70?auto=format&fit=crop&q=80',
      stock_quantity: 100,
      nutritional_info: { calories: 350, weight: 150 }
    }
  });

  await prisma.menuItem.create({
    data: {
      restaurant_id: res1.id,
      name: 'Cold Coffee',
      description: 'Creamy and refreshing cold coffee.',
      price: 120.00,
      category: 'Drinks',
      image_url: 'https://images.unsplash.com/photo-1461023058943-07fcbe16d735?auto=format&fit=crop&q=80',
      stock_quantity: 30,
      nutritional_info: { calories: 200, weight: 250 }
    }
  });

  // Restaurant 2: Healthy
  await prisma.menuItem.create({
    data: {
      restaurant_id: res2.id,
      name: 'Avocado Toast',
      description: 'Mashed avocado on toasted sourdough bread, topped with cherry tomatoes.',
      price: 180.00,
      category: 'Healthy',
      image_url: 'https://images.unsplash.com/photo-1541519227354-08fa5d50c44d?auto=format&fit=crop&q=80',
      stock_quantity: 20,
      nutritional_info: { calories: 300, weight: 180 }
    }
  });

  await prisma.menuItem.create({
    data: {
      restaurant_id: res2.id,
      name: 'Quinoa Salad',
      description: 'Fresh quinoa mixed with seasonal vegetables and lemon vinaigrette.',
      price: 200.00,
      category: 'Healthy',
      image_url: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&q=80',
      stock_quantity: 25,
      nutritional_info: { calories: 250, weight: 300 }
    }
  });

  console.log('Seed completed successfully.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
