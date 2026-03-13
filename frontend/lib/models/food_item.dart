import 'package:flutter/material.dart';

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
  final String? restaurantOpeningTime;
  final String? restaurantClosingTime;

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
    this.restaurantOpeningTime,
    this.restaurantClosingTime,
  });

  bool get actuallyAvailable {
    if (!isAvailable) return false;
    if (!restaurantIsOpen) return false;

    if (restaurantOpeningTime == null || restaurantClosingTime == null) return true;

    try {
      final now = TimeOfDay.now();
      final currentMinutes = now.hour * 60 + now.minute;

      final openParts = restaurantOpeningTime!.split(':');
      final closeParts = restaurantClosingTime!.split(':');

      final openMinutes = int.parse(openParts[0]) * 60 + int.parse(openParts[1]);
      final closeMinutes = int.parse(closeParts[0]) * 60 + int.parse(closeParts[1]);

      if (closeMinutes < openMinutes) {
        return currentMinutes >= openMinutes || currentMinutes <= closeMinutes;
      }

      return currentMinutes >= openMinutes && currentMinutes <= closeMinutes;
    } catch (_) {
      return true;
    }
  }

  factory FoodItem.fromJson(Map<String, dynamic> json) {
    // Expected Prisma format
    final nutrition = json['nutritional_info'] as Map<String, dynamic>? ?? {};
    final priceParsed =
        double.tryParse(json['price']?.toString() ?? '0') ?? 0.0;

    return FoodItem(
      id: json['id'] ?? '',
      name: json['name'] ?? 'Unknown Item',
      imageUrl: json['image_url'] ?? 'https://via.placeholder.com/150',
      price: priceParsed,
      calories: nutrition['calories'] as int? ?? 0,
      weight: nutrition['weight'] as int? ?? 0,
      description: json['description'] ?? '',
      category: json['category'] ?? 'Dinner',
      isAvailable: json['is_available'] ?? true,
      restaurantIsOpen: json['restaurant_is_open'] ?? true,
      restaurantOpeningTime: json['restaurant_opening_time'],
      restaurantClosingTime: json['restaurant_closing_time'],
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'name': name,
      'image_url': imageUrl,
      'price': price,
      'nutritional_info': {'calories': calories, 'weight': weight},
      'description': description,
      'category': category,
      'is_available': isAvailable,
    };
  }
}
