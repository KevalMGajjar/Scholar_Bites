import 'dart:convert';
import 'package:http/http.dart' as http;
import '../utils/token_storage.dart';
import '../utils/app_config.dart';

class WalletService {
  static final WalletService _instance = WalletService._internal();

  factory WalletService() {
    return _instance;
  }

  WalletService._internal();

  String get baseUrl => AppConfig.baseUrl;

  Future<Map<String, String>> _getHeaders() async {
    final token = await TokenStorage.getToken();
    return {
      'Content-Type': 'application/json',
      if (token != null) 'Authorization': 'Bearer $token',
    };
  }

  /// Fetch the current wallet balance and latest transactions
  /// Returns a map with 'balance' and 'transactions' list
  Future<Map<String, dynamic>> getWalletData() async {
    try {
      final response = await http.get(
        Uri.parse('$baseUrl/api/wallet/balance'),
        headers: await _getHeaders(),
      );

      if (response.statusCode == 200) {
        return jsonDecode(response.body);
      } else {
        throw Exception('Failed to load wallet data: ${response.statusCode}');
      }
    } catch (e) {
      throw Exception('Wallet API error: $e');
    }
  }

  /// Create a Razorpay top-up order from the backend
  /// Returns a map containing the 'payment_id' (Razorpay Order ID) and 'amount_in_paise'
  Future<Map<String, dynamic>> createTopUpOrder(double amount) async {
    try {
      final response = await http.post(
        Uri.parse('$baseUrl/api/wallet/topup/create-order'),
        headers: await _getHeaders(),
        body: jsonEncode({'amount': amount}),
      );

      if (response.statusCode == 200) {
        return jsonDecode(response.body);
      } else {
        throw Exception('Failed to create top-up order: ${response.body}');
      }
    } catch (e) {
      throw Exception('Create top-up error: $e');
    }
  }

  /// Verify the top-up payment with Razorpay signature
  /// Returns a success status if the wallet was credited
  Future<Map<String, dynamic>> verifyTopUp(
    String razorpayOrderId,
    String razorpayPaymentId,
    String razorpaySignature,
    double amount,
  ) async {
    try {
      final response = await http.post(
        Uri.parse('$baseUrl/api/wallet/topup/verify'),
        headers: await _getHeaders(),
        body: jsonEncode({
          'razorpay_order_id': razorpayOrderId,
          'razorpay_payment_id': razorpayPaymentId,
          'razorpay_signature': razorpaySignature,
          'amount': amount,
        }),
      );

      if (response.statusCode == 200) {
        return jsonDecode(response.body);
      } else {
        throw Exception('Failed to verify top-up: ${response.body}');
      }
    } catch (e) {
      throw Exception('Verify top-up error: $e');
    }
  }
}
