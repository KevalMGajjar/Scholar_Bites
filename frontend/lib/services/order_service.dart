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

  /// Create a multi-restaurant order (splits by restaurant, single payment)
  Future<Map<String, dynamic>> createMultiRestaurantOrder(
      List<CartItem> cartItems, String universityId) async {
    try {
      final items = cartItems
          .map((item) => {
                'menu_item_id': item.food.id,
                'quantity': item.quantity,
              })
          .toList();

      final response = await _dio.post('/orders/multi', data: {
        'items': items,
        'university_id': universityId,
      });

      if (response.statusCode == 201) {
        return response.data;
        // Returns: { payment_id, total_amount, batch_id, sub_orders: [...] }
      } else {
        throw Exception('Multi-restaurant order creation failed');
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

  /// Verify payment for batch (multi-restaurant) orders
  Future<void> verifyBatchPayment(String razorpayOrderId, String razorpayPaymentId,
      String razorpaySignature, String batchId) async {
    try {
      final response = await _dio.post('/orders/verify-batch', data: {
        'razorpay_order_id': razorpayOrderId,
        'razorpay_payment_id': razorpayPaymentId,
        'razorpay_signature': razorpaySignature,
        'batch_id': batchId,
      });

      if (response.statusCode != 200) {
        throw Exception('Batch payment verification failed');
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

  /// Get rotating QR token for an order (15-sec rotation)
  Future<Map<String, dynamic>> getQrToken(String orderId) async {
    try {
      final response = await _dio.get('/orders/$orderId/qr-token');
      if (response.statusCode == 200) {
        return response.data;
      } else {
        throw Exception('Failed to get QR token');
      }
    } on DioException catch (e) {
      throw Exception(e.response?.data['message'] ?? 'Failed to get QR token');
    }
  }

  /// Get sub-orders by batch ID (for multi-restaurant orders)
  Future<List<dynamic>> getSubOrdersByBatch(String batchId) async {
    try {
      final response = await _dio.get('/orders/batch/$batchId');
      if (response.statusCode == 200) {
        return response.data;
      } else {
        throw Exception('Failed to fetch sub-orders');
      }
    } on DioException catch (e) {
      throw Exception(e.response?.data['message'] ?? 'Failed to fetch sub-orders');
    }
  }

  /// Get invoice data for an order
  Future<Map<String, dynamic>> getInvoice(String orderId) async {
    try {
      final response = await _dio.get('/orders/$orderId/invoice');
      if (response.statusCode == 200) {
        return response.data;
      } else {
        throw Exception('Failed to get invoice');
      }
    } on DioException catch (e) {
      throw Exception(e.response?.data['message'] ?? 'Failed to get invoice');
    }
  }
}
