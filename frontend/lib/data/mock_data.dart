import '../models/food_item.dart';
import '../models/restaurant_model.dart';

// Dummy Data - Food Items
final List<FoodItem> allFoodItems = [
  const FoodItem(
    id: '1',
    name: 'Beet Leaf Bowl',
    imageUrl:
        'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?ixlib=rb-4.0.3&auto=format&fit=crop&w=1740&q=80',
    price: 24.00,
    calories: 434,
    weight: 200,
    description: 'A fresh mix of beet leaves, spinach, and organic vegetables.',
    category: 'Special',
  ),
  const FoodItem(
    id: '2',
    name: 'Avocado Toast',
    imageUrl:
        'https://images.unsplash.com/photo-1588137372308-15f75323a51d?ixlib=rb-4.0.3&auto=format&fit=crop&w=870&q=80',
    price: 18.50,
    calories: 320,
    weight: 150,
    description: 'Toasted sourdough bread topped with creamy smashed avocado.',
    category: 'Breakfast',
  ),
  const FoodItem(
    id: '3',
    name: 'Butter Chicken',
    imageUrl:
        'https://images.unsplash.com/photo-1603894584373-5ac82b2ae398?ixlib=rb-4.0.3&auto=format&fit=crop&w=1740&q=80',
    price: 16.00,
    calories: 600,
    weight: 350,
    description: 'Classic rich creamy tomato curry with tender chicken pieces.',
    category: 'Indian',
  ),
  const FoodItem(
    id: '4',
    name: 'Paneer Tikka',
    imageUrl:
        'https://images.unsplash.com/photo-1567188040759-fb8a883dc6d8?ixlib=rb-4.0.3&auto=format&fit=crop&w=1740&q=80',
    price: 14.00,
    calories: 450,
    weight: 300,
    description: 'Spiced and grilled cottage cheese cubes with veggies.',
    category: 'Indian',
  ),
  const FoodItem(
    id: '5',
    name: 'Pasta Carbonara',
    imageUrl:
        'https://images.unsplash.com/photo-1612874742237-6526221588e3?ixlib=rb-4.0.3&auto=format&fit=crop&w=1740&q=80',
    price: 22.00,
    calories: 550,
    weight: 300,
    description: 'Creamy pasta with pancetta, egg, and cheese.',
    category: 'Italian',
  ),
  const FoodItem(
    id: '6',
    name: 'Tiramisu',
    imageUrl:
        'https://images.unsplash.com/photo-1571877227200-a0d98ea607e9?ixlib=rb-4.0.3&auto=format&fit=crop&w=870&q=80',
    price: 12.00,
    calories: 400,
    weight: 150,
    description: 'Classic Italian coffee-flavored dessert.',
    category: 'Dessert',
  ),
  const FoodItem(
    id: '7',
    name: 'Croissant',
    imageUrl:
        'https://images.unsplash.com/photo-1555507036-ab1f4038808a?ixlib=rb-4.0.3&auto=format&fit=crop&w=1526&q=80',
    price: 5.00,
    calories: 250,
    weight: 80,
    description: 'Buttery, flaky, and golden-brown French pastry.',
    category: 'French',
  ),
];

// Restaurants
final List<Restaurant> allRestaurants = [
  Restaurant(
    id: 'r1',
    name: 'Truly Indian',
    imageUrl:
        'https://images.unsplash.com/photo-1585937421612-70a008356f36?ixlib=rb-4.0.3&auto=format&fit=crop&w=1740&q=80',
    rating: 4.8,
    tags: ['Spicy', 'Curry', 'Tandoor'],
    menu: allFoodItems
        .where((i) => i.category == 'Indian' || i.category == 'Special')
        .toList(),
  ),
  Restaurant(
    id: 'r2',
    name: 'Global Bistro',
    imageUrl:
        'https://images.unsplash.com/photo-1559339352-11d035aa65de?ixlib=rb-4.0.3&auto=format&fit=crop&w=1548&q=80',
    rating: 4.5,
    tags: ['Italian', 'Continental', 'Salads'],
    menu: allFoodItems
        .where((i) => i.category == 'Italian' || i.category == 'Breakfast')
        .toList(),
  ),
  Restaurant(
    id: 'r3',
    name: 'Cafe Delice',
    imageUrl:
        'https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?ixlib=rb-4.0.3&auto=format&fit=crop&w=1678&q=80',
    rating: 4.9,
    tags: ['Dessert', 'French', 'Coffee'],
    menu: allFoodItems
        .where((i) => i.category == 'French' || i.category == 'Dessert')
        .toList(),
  ),
];
