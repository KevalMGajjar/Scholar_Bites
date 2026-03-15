import 'package:dio/dio.dart';
import '../models/restaurant_model.dart';
import 'api_client.dart';

class UniversityService {
  final Dio _dio;

  UniversityService() : _dio = ApiClient().dio;

  Future<List<Restaurant>> getUniversities() async {
    try {
      final response = await _dio.get('/university');
      if (response.statusCode == 200) {
        final List<dynamic> data = response.data;
        return data.map((e) => Restaurant.fromJson(e)).toList();
      }
    } on DioException catch (e) {
      throw Exception(
        e.response?.data['message'] ?? 'Failed to fetch universities',
      );
    }
    return [];
  }

  /// Fetch a single university by ID
  Future<Map<String, dynamic>?> getUniversityById(String id) async {
    try {
      final response = await _dio.get('/university/$id');
      if (response.statusCode == 200) {
        return response.data as Map<String, dynamic>;
      }
    } on DioException catch (_) {
      return null;
    }
    return null;
  }

  Future<List<Restaurant>> searchUniversities({
    String? q,
    double? lat,
    double? lng,
    int page = 1,
    int limit = 10,
  }) async {
    try {
      final queryParams = <String, dynamic>{
        'page': page,
        'limit': limit,
      };
      if (q != null && q.isNotEmpty) queryParams['q'] = q;
      if (lat != null) queryParams['lat'] = lat;
      if (lng != null) queryParams['lng'] = lng;

      final response = await _dio.get('/university/search', queryParameters: queryParams);
      if (response.statusCode == 200) {
        final List<dynamic> data = response.data['universities'];
        return data.map((e) => Restaurant.fromJson(e)).toList();
      }
    } on DioException catch (e) {
      throw Exception(
        e.response?.data['message'] ?? 'Failed to search universities',
      );
    }
    return [];
  }
}
