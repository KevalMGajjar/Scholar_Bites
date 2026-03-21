import 'dart:convert';

class FoodItem {
  final String id;
  final String name;
  final String imageUrl;
  final double price;
  final int calories;
  final int weight;
  final String description;
  final String category;
  final bool isAvailable;
  final bool restaurantIsOpen;
  final String? restaurantId;
  final bool isVeg;
  final String unit;

  const FoodItem({
    required this.id,
    required this.name,
    required this.imageUrl,
    required this.price,
    required this.calories,
    required this.weight,
    required this.description,
    this.category = 'Dinner',
    this.isAvailable = true,
    this.restaurantIsOpen = true,
    this.restaurantId,
    this.isVeg = true,
    this.unit = 'g',
  });

  bool get actuallyAvailable {
    if (!isAvailable) return false;
    if (!restaurantIsOpen) return false;
    return true;
  }

  factory FoodItem.fromJson(Map<String, dynamic> json) {
    // Parse nutritional_info safely — JSONB values can be String, int, or double
    final rawNutrition = json['nutritional_info'];
    Map<String, dynamic> nutrition = {};
    if (rawNutrition is Map) {
      try {
        nutrition = Map<String, dynamic>.from(rawNutrition);
      } catch (_) {}
    } else if (rawNutrition is String && rawNutrition.isNotEmpty) {
      try {
        nutrition = Map<String, dynamic>.from(jsonDecode(rawNutrition));
      } catch (_) {}
    }

    final priceParsed = double.tryParse(json['price']?.toString() ?? '0') ?? 0.0;

    return FoodItem(
      id: json['id']?.toString() ?? '',
      name: json['name']?.toString() ?? 'Unknown Item',
      imageUrl: json['image_url']?.toString() ?? 'https://via.placeholder.com/150',
      price: priceParsed,
      calories: int.tryParse(nutrition['calories']?.toString() ?? '0') ?? 0,
      weight: int.tryParse(nutrition['weight']?.toString() ?? nutrition['weight_grams']?.toString() ?? '0') ?? 0,
      description: json['description'] ?? '',
      category: json['category'] ?? 'Dinner',
      isAvailable: json['is_available'] ?? true,
      restaurantIsOpen: json['restaurant_is_open'] ?? true,
      restaurantId: json['restaurant_id']?.toString(),
      isVeg: json['is_veg'] ?? true,
      unit: nutrition['unit']?.toString() ?? 'g',
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'name': name,
      'image_url': imageUrl,
      'price': price,
      'nutritional_info': {'calories': calories, 'weight': weight, 'unit': unit},
      'description': description,
      'category': category,
      'is_available': isAvailable,
      'is_veg': isVeg,
    };
  }
}
