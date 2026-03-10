import 'package:dio/dio.dart';
import 'api_client.dart';
import '../models/restaurant_model.dart';

class RestaurantService {
  final Dio _dio;

  RestaurantService() : _dio = ApiClient().dio;

  Future<List<Restaurant>> getRestaurantsByUniversity(String universityId) async {
    try {
      final response = await _dio.get('/restaurants/university/$universityId');
      if (response.statusCode == 200) {
        final List<dynamic> data = response.data;
        return data.map((json) => Restaurant.fromJson(json)).toList();
      }
      throw Exception('Failed to load restaurants');
    } catch (e) {
      throw Exception('Network error: $e');
    }
  }
}
