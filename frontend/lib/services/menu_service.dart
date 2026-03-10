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
}
