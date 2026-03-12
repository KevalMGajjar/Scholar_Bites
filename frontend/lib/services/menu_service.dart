import 'package:dio/dio.dart';
import '../models/food_item.dart';
import 'api_client.dart';

class MenuService {
  final Dio _dio;

  MenuService() : _dio = ApiClient().dio;

  Future<List<FoodItem>> getMenuItems(String universityId,
      {String? category, String? restaurantId}) async {
    try {
      final queryParams = <String, dynamic>{};
      
      if (restaurantId != null) {
        queryParams['restaurant_id'] = restaurantId;
      } else {
        queryParams['university_id'] = universityId;
      }

      if (category != null && category.isNotEmpty) {
        queryParams['category'] = category;
      }

      final response = await _dio.get('/menu', queryParameters: queryParams);

      if (response.statusCode == 200) {
        final List<dynamic> data = response.data;
        return data.map((json) => FoodItem.fromJson(json)).toList();
      } else {
        throw Exception('Failed to fetch menu items');
      }
    } catch (e) {
      throw Exception('Error fetching menu items: $e');
    }
  }

  // ─── Reviews ───────────────────────────────────────
  Future<Map<String, dynamic>> getItemRating(String menuItemId) async {
    try {
      final response = await _dio.get('/menu/reviews/$menuItemId');
      return response.data;
    } catch (e) {
      return {'avg_rating': 0.0, 'review_count': 0, 'user_rating': 0};
    }
  }

  Future<void> submitReview(String menuItemId, int rating) async {
    await _dio.post('/menu/reviews', data: {
      'menu_item_id': menuItemId,
      'rating': rating,
    });
  }

  // ─── Trending ──────────────────────────────────────
  Future<List<FoodItem>> getTrendingItems(String universityId) async {
    try {
      final response = await _dio.get('/menu/trending/$universityId');
      if (response.statusCode == 200) {
        final List<dynamic> data = response.data;
        return data.map((json) => FoodItem.fromJson(json)).toList();
      }
      return [];
    } catch (e) {
      return [];
    }
  }
}
