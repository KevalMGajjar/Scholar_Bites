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
  final String? openingTime; // "HH:mm" format (e.g. "09:00")
  final String? closingTime; // "HH:mm" format (e.g. "22:00")

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
    this.openingTime,
    this.closingTime,
  });

  /// Whether the restaurant is currently accepting orders
  /// based on `is_open` flag AND opening/closing time window.
  bool get isCurrentlyOpen {
    if (!isOpen) return false;
    if (openingTime == null || closingTime == null) return isOpen;

    final now = DateTime.now();
    final currentMinutes = now.hour * 60 + now.minute;

    final openParts = openingTime!.split(':');
    final closeParts = closingTime!.split(':');
    final openMinutes = int.parse(openParts[0]) * 60 + int.parse(openParts[1]);
    final closeMinutes = int.parse(closeParts[0]) * 60 + int.parse(closeParts[1]);

    // Handles overnight ranges (e.g. 22:00 - 02:00)
    if (closeMinutes < openMinutes) {
      return currentMinutes >= openMinutes || currentMinutes <= closeMinutes;
    }
    return currentMinutes >= openMinutes && currentMinutes <= closeMinutes;
  }

  /// Human-friendly hours string
  String get hoursDisplay {
    if (openingTime == null || closingTime == null) return '';
    return '$openingTime - $closingTime';
  }

  factory Restaurant.fromJson(Map<String, dynamic> json) {
    // Parse time fields — backend may return "HH:mm:ss" or "HH:mm"
    String? parseTime(dynamic val) {
      if (val == null) return null;
      final s = val.toString();
      // Take only HH:mm
      return s.length >= 5 ? s.substring(0, 5) : s;
    }

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
      openingTime: parseTime(json['opening_time']),
      closingTime: parseTime(json['closing_time']),
    );
  }
}
