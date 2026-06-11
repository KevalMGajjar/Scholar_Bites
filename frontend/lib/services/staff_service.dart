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
    required String eventDate,
    required String eventTime,
    required int memberCount,
    required String staffName,
    required String staffEmail,
    required List<Map<String, dynamic>> items,
    String? specialRequirements,
  }) async {
    try {
      final response = await _dio.post(
        '/staff/event-orders',
        data: {
          'event_name': eventName,
          'event_date': eventDate,
          'event_time': eventTime,
          'member_count': memberCount,
          'staff_name': staffName,
          'staff_email': staffEmail,
          'items': items,
          if (specialRequirements != null && specialRequirements.trim().isNotEmpty)
            'special_requirements': specialRequirements.trim(),
        },
      );
      return response.data as Map<String, dynamic>;
    } on DioException catch (e) {
      throw Exception(e.response?.data['message'] ?? 'Failed to create event order');
    }
  }

  /// Pay for an on-hold (custom) catering order from wallet
  Future<void> payEventOrder(String orderId) async {
    try {
      await _dio.patch('/staff/event-orders/$orderId/pay');
    } on DioException catch (e) {
      throw Exception(e.response?.data['message'] ?? 'Payment failed');
    }
  }

  /// Cancel an event order (optionally with a reason)
  Future<void> cancelEventOrder(String orderId, {String? reason}) async {
    try {
      await _dio.patch(
        '/staff/event-orders/$orderId/cancel',
        data: (reason != null && reason.trim().isNotEmpty) ? {'reason': reason.trim()} : null,
      );
    } on DioException catch (e) {
      throw Exception(e.response?.data['message'] ?? 'Failed to cancel event order');
    }
  }
}
