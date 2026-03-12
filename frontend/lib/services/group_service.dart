import 'package:dio/dio.dart';
import 'api_client.dart';

class GroupService {
  final Dio _dio;

  GroupService() : _dio = ApiClient().dio;

  /// Create a new group, returns group order data with code
  Future<Map<String, dynamic>> createGroup(String nickname) async {
    final response = await _dio.post('/lobby/create', data: {'nickname': nickname});
    return response.data;
  }

  /// Join an existing group by code
  Future<Map<String, dynamic>> joinGroup(String code, String nickname) async {
    final response = await _dio.post('/lobby/join', data: {'code': code, 'nickname': nickname});
    return response.data;
  }

  /// Leave a group (leader leaves = group deleted, member leaves = removed)
  Future<Map<String, dynamic>> leaveGroup(String code) async {
    final response = await _dio.post('/lobby/leave', data: {'code': code});
    return response.data;
  }

  /// Get full group state (members, items, status)
  Future<Map<String, dynamic>> getGroupState(String code) async {
    final response = await _dio.get('/lobby/$code/state');
    return response.data;
  }

  /// Check if user is in any active (open/locked) group
  Future<Map<String, dynamic>> getActiveGroup() async {
    final response = await _dio.get('/lobby/active');
    return response.data;
  }

  /// Add a menu item to the group
  Future<Map<String, dynamic>> addItem(String code, String menuItemId, int quantity) async {
    final response = await _dio.post('/lobby/add-item', data: {
      'code': code,
      'menu_item_id': menuItemId,
      'quantity': quantity,
    });
    return response.data;
  }

  /// Lock the group (leader only) with split mode
  Future<Map<String, dynamic>> lockGroup(String code, {String splitMode = 'individual'}) async {
    final response = await _dio.post('/lobby/lock', data: {
      'code': code,
      'split_mode': splitMode,
    });
    return response.data;
  }

  /// Unlock the group (leader only) — revert to open
  Future<Map<String, dynamic>> unlockGroup(String code) async {
    final response = await _dio.post('/lobby/unlock', data: {'code': code});
    return response.data;
  }

  /// Initiate payment for the user's share
  Future<Map<String, dynamic>> payShare(String code, {String method = 'wallet'}) async {
    final response = await _dio.post('/lobby/pay-share', data: {
      'code': code,
      'payment_method': method,
    });
    return response.data;
  }

  /// Verify Razorpay payment for share
  Future<Map<String, dynamic>> verifyShare({
    required String code,
    required String razorpayOrderId,
    required String razorpayPaymentId,
    required String razorpaySignature,
  }) async {
    final response = await _dio.post('/lobby/verify-share', data: {
      'code': code,
      'razorpay_order_id': razorpayOrderId,
      'razorpay_payment_id': razorpayPaymentId,
      'razorpay_signature': razorpaySignature,
    });
    return response.data;
  }
}
