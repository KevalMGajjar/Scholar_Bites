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
  });

  bool get actuallyAvailable {
    if (!isAvailable) return false;
    if (!restaurantIsOpen) return false;
    return true;
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
