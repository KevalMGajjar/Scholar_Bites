import 'package:dio/dio.dart';
import 'api_client.dart';

/// Service for all Wallet-related API calls.
/// Uses the shared [ApiClient] (Dio) singleton for consistent
/// authentication, logging, and base URL handling.
class WalletService {
  static final WalletService _instance = WalletService._internal();
  final Dio _dio = ApiClient().dio;

  factory WalletService() => _instance;
  WalletService._internal();

  /// Fetch the current wallet balance and latest transactions.
  /// Returns a map with 'balance' (num) and 'transactions' (List).
  Future<Map<String, dynamic>> getWalletData() async {
    try {
      final response = await _dio.get('/wallet/balance');
      return Map<String, dynamic>.from(response.data);
    } on DioException catch (e) {
      throw Exception(
        'Failed to load wallet data: ${e.response?.statusCode ?? e.message}',
      );
    }
  }

  /// Create a Razorpay top-up order from the backend.
  /// Returns a map containing the 'payment_id' (Razorpay Order ID)
  /// and 'amount_in_paise'.
  Future<Map<String, dynamic>> createTopUpOrder(double amount) async {
    try {
      final response = await _dio.post(
        '/wallet/topup/create-order',
        data: {'amount': amount},
      );
      return Map<String, dynamic>.from(response.data);
    } on DioException catch (e) {
      throw Exception(
        'Failed to create top-up order: ${e.response?.data ?? e.message}',
      );
    }
  }

  /// Verify the top-up payment with Razorpay signature.
  /// Returns a success status if the wallet was credited.
  Future<Map<String, dynamic>> verifyTopUp(
    String razorpayOrderId,
    String razorpayPaymentId,
    String razorpaySignature,
    double amount,
  ) async {
    try {
      final response = await _dio.post(
        '/wallet/topup/verify',
        data: {
          'razorpay_order_id': razorpayOrderId,
          'razorpay_payment_id': razorpayPaymentId,
          'razorpay_signature': razorpaySignature,
          'amount': amount,
        },
      );
      return Map<String, dynamic>.from(response.data);
    } on DioException catch (e) {
      throw Exception(
        'Failed to verify top-up: ${e.response?.data ?? e.message}',
      );
    }
  }

  /// Pay for an existing order using wallet balance.
  /// Returns a map with 'status', 'balance', 'order_token', and 'message'.
  Future<Map<String, dynamic>> payOrderWithWallet(String orderId) async {
    try {
      final response = await _dio.post(
        '/wallet/pay-order',
        data: {'order_id': orderId},
      );
      return Map<String, dynamic>.from(response.data);
    } on DioException catch (e) {
      final errorMsg = e.response?.data is Map
          ? e.response?.data['message'] ?? e.message
          : e.message;
      throw Exception(errorMsg);
    }
  }
}
