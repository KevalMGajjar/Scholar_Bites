import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:razorpay_flutter/razorpay_flutter.dart';
import 'package:cached_network_image/cached_network_image.dart';
import '../models/cart_model.dart';
import '../services/order_service.dart';
import '../services/payment_service.dart';
import '../utils/token_storage.dart';
import 'detail_screen.dart';

class CartScreen extends StatefulWidget {
  const CartScreen({super.key});

  @override
  State<CartScreen> createState() => _CartScreenState();
}

class _CartScreenState extends State<CartScreen> {
  static const _maroon = Color(0xFF8B1C28);
  static const _darkText = Color(0xFF4A0E13);
  
  late PaymentService _paymentService;
  bool _isProcessingPayment = false;

  @override
  void initState() {
    super.initState();
    _paymentService = PaymentService(
      onSuccess: _handlePaymentSuccess,
      onFailure: _handlePaymentError,
      onExternalWallet: _handleExternalWallet,
    );
  }

  @override
  void dispose() {
    _paymentService.dispose();
    super.dispose();
  }

  // --- Razorpay Handlers ---

  void _handlePaymentSuccess(PaymentSuccessResponse response) async {
    debugPrint('✅ RAZORPAY SUCCESS: orderId=${response.orderId}, paymentId=${response.paymentId}, signature=${response.signature}');
    _processSuccessfulOrder(response.orderId!, response.paymentId!, response.signature!);
  }

  void _processSuccessfulOrder(String orderId, String paymentId, String signature) async {
    // Payment succeeded, verify with the backend
    debugPrint('🔄 Verifying payment: orderId=$orderId, paymentId=$paymentId');
    try {
      final cart = Provider.of<CartProvider>(context, listen: false);
      
      await OrderService().verifyPayment(orderId, paymentId, signature);
      debugPrint('✅ Payment verification succeeded!');
      
      if (mounted) {
        setState(() => _isProcessingPayment = false);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Payment Successful! Order placed! ID: $orderId'),
            backgroundColor: Colors.green,
          ),
        );
        cart.clear();
      }
    } catch (e) {
      debugPrint('❌ Payment verification FAILED: $e');
      if (mounted) {
        setState(() => _isProcessingPayment = false);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Payment verification failed: $e')),
        );
      }
    }
  }

  void _handlePaymentError(PaymentFailureResponse response) {
    debugPrint('❌ RAZORPAY ERROR: code=${response.code}, message=${response.message}');
    _processFailedOrder(response.message ?? 'User cancelled');
  }

  void _processFailedOrder(String message) {
    if (mounted) {
      setState(() => _isProcessingPayment = false);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Payment Failed: $message'),
          backgroundColor: Colors.redAccent,
        ),
      );
    }
  }

  void _handleExternalWallet(ExternalWalletResponse response) {
    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('External Wallet Selected: ${response.walletName}')),
      );
    }
  }

  // --- Checkout Flow ---

  Future<void> _startCheckoutFlow(CartProvider cart) async {
    if (cart.totalAmount <= 0) return;

    final universityId = await TokenStorage.getUniversityId();
    if (universityId == null || universityId.isEmpty) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Please log in again.')),
        );
      }
      return;
    }

    setState(() => _isProcessingPayment = true);
    
    try {
      // Create order backend first to generate a valid Razorpay Order ID
      debugPrint('🛒 Creating order with ${cart.items.length} items, universityId=$universityId');
      final orderResponse = await OrderService().createOrder(cart.items.values.toList(), universityId);
      final String orderId = orderResponse['payment_id']; // The Razorpay order ID
      // Use the exact paise value from the backend — same value sent to Razorpay
      final int amountInPaise = orderResponse['amount_in_paise'] as int;
      debugPrint('✅ Order created: razorpayOrderId=$orderId, paise=$amountInPaise');

      // Get user details for Razorpay prefill
      String userEmail = await TokenStorage.getUserEmail() ?? 'student@example.com';
      String userPhone = await TokenStorage.getPhone() ?? '9999999999';

      if (orderId.startsWith('mock_')) {
        setState(() => _isProcessingPayment = false);
        _showMockPaymentDialog(context, cart, orderId);
        return;
      }
      
      debugPrint('💳 Opening Razorpay checkout: orderId=$orderId, paise=$amountInPaise, contact=$userPhone');
      // Open Razorpay Checkout overlay
      _paymentService.openCheckout(
        amountInPaise: amountInPaise,
        contact: userPhone,
        email: userEmail,
        name: 'Scholar Bites',
        description: 'Scholar Bites Order',
        orderId: orderId,
      );
    } catch (e) {
      if (mounted) {
        setState(() => _isProcessingPayment = false);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Failed to initiate checkout: $e')),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFFCF9F5),
      appBar: AppBar(
        title: const Text(
          'My Cart',
          style: TextStyle(fontWeight: FontWeight.w800, fontSize: 22),
        ),
        centerTitle: false,
        backgroundColor: Colors.transparent,
        elevation: 0,
        foregroundColor: _darkText,
        leading: Padding(
          padding: const EdgeInsets.only(left: 16),
          child: GestureDetector(
            onTap: () => Navigator.pop(context),
            child: Container(
              decoration: BoxDecoration(
                color: const Color(0xFFFDF0F0),
                shape: BoxShape.circle,
                border: Border.all(color: _maroon.withValues(alpha: 0.1)),
              ),
              child: const Icon(Icons.arrow_back_ios_new_rounded,
                  color: _maroon, size: 18),
            ),
          ),
        ),
      ),
      body: Consumer<CartProvider>(
        builder: (context, cart, child) {
          if (cart.items.isEmpty) {
            return _buildEmptyState();
          }
          return Column(
            children: [
              // Item count header
              Padding(
                padding: const EdgeInsets.fromLTRB(24, 4, 24, 12),
                child: Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 14, vertical: 6),
                      decoration: BoxDecoration(
                        color: _maroon.withValues(alpha: 0.08),
                        borderRadius: BorderRadius.circular(20),
                      ),
                      child: Text(
                        '${cart.itemCount} item${cart.itemCount == 1 ? '' : 's'}',
                        style: const TextStyle(
                          color: _maroon,
                          fontSize: 13,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ),
                    const Spacer(),
                    GestureDetector(
                      onTap: () {
                        _showClearCartDialog(context, cart);
                      },
                      child: Text(
                        'Clear All',
                        style: TextStyle(
                          color: _maroon.withValues(alpha: 0.5),
                          fontSize: 13,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ),
                  ],
                ),
              ),

              // Cart items list
              Expanded(
                child: ListView.builder(
                  padding: const EdgeInsets.symmetric(horizontal: 20),
                  physics: const BouncingScrollPhysics(),
                  itemCount: cart.items.length,
                  itemBuilder: (context, index) {
                    String key = cart.items.keys.elementAt(index);
                    CartItem item = cart.items[key]!;
                    return _buildCartCard(context, item, cart, index);
                  },
                ),
              ),

              // Bottom checkout section
              _buildCheckoutSection(context, cart),
            ],
          );
        },
      ),
    );
  }

  Widget _buildEmptyState() {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Container(
            width: 120,
            height: 120,
            decoration: BoxDecoration(
              color: const Color(0xFFFDF0F0),
              shape: BoxShape.circle,
              boxShadow: [
                BoxShadow(
                  color: _maroon.withValues(alpha: 0.1),
                  blurRadius: 30,
                  spreadRadius: 5,
                ),
              ],
            ),
            child: const Center(
              child: Text('\u{1F6D2}', style: TextStyle(fontSize: 48)),
            ),
          )
              .animate(onPlay: (c) => c.repeat(reverse: true))
              .scaleXY(begin: 1.0, end: 1.08, duration: 1500.ms, curve: Curves.easeInOut),
          const SizedBox(height: 24),
          const Text(
            'Your cart is empty',
            style: TextStyle(
              fontSize: 22,
              color: _darkText,
              fontWeight: FontWeight.w800,
            ),
          ),
          const SizedBox(height: 8),
          Text(
            'Add something delicious!',
            style: TextStyle(
              fontSize: 14,
              color: _maroon.withValues(alpha: 0.5),
              fontWeight: FontWeight.w500,
            ),
          ),
        ],
      ),
    ).animate().fadeIn(duration: 500.ms);
  }

  Widget _buildCartCard(
      BuildContext context, CartItem item, CartProvider cart, int index) {
    return GestureDetector(
      onTap: () {
        Navigator.push(
          context,
          MaterialPageRoute(
            builder: (context) => DetailScreen(food: item.food),
          ),
        );
      },
      child: Dismissible(
        key: Key(item.id),
        direction: DismissDirection.endToStart,
        onDismissed: (direction) {
          cart.removeItem(item.food.id);
        },
        background: Container(
          margin: const EdgeInsets.only(bottom: 16),
          decoration: BoxDecoration(
            gradient: const LinearGradient(
              colors: [Color(0xFFE74C3C), Color(0xFFC0392B)],
            ),
            borderRadius: BorderRadius.circular(24),
          ),
          alignment: Alignment.centerRight,
          padding: const EdgeInsets.only(right: 28),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const Icon(Icons.delete_outline_rounded,
                  color: Colors.white, size: 28),
              const SizedBox(height: 4),
              Text(
                'Delete',
                style: TextStyle(
                  color: Colors.white.withValues(alpha: 0.9),
                  fontSize: 12,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ],
          ),
        ),
        child: Container(
          margin: const EdgeInsets.only(bottom: 16),
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(24),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withValues(alpha: 0.04),
                blurRadius: 16,
                offset: const Offset(0, 6),
              ),
            ],
          ),
          child: Row(
            children: [
              // Food image
              Hero(
                tag: 'cart-food-${item.food.id}',
                child: Container(
                  width: 90,
                  height: 90,
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(20),
                    boxShadow: [
                      BoxShadow(
                        color: _maroon.withValues(alpha: 0.15),
                        blurRadius: 10,
                        offset: const Offset(0, 4),
                      ),
                    ],
                  ),
                  child: ClipRRect(
                    borderRadius: BorderRadius.circular(20),
                    child: CachedNetworkImage(
                      imageUrl: item.food.imageUrl,
                      fit: BoxFit.cover,
                      placeholder: (context, url) => Container(
                        color: const Color(0xFFFDF0F0),
                        child: const Center(
                          child: SizedBox(
                            width: 24, height: 24,
                            child: CircularProgressIndicator(strokeWidth: 2, color: _maroon),
                          ),
                        ),
                      ),
                      errorWidget: (context, url, error) {
                        return Container(
                          color: const Color(0xFFFDF0F0),
                          child: const Center(
                            child: Icon(Icons.fastfood_rounded,
                                color: _maroon, size: 32),
                          ),
                        );
                      },
                    ),
                  ),
                ),
              ),
              const SizedBox(width: 16),
              // Food details
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      item.food.name,
                      style: const TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.w800,
                        color: _darkText,
                      ),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                    const SizedBox(height: 4),
                    Text(
                      item.food.category,
                      style: TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.w500,
                        color: _maroon.withValues(alpha: 0.5),
                      ),
                    ),
                    const SizedBox(height: 10),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        // Price
                        Text(
                          '\u{20B9}${(item.food.price * item.quantity).toStringAsFixed(0)}',
                          style: const TextStyle(
                            fontSize: 18,
                            fontWeight: FontWeight.w900,
                            color: _maroon,
                          ),
                        ),
                        // Quantity controls
                        Container(
                          decoration: BoxDecoration(
                            color: const Color(0xFFFDF0F0),
                            borderRadius: BorderRadius.circular(14),
                            border: Border.all(
                              color: _maroon.withValues(alpha: 0.1),
                            ),
                          ),
                          child: Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              _buildQtyButton(
                                icon: Icons.remove_rounded,
                                onTap: () =>
                                    cart.removeSingleItem(item.food.id),
                              ),
                              Padding(
                                padding: const EdgeInsets.symmetric(
                                    horizontal: 14),
                                child: Text(
                                  '${item.quantity}',
                                  style: const TextStyle(
                                    fontSize: 16,
                                    fontWeight: FontWeight.w800,
                                    color: _darkText,
                                  ),
                                ),
                              ),
                              _buildQtyButton(
                                icon: Icons.add_rounded,
                                onTap: () => cart.addItem(item.food),
                                filled: true,
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    )
        .animate()
        .fadeIn(delay: (60 * index).ms, duration: 350.ms)
        .slideX(begin: 0.08, end: 0, curve: Curves.easeOutCubic);
  }

  Widget _buildQtyButton({
    required IconData icon,
    required VoidCallback onTap,
    bool filled = false,
  }) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        width: 34,
        height: 34,
        decoration: BoxDecoration(
          color: filled ? _maroon : Colors.transparent,
          borderRadius: BorderRadius.circular(12),
        ),
        child: Icon(
          icon,
          size: 18,
          color: filled ? Colors.white : _maroon,
        ),
      ),
    );
  }

  Widget _buildCheckoutSection(BuildContext context, CartProvider cart) {
    return Container(
      padding: const EdgeInsets.fromLTRB(24, 20, 24, 28),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: const BorderRadius.vertical(top: Radius.circular(32)),
        boxShadow: [
          BoxShadow(
            color: _maroon.withValues(alpha: 0.08),
            blurRadius: 24,
            offset: const Offset(0, -8),
          ),
        ],
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          // Price breakdown
          _buildPriceRow('Subtotal', cart.totalAmount),
          const SizedBox(height: 12),
          Container(
            height: 1,
            color: Colors.grey.withValues(alpha: 0.1),
          ),
          const SizedBox(height: 12),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Text(
                'Total',
                style: TextStyle(
                  fontSize: 18,
                  fontWeight: FontWeight.w800,
                  color: _darkText,
                ),
              ),
              Text(
                '\u{20B9}${cart.totalAmount.toStringAsFixed(0)}',
                style: const TextStyle(
                  fontSize: 26,
                  fontWeight: FontWeight.w900,
                  color: _maroon,
                ),
              ),
            ],
          ),
          const SizedBox(height: 20),

          // Checkout button
          SizedBox(
            width: double.infinity,
            height: 58,
            child: ElevatedButton(
              onPressed: _isProcessingPayment ? null : () => _startCheckoutFlow(cart),
              style: ElevatedButton.styleFrom(
                backgroundColor: _maroon,
                foregroundColor: Colors.white,
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(22),
                ),
                elevation: 8,
                shadowColor: _maroon.withValues(alpha: 0.5),
              ),
              child: _isProcessingPayment 
                ? const SizedBox(
                    width: 24, 
                    height: 24, 
                    child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2)
                  )
                : const Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(Icons.payment_rounded, size: 22),
                  SizedBox(width: 10),
                  Text(
                    'Pay via Razorpay',
                    style: TextStyle(
                      fontSize: 18,
                      fontWeight: FontWeight.w800,
                      letterSpacing: 0.5,
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    ).animate().fadeIn(duration: 400.ms).slideY(begin: 0.1, end: 0);
  }

  Widget _buildPriceRow(String label, double amount, {bool isFree = false}) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text(
          label,
          style: TextStyle(
            fontSize: 14,
            fontWeight: FontWeight.w500,
            color: _darkText.withValues(alpha: 0.6),
          ),
        ),
        isFree
            ? Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 10, vertical: 3),
                decoration: BoxDecoration(
                  color: Colors.green.withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: const Text(
                  'FREE',
                  style: TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w800,
                    color: Colors.green,
                  ),
                ),
              )
            : Text(
                '\u{20B9}${amount.toStringAsFixed(0)}',
                style: TextStyle(
                  fontSize: 14,
                  fontWeight: FontWeight.w600,
                  color: _darkText.withValues(alpha: 0.7),
                ),
              ),
      ],
    );
  }

  void _showClearCartDialog(BuildContext context, CartProvider cart) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: const Text(
          'Clear Cart?',
          style: TextStyle(fontWeight: FontWeight.w800, color: _darkText),
        ),
        content: const Text('Remove all items from your cart?'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: Text(
              'Cancel',
              style: TextStyle(
                color: _maroon.withValues(alpha: 0.6),
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
          TextButton(
            onPressed: () {
              Navigator.pop(ctx);
              cart.clear();
            },
            child: const Text(
              'Clear',
              style: TextStyle(
                color: _maroon,
                fontWeight: FontWeight.w800,
              ),
            ),
          ),
        ],
      ),
    );
  }

  void _showMockPaymentDialog(BuildContext context, CartProvider cart, String orderId) {
    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: const Text(
          'Mock Payment Gateway (Test Mode)',
          style: TextStyle(fontWeight: FontWeight.w800, color: _maroon),
        ),
        content: Text(
          'You are in test mode.\n\nSimulating a payment of \u{20B9}${cart.totalAmount.toStringAsFixed(0)}.\nChoose the desired outcome to continue testing your flow:',
        ),
        actions: [
          TextButton(
            onPressed: () {
              Navigator.pop(ctx);
              _processFailedOrder('Mock Payment Cancelled by User');
            },
            child: Text(
              'Fail Payment',
              style: TextStyle(
                color: _maroon.withValues(alpha: 0.6),
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(
              backgroundColor: _maroon,
              foregroundColor: Colors.white,
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(12),
              ),
            ),
            onPressed: () {
              Navigator.pop(ctx);
              _processSuccessfulOrder(
                orderId,
                'pay_mock_${DateTime.now().millisecondsSinceEpoch}',
                'mock_signature'
              );
            },
            child: const Text(
              'Simulate Success',
              style: TextStyle(fontWeight: FontWeight.w800),
            ),
          ),
        ],
      ),
    );
  }
}

