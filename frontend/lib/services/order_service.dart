import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
import 'api_client.dart';
import '../models/cart_model.dart';

class OrderService {
  final Dio _dio;

  OrderService() : _dio = ApiClient().dio;

  Future<Map<String, dynamic>> createOrder(
      List<CartItem> cartItems, String universityId) async {
    try {
      final items = cartItems
          .map((item) => {
                'menu_item_id': item.food.id,
                'quantity': item.quantity,
              })
          .toList();

      final response = await _dio.post('/orders', data: {
        'items': items,
        'university_id': universityId,
      });

      if (response.statusCode == 201) {
        return response
            .data; // Includes Razorpay Order ID and internal DB Order ID
      } else {
        throw Exception('Order creation failed');
      }
    } on DioException catch (e) {
      throw Exception(e.response?.data['message'] ?? 'Order creation failed');
    }
  }

  Future<void> verifyPayment(String razorpayOrderId, String razorpayPaymentId, String razorpaySignature) async {
    try {
      final response = await _dio.post('/orders/verify', data: {
        'razorpay_order_id': razorpayOrderId,
        'razorpay_payment_id': razorpayPaymentId,
        'razorpay_signature': razorpaySignature,
      });

      if (response.statusCode != 200) {
        throw Exception('Payment verification failed');
      }
    } on DioException catch (e) {
      throw Exception(e.response?.data['message'] ?? 'Payment verification failed');
    }
  }

  /// Cancel an unpaid (pending) order and restore stock.
  /// Called when the user dismisses Razorpay without completing payment.
  Future<void> cancelOrder(String orderId) async {
    try {
      await _dio.post('/orders/$orderId/cancel');
    } on DioException catch (e) {
      // Log but don't throw — the auto-expire job will clean it up
      debugPrint('⚠️ Failed to cancel order $orderId: ${e.response?.data['message'] ?? e.message}');
    }
  }

  Future<List<dynamic>> getMyOrders() async {
    try {
      final response = await _dio.get('/orders/my-history');
      if (response.statusCode == 200) {
        return response.data;
      } else {
        throw Exception('Failed to fetch orders');
      }
    } on DioException catch (e) {
      throw Exception(e.response?.data['message'] ?? 'Failed to fetch orders');
    }
  }
}
