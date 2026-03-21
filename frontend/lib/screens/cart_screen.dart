import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:razorpay_flutter/razorpay_flutter.dart';
import 'package:cached_network_image/cached_network_image.dart';
import '../widgets/spoon_loader.dart';
import '../models/cart_model.dart';
import '../services/order_service.dart';
import '../services/payment_service.dart';
import '../services/wallet_service.dart';
import '../utils/token_storage.dart';
import '../services/menu_service.dart';
import 'detail_screen.dart';
import 'order_success_screen.dart';

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
  String? _currentOrderToken;
  String? _currentDbOrderId;
  String _currentRestaurantName = 'the counter';
  double _walletBalance = 0.0;
  bool _isLoadingBalance = true;
  
  Map<String, dynamic> _availabilityMap = {};

  @override
  void initState() {
    super.initState();
    _paymentService = PaymentService(
      onSuccess: _handlePaymentSuccess,
      onFailure: _handlePaymentError,
      onExternalWallet: _handleExternalWallet,
    );
    _fetchWalletBalance();
    
    // Fetch availability after the first frame
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _checkAvailability();
    });
  }

  Future<void> _checkAvailability() async {
    final cart = Provider.of<CartProvider>(context, listen: false);
    if (cart.items.isEmpty) return;

    final itemIds = cart.items.keys.toList();
    final availMap = await MenuService().checkAvailability(itemIds);
    
    if (mounted) {
      setState(() {
        _availabilityMap = availMap;
      });
    }
  }

  Future<void> _fetchWalletBalance() async {
    try {
      final data = await WalletService().getWalletData();
      if (mounted) {
        setState(() {
          _walletBalance = double.tryParse(data['balance'].toString()) ?? 0.0;
          _isLoadingBalance = false;
        });
      }
    } catch (_) {
      if (mounted) setState(() => _isLoadingBalance = false);
    }
  }

  @override
  void dispose() {
    _paymentService.dispose();
    super.dispose();
  }

  // --- Custom Toast ---

  void _showCustomToast(String message, {bool isError = false, IconData icon = Icons.check_circle_rounded}) {
    final overlay = Overlay.of(context);
    late OverlayEntry entry;
    entry = OverlayEntry(
      builder: (context) => _CustomToastWidget(
        message: message,
        isError: isError,
        icon: icon,
        onDismiss: () => entry.remove(),
      ),
    );
    overlay.insert(entry);
  }

  // --- Razorpay Handlers ---

  void _handlePaymentSuccess(PaymentSuccessResponse response) async {
    debugPrint('✅ RAZORPAY SUCCESS: orderId=${response.orderId}, paymentId=${response.paymentId}, signature=${response.signature}');
    _processSuccessfulOrder(response.orderId!, response.paymentId!, response.signature!);
  }

  void _processSuccessfulOrder(String orderId, String paymentId, String signature) async {
    debugPrint('🔄 Verifying payment: orderId=$orderId, paymentId=$paymentId');
    try {
      final cart = Provider.of<CartProvider>(context, listen: false);
      final totalAmount = cart.totalAmount;

      await OrderService().verifyPayment(orderId, paymentId, signature);
      debugPrint('✅ Payment verification succeeded!');

      if (mounted) {
        setState(() => _isProcessingPayment = false);
        await cart.clear();

        // Navigate to success screen
        Navigator.of(context).pushReplacement(
          MaterialPageRoute(
            builder: (_) => OrderSuccessScreen(
              orderId: _currentDbOrderId ?? orderId,
              amount: totalAmount,
              orderToken: _currentOrderToken ?? '',
              restaurantName: _currentRestaurantName,
            ),
          ),
        );
      }
    } catch (e) {
      debugPrint('❌ Payment verification FAILED: $e');
      if (mounted) {
        setState(() => _isProcessingPayment = false);
        _showCustomToast('Payment verification failed. Please contact support.', isError: true, icon: Icons.error_outline_rounded);
      }
    }
  }

  void _handlePaymentError(PaymentFailureResponse response) {
    debugPrint('❌ RAZORPAY ERROR: code=${response.code}, message=${response.message}');
    _processFailedOrder(response.message ?? 'Payment was cancelled');
  }

  void _processFailedOrder(String message) {
    if (mounted) {
      setState(() => _isProcessingPayment = false);
      _showCustomToast('Payment Failed: $message', isError: true, icon: Icons.payment_rounded);
    }
  }

  void _handleExternalWallet(ExternalWalletResponse response) {
    if (mounted) {
      _showCustomToast('External Wallet: ${response.walletName}', icon: Icons.account_balance_wallet_rounded);
    }
  }

  // --- Checkout Flow ---

  Future<void> _startCheckoutFlow(CartProvider cart) async {
    if (cart.totalAmount <= 0) return;

    // Check if there are any unavailable items
    final hasUnavailable = cart.items.keys.any((id) {
      final info = _availabilityMap[id];
      if (info == null) return false;
      final stockInfo = info['stock_quantity'] ?? 999;
      return info['is_available'] == false || stockInfo < cart.items[id]!.quantity;
    });

    if (hasUnavailable) {
      _showCustomToast('Please remove unavailable items before checkout.', isError: true, icon: Icons.remove_shopping_cart_rounded);
      return;
    }

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
      _currentOrderToken = orderResponse['order_token'];
      _currentDbOrderId = orderResponse['id'];
      _currentRestaurantName = orderResponse['restaurant_name'] ?? 'the counter';
      // Use exact paise from backend if available, otherwise calculate from amount
      final int amountInPaise;
      if (orderResponse['amount_in_paise'] != null) {
        amountInPaise = int.parse(orderResponse['amount_in_paise'].toString());
      } else {
        amountInPaise = (double.parse(orderResponse['amount'].toString()) * 100).round();
      }
      debugPrint('✅ Order created: razorpayOrderId=$orderId, token=$_currentOrderToken, paise=$amountInPaise');

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
        final errorMsg = e.toString().toLowerCase();
        String friendlyMsg;
        if (errorMsg.contains('not available')) {
          friendlyMsg = 'Some items in your cart are no longer available. Please refresh and try again!';
        } else if (errorMsg.contains('insufficient stock') || errorMsg.contains('stock')) {
          friendlyMsg = 'Oops! Some items just sold out. Remove them and try again.';
        } else if (errorMsg.contains('restaurant') && errorMsg.contains('closed')) {
          friendlyMsg = 'The restaurant is currently closed. Please try again later!';
        } else {
          friendlyMsg = 'Something went wrong. Please check your cart and try again.';
        }
        _showCustomToast(friendlyMsg, isError: true, icon: Icons.remove_shopping_cart_rounded);
      }
    }
  }

  Future<void> _startWalletPayment(CartProvider cart) async {
    if (cart.totalAmount <= 0) return;

    // Check if there are any unavailable items
    final hasUnavailable = cart.items.keys.any((id) {
      final info = _availabilityMap[id];
      if (info == null) return false;
      final stockInfo = info['stock_quantity'] ?? 999;
      return info['is_available'] == false || stockInfo < cart.items[id]!.quantity;
    });

    if (hasUnavailable) {
      _showCustomToast('Please remove unavailable items before checkout.', isError: true, icon: Icons.remove_shopping_cart_rounded);
      return;
    }

    final universityId = await TokenStorage.getUniversityId();
    if (universityId == null || universityId.isEmpty) {
      if (mounted) {
        _showCustomToast('Please log in again.', isError: true, icon: Icons.error_outline_rounded);
      }
      return;
    }

    setState(() => _isProcessingPayment = true);

    try {
      // 1. Create the order on the backend (same as Razorpay flow)
      debugPrint('💰 Creating order for wallet payment...');
      final orderResponse = await OrderService().createOrder(cart.items.values.toList(), universityId);
      final String dbOrderId = orderResponse['id'];
      final String orderToken = orderResponse['order_token'] ?? '';

      // 2. Pay using wallet balance
      debugPrint('💰 Paying order $dbOrderId with wallet...');
      final walletResult = await WalletService().payOrderWithWallet(dbOrderId);

      if (walletResult['status'] == 'success') {
        debugPrint('✅ Wallet payment succeeded! New balance: ${walletResult['balance']}');
        
        if (mounted) {
          final double paidAmount = cart.totalAmount; // capture before clear
          setState(() {
            _isProcessingPayment = false;
            _walletBalance = double.tryParse(walletResult['balance'].toString()) ?? 0.0;
          });
          await cart.clear();

          Navigator.of(context).pushReplacement(
            MaterialPageRoute(
              builder: (_) => OrderSuccessScreen(
                orderId: dbOrderId,
                amount: paidAmount,
                orderToken: walletResult['order_token'] ?? orderToken,
                restaurantName: orderResponse['restaurant_name'] ?? 'the counter',
              ),
            ),
          );
        }
      } else {
        throw Exception(walletResult['message'] ?? 'Wallet payment failed');
      }
    } catch (e) {
      debugPrint('❌ Wallet payment failed: $e');
      if (mounted) {
        setState(() => _isProcessingPayment = false);
        final errorMsg = e.toString().toLowerCase();
        String friendlyMsg;
        if (errorMsg.contains('not available')) {
          friendlyMsg = 'Some items in your cart are no longer available. Please refresh and try again!';
        } else if (errorMsg.contains('insufficient stock') || errorMsg.contains('stock')) {
          friendlyMsg = 'Oops! Some items just sold out. Remove them and try again.';
        } else if (errorMsg.contains('restaurant') && errorMsg.contains('closed')) {
          friendlyMsg = 'The restaurant is currently closed. Please try again later!';
        } else {
          friendlyMsg = 'Something went wrong. Please check your cart and try again.';
        }
        _showCustomToast(friendlyMsg, isError: true, icon: Icons.account_balance_wallet_rounded);
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

              // Availability warning banner if needed
              if (cart.items.keys.any((id) {
                final info = _availabilityMap[id];
                if (info == null) return false;
                final stockInfo = info['stock_quantity'] ?? 999;
                return info['is_available'] == false || stockInfo < cart.items[id]!.quantity;
              }))
                Container(
                  margin: const EdgeInsets.fromLTRB(20, 0, 20, 16),
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: const Color(0xFFFDF0F0),
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(color: _maroon.withValues(alpha: 0.2)),
                  ),
                  child: Row(
                    children: [
                      const Icon(Icons.warning_amber_rounded, color: _maroon, size: 20),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Text(
                          'Your cart contains items that are unavailable or out of stock.',
                          style: TextStyle(
                            color: _maroon.withValues(alpha: 0.9),
                            fontSize: 13,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ),
                    ],
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
                child: Stack(
                  children: [
                    Container(
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
                                child: SpoonLoader(size: 30),
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
                    
                    // Unavailable Overlay
                    if (_availabilityMap[item.food.id] != null &&
                        (_availabilityMap[item.food.id]['is_available'] == false ||
                         (_availabilityMap[item.food.id]['stock_quantity'] ?? 999) < item.quantity))
                      Positioned.fill(
                        child: Container(
                          decoration: BoxDecoration(
                            color: Colors.white.withValues(alpha: 0.7),
                            borderRadius: BorderRadius.circular(20),
                          ),
                          child: Center(
                            child: Container(
                              padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 4),
                              decoration: BoxDecoration(
                                color: _maroon,
                                borderRadius: BorderRadius.circular(8),
                              ),
                              child: const Text(
                                'Unavailable',
                                style: TextStyle(
                                  color: Colors.white,
                                  fontSize: 10,
                                  fontWeight: FontWeight.w800,
                                ),
                              ),
                            ),
                          ),
                        ),
                      ),
                  ],
                ),
              ),
              const SizedBox(width: 16),
              // Food details
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      crossAxisAlignment: CrossAxisAlignment.center,
                      children: [
                        Container(
                          width: 14,
                          height: 14,
                          decoration: BoxDecoration(
                            border: Border.all(
                              color: item.food.isVeg ? const Color(0xFF2E7D32) : const Color(0xFFD32F2F),
                              width: 1.5,
                            ),
                            borderRadius: BorderRadius.circular(3),
                          ),
                          child: Center(
                            child: Container(
                              width: 6,
                              height: 6,
                              decoration: BoxDecoration(
                                color: item.food.isVeg ? const Color(0xFF2E7D32) : const Color(0xFFD32F2F),
                                shape: BoxShape.circle,
                              ),
                            ),
                          ),
                        ),
                        const SizedBox(width: 8),
                        Expanded(
                          child: Text(
                            item.food.name,
                            style: const TextStyle(
                              fontSize: 16,
                              fontWeight: FontWeight.w800,
                              color: _darkText,
                            ),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                      ],
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
    final bool canPayWithWallet = !_isLoadingBalance && _walletBalance >= cart.totalAmount;

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

          // Pay Button (Razorpay)
          SizedBox(
            width: double.infinity,
            height: 56,
            child: ElevatedButton(
              onPressed: _isProcessingPayment ? null : () => _startCheckoutFlow(cart),
              style: ElevatedButton.styleFrom(
                backgroundColor: _maroon,
                foregroundColor: Colors.white,
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(22),
                ),
                elevation: 6,
                shadowColor: _maroon.withValues(alpha: 0.5),
              ),
              child: _isProcessingPayment 
                ? const SizedBox(
                    width: 24, 
                    height: 24, 
                    child: SpoonLoader(size: 24)
                  )
                : const Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(Icons.payment_rounded, size: 22),
                  SizedBox(width: 10),
                  Text(
                    'Pay',
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

          const SizedBox(height: 12),

          // Pay with Wallet Button
          SizedBox(
            width: double.infinity,
            height: 56,
            child: OutlinedButton(
              onPressed: (_isProcessingPayment || !canPayWithWallet)
                  ? null
                  : () => _startWalletPayment(cart),
              style: OutlinedButton.styleFrom(
                side: BorderSide(
                  color: canPayWithWallet ? _maroon : Colors.grey.shade300,
                  width: 1.5,
                ),
                foregroundColor: _maroon,
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(22),
                ),
                disabledForegroundColor: Colors.grey.shade400,
              ),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(Icons.account_balance_wallet_rounded, size: 22,
                    color: canPayWithWallet ? _maroon : Colors.grey.shade400),
                  const SizedBox(width: 10),
                  Text(
                    _isLoadingBalance
                        ? 'Loading Wallet...'
                        : canPayWithWallet
                            ? 'Pay with Wallet (\u{20B9}${_walletBalance.toStringAsFixed(0)})'
                            : 'Wallet (\u{20B9}${_walletBalance.toStringAsFixed(0)} — Insufficient)',
                    style: TextStyle(
                      fontSize: 15,
                      fontWeight: FontWeight.w700,
                      color: canPayWithWallet ? _maroon : Colors.grey.shade400,
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

// ─── Custom Toast Widget ─────────────────────────────────────

class _CustomToastWidget extends StatefulWidget {
  final String message;
  final bool isError;
  final IconData icon;
  final VoidCallback onDismiss;

  const _CustomToastWidget({
    required this.message,
    required this.isError,
    required this.icon,
    required this.onDismiss,
  });

  @override
  State<_CustomToastWidget> createState() => _CustomToastWidgetState();
}

class _CustomToastWidgetState extends State<_CustomToastWidget>
    with SingleTickerProviderStateMixin {
  late AnimationController _controller;
  late Animation<double> _fadeAnim;
  late Animation<Offset> _slideAnim;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 400),
    );
    _fadeAnim = CurvedAnimation(parent: _controller, curve: Curves.easeOut);
    _slideAnim = Tween<Offset>(
      begin: const Offset(0, -1),
      end: Offset.zero,
    ).animate(CurvedAnimation(parent: _controller, curve: Curves.easeOutCubic));

    _controller.forward();

    Future.delayed(const Duration(seconds: 3), () {
      if (mounted) {
        _controller.reverse().then((_) => widget.onDismiss());
      }
    });
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final bgColor = widget.isError
        ? const Color(0xFF8B1C28)
        : const Color(0xFF27AE60);

    return Positioned(
      top: MediaQuery.of(context).padding.top + 12,
      left: 16,
      right: 16,
      child: SlideTransition(
        position: _slideAnim,
        child: FadeTransition(
          opacity: _fadeAnim,
          child: Material(
            color: Colors.transparent,
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
              decoration: BoxDecoration(
                color: bgColor,
                borderRadius: BorderRadius.circular(16),
                boxShadow: [
                  BoxShadow(
                    color: bgColor.withValues(alpha: 0.4),
                    blurRadius: 16,
                    offset: const Offset(0, 6),
                  ),
                ],
              ),
              child: Row(
                children: [
                  Icon(widget.icon, color: Colors.white, size: 24),
                  const SizedBox(width: 14),
                  Expanded(
                    child: Text(
                      widget.message,
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 14,
                        fontWeight: FontWeight.w600,
                      ),
                      maxLines: 3,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                  const SizedBox(width: 8),
                  GestureDetector(
                    onTap: () {
                      _controller.reverse().then((_) => widget.onDismiss());
                    },
                    child: Icon(
                      Icons.close_rounded,
                      color: Colors.white.withValues(alpha: 0.7),
                      size: 20,
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
