class FoodItem {
  final String id;
  final String name;
  final String imageUrl;
  final double price;
  final int calories;
  final int weight;
  final String description;
  final String category;

  const FoodItem({
    required this.id,
    required this.name,
    required this.imageUrl,
    required this.price,
    required this.calories,
    required this.weight,
    required this.description,
    this.category = 'Dinner',
  });

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
    };
  }
}
