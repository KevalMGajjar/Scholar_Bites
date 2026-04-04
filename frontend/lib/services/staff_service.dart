import 'package:dio/dio.dart';
import 'api_client.dart';

class StaffService {
  final Dio _dio;

  StaffService() : _dio = ApiClient().dio;

  /// Fetch user's daily pre-orders
  Future<List<dynamic>> getMyPreOrders() async {
    try {
      final response = await _dio.get('/staff/pre-orders/my');
      return response.data as List<dynamic>;
    } on DioException catch (e) {
      throw Exception(e.response?.data['message'] ?? 'Failed to fetch pre-orders');
    }
  }

  /// Create a new pre-order
  Future<Map<String, dynamic>> createPreOrder({
    required List<Map<String, dynamic>> items,
    required String targetDate,
    required String notes,
  }) async {
    try {
      final response = await _dio.post(
        '/staff/pre-orders',
        data: {
          'items': items,
          'target_date': targetDate,
          'notes': notes,
        },
      );
      return response.data as Map<String, dynamic>;
    } on DioException catch (e) {
      throw Exception(e.response?.data['message'] ?? 'Failed to create pre-order');
    }
  }

  /// Cancel a pre-order
  Future<void> cancelPreOrder(String orderId) async {
    try {
      await _dio.patch('/staff/pre-orders/$orderId/cancel');
    } on DioException catch (e) {
      throw Exception(e.response?.data['message'] ?? 'Failed to cancel pre-order');
    }
  }

  // ─── Event Pre-Orders ───

  /// Fetch event menu
  Future<List<dynamic>> getEventMenu(String universityId) async {
    try {
      final response = await _dio.get('/staff/event-menu/$universityId');
      return response.data as List<dynamic>;
    } catch (e) {
      return [];
    }
  }

  /// Fetch user's event pre-orders
  Future<List<dynamic>> getMyEventOrders() async {
    try {
      final response = await _dio.get('/staff/event-orders/my');
      return response.data as List<dynamic>;
    } on DioException catch (e) {
      throw Exception(e.response?.data['message'] ?? 'Failed to fetch event orders');
    }
  }

  /// Create an event pre-order
  Future<Map<String, dynamic>> createEventOrder({
    required String eventName,
    required String cateringTime,
    required int expectedGuests,
    required List<Map<String, dynamic>> items,
  }) async {
    try {
      final response = await _dio.post(
        '/staff/event-orders',
        data: {
          'event_name': eventName,
          'catering_time': cateringTime,
          'expected_guests': expectedGuests,
          'items': items,
        },
      );
      return response.data as Map<String, dynamic>;
    } on DioException catch (e) {
      throw Exception(e.response?.data['message'] ?? 'Failed to create event order');
    }
  }

  /// Cancel an event order
  Future<void> cancelEventOrder(String orderId) async {
    try {
      await _dio.patch('/staff/event-orders/$orderId/cancel');
    } on DioException catch (e) {
      throw Exception(e.response?.data['message'] ?? 'Failed to cancel event order');
    }
  }
}
