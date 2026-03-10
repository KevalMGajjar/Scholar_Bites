import 'package:razorpay_flutter/razorpay_flutter.dart';
import 'package:flutter/material.dart';

class PaymentService {
  late Razorpay _razorpay;
  final Function(PaymentSuccessResponse) onSuccess;
  final Function(PaymentFailureResponse) onFailure;
  final Function(ExternalWalletResponse) onExternalWallet;

  PaymentService({
    required this.onSuccess,
    required this.onFailure,
    required this.onExternalWallet,
  }) {
    _razorpay = Razorpay();
    _razorpay.on(Razorpay.EVENT_PAYMENT_SUCCESS, _handlePaymentSuccess);
    _razorpay.on(Razorpay.EVENT_PAYMENT_ERROR, _handlePaymentError);
    _razorpay.on(Razorpay.EVENT_EXTERNAL_WALLET, _handleExternalWallet);
  }

  void _handlePaymentSuccess(PaymentSuccessResponse response) {
    onSuccess(response);
  }

  void _handlePaymentError(PaymentFailureResponse response) {
    onFailure(response);
  }

  void _handleExternalWallet(ExternalWalletResponse response) {
    onExternalWallet(response);
  }

  void openCheckout({
    required double amount,
    required String contact,
    required String email,
    required String name,
    required String description,
    required String orderId,
  }) {
    var options = {
      'key': 'rzp_test_zHkIerVdIItgIe', // Replace with an actual test key if available, using placeholder for now
      'amount': (amount * 100).toInt(), // Razorpay expects amount in paise
      'name': 'Scholar Bites',
      'description': description,
      'order_id': orderId,
      'retry': {'enabled': false},
      'prefill': {
        'contact': contact,
        'email': email,
        'name': name,
      },
      'external': {
        'wallets': ['paytm']
      },
      'theme': {
        'color': '#8B1C28' // App Maroon
      }
    };

    try {
      _razorpay.open(options);
    } catch (e) {
      debugPrint('Error opening Razorpay: $e');
    }
  }

  void dispose() {
    _razorpay.clear();
  }
}
