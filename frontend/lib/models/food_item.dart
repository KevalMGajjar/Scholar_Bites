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
  });

  bool get actuallyAvailable {
    if (!isAvailable) return false;
    if (!restaurantIsOpen) return false;
    return true;
  }

  factory FoodItem.fromJson(Map<String, dynamic> json) {
    // Parse nutritional_info safely — JSONB values can be String, int, or double
    final rawNutrition = json['nutritional_info'];
    final Map<String, dynamic> nutrition = rawNutrition is Map<String, dynamic>
        ? rawNutrition
        : (rawNutrition is Map ? Map<String, dynamic>.from(rawNutrition) : {});
    final priceParsed =
        double.tryParse(json['price']?.toString() ?? '0') ?? 0.0;

    return FoodItem(
      id: json['id']?.toString() ?? '',
      name: json['name']?.toString() ?? 'Unknown Item',
      imageUrl: json['image_url']?.toString() ?? 'https://via.placeholder.com/150',
      price: priceParsed,
      calories: int.tryParse(nutrition['calories']?.toString() ?? '0') ?? 0,
      weight: int.tryParse(nutrition['weight']?.toString() ?? '0') ?? 0,
      description: json['description'] ?? '',
      category: json['category'] ?? 'Dinner',
      isAvailable: json['is_available'] ?? true,
      restaurantIsOpen: json['restaurant_is_open'] ?? true,
      restaurantId: json['restaurant_id']?.toString(),
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
