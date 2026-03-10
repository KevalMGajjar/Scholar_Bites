import 'food_item.dart';

class Restaurant {
  final String id;
  final String? universityId;
  final String name;
  final String imageUrl;
  final String? coverUrl;
  final double rating;
  final List<String> tags;
  final bool isOpen;
  final List<FoodItem> menu;
  final String deliveryTime;
  final double deliveryFee;

  Restaurant({
    required this.id,
    this.universityId,
    required this.name,
    required this.imageUrl,
    this.coverUrl,
    required this.rating,
    required this.tags,
    this.isOpen = true,
    required this.menu,
    this.deliveryTime = '10-15 min',
    this.deliveryFee = 0.0,
  });

  factory Restaurant.fromJson(Map<String, dynamic> json) {
    return Restaurant(
      id: json['id']?.toString() ?? '',
      universityId: json['university_id']?.toString(),
      name: json['name']?.toString() ?? 'Unknown Restaurant',
      imageUrl: json['logo_url']?.toString() ??
          'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&q=80',
      coverUrl: json['cover_url']?.toString(),
      rating: double.tryParse(json['rating']?.toString() ?? '0') ?? 4.5,
      tags: json['tags'] != null ? List<String>.from(json['tags']) : ['Canteen'],
      isOpen: json['is_open'] ?? true,
      menu: [], // Menu fetched separately
    );
  }
}
