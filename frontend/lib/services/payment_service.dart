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

  /// Opens the Razorpay checkout.
  /// [amountInPaise] must be the exact amount from the server in paise.
  void openCheckout({
    required int amountInPaise,
    required String contact,
    required String email,
    required String name,
    required String description,
    required String orderId,
  }) {
    debugPrint('💳 PaymentService: orderId=$orderId, amountInPaise=$amountInPaise, contact=$contact, email=$email');

    var options = {
      'key': 'rzp_test_SPkxayowhOjcMQ',
      'amount': amountInPaise,
      'currency': 'INR',
      'name': 'Scholar Bites',
      'description': description,
      'order_id': orderId,
      'prefill': {
        'contact': contact,
        'email': email,
      },
      'theme': {
        'color': '#8B1C28'
      }
    };

    debugPrint('💳 Razorpay options: $options');

    try {
      _razorpay.open(options);
    } catch (e) {
      debugPrint('❌ Error opening Razorpay: $e');
    }
  }

  void dispose() {
    _razorpay.clear();
  }
}
