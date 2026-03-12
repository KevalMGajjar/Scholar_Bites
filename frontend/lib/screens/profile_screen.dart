import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'dart:io';
import '../services/order_service.dart';
import '../services/auth_service.dart';
import '../utils/token_storage.dart';
import 'welcome_screen.dart';
import 'preferences_screen.dart';
import 'feedback_screen.dart';
import 'notifications_screen.dart';
import 'order_qr_screen.dart';
import '../services/payment_service.dart';
import '../services/wallet_service.dart';
import 'package:razorpay_flutter/razorpay_flutter.dart';
import '../utils/custom_toast.dart';

// ─── Colors ──────────────────────────────────────────
const _maroon = Color(0xFF8B1C28);
const _darkText = Color(0xFF4A0E13);
const _bg = Color(0xFFFCF9F5);

// ─── Placeholder Screens ─────────────────────────────
class WalletScreen extends StatefulWidget {
  const WalletScreen({super.key});
  @override
  State<WalletScreen> createState() => _WalletScreenState();
}

class _WalletScreenState extends State<WalletScreen> {
  double _balance = 0.0;
  List<dynamic> _transactions = [];
  bool _isLoading = true;
  bool _isProcessingPayment = false;
  late PaymentService _paymentService;

  @override
  void initState() {
    super.initState();
    _fetchWalletData();
    _paymentService = PaymentService(
      onSuccess: _handlePaymentSuccess,
      onFailure: _handlePaymentFailure,
      onExternalWallet: _handleExternalWallet,
    );
  }

  @override
  void dispose() {
    _paymentService.dispose();
    super.dispose();
  }

  Future<void> _fetchWalletData() async {
    try {
      final data = await WalletService().getWalletData();
      if (mounted) {
        setState(() {
          _balance = double.parse(data['balance'].toString());
          _transactions = data['transactions'] ?? [];
          _isLoading = false;
        });
      }
    } catch (e) {
      if (mounted) setState(() => _isLoading = false);
      CustomToast.showErrorToast(context, 'Failed to load wallet data');
    }
  }

  void _handlePaymentSuccess(PaymentSuccessResponse response) async {
    try {
      if (response.orderId == null || response.paymentId == null || response.signature == null) {
        throw Exception('Invalid Razorpay response');
      }
      
      // We pass 0 as amount because backend verifies using the order_id, 
      // but if backend needs amount we can pass it, wait, verifying signature is enough.
      // But verifyTopUp requires amount, let's extract it from the local state if needed.
      // Actually backend just needs the proof. We will pass a dummy amount and let backend infer, 
      // NO wait, verifyTopUp requires amount. Let's store amount being requested locally.
      
      await WalletService().verifyTopUp(
        response.orderId!,
        response.paymentId!,
        response.signature!,
        _lastRequestedAmount,
      );

      CustomToast.showSuccessToast(context, 'Wallet topped up successfully!');
      _fetchWalletData();
    } catch (e) {
      CustomToast.showErrorToast(context, 'Payment verification failed');
    } finally {
      if (mounted) setState(() => _isProcessingPayment = false);
    }
  }

  void _handlePaymentFailure(PaymentFailureResponse response) {
    if (mounted) {
      setState(() => _isProcessingPayment = false);
      CustomToast.showErrorToast(context, 'Payment Failed: ${response.message}');
    }
  }

  void _handleExternalWallet(ExternalWalletResponse response) {
    if (mounted) {
      CustomToast.showNeutralToast(context, 'External Wallet: ${response.walletName}');
    }
  }

  double _lastRequestedAmount = 0.0;

  void _startTopUp(double amount) async {
    Navigator.pop(context); // close bottom sheet
    if (amount <= 0) return;
    
    setState(() => _isProcessingPayment = true);
    _lastRequestedAmount = amount;

    try {
      final orderData = await WalletService().createTopUpOrder(amount);
      final email = await TokenStorage.getUserEmail() ?? 'student@example.com';
      final phone = await TokenStorage.getPhone() ?? '9999999999';

      _paymentService.openCheckout(
        amountInPaise: orderData['amount_in_paise'],
        orderId: orderData['payment_id'],
        name: "Campus Wallet",
        description: "Wallet Top-up",
        email: email,
        contact: phone,
      );
    } catch (e) {
      if (mounted) setState(() => _isProcessingPayment = false);
      CustomToast.showErrorToast(context, 'Failed to initiate payment');
    }
  }

  void _showTopUpSheet() {
    final TextEditingController amountController = TextEditingController();
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (context) => Padding(
        padding: EdgeInsets.only(bottom: MediaQuery.of(context).viewInsets.bottom),
        child: Container(
          padding: const EdgeInsets.all(24),
          decoration: const BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text(
                'Top-up Wallet',
                style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold, color: _darkText),
              ),
              const SizedBox(height: 16),
              Container(
                decoration: BoxDecoration(
                  color: _bg,
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: _maroon.withValues(alpha: 0.1)),
                ),
                child: TextField(
                  controller: amountController,
                  keyboardType: TextInputType.number,
                  style: const TextStyle(fontSize: 24, fontWeight: FontWeight.bold, color: _maroon),
                  decoration: const InputDecoration(
                    prefixText: '\u{20B9} ',
                    prefixStyle: TextStyle(fontSize: 24, fontWeight: FontWeight.bold, color: _maroon),
                    border: InputBorder.none,
                    contentPadding: EdgeInsets.symmetric(horizontal: 20, vertical: 16),
                    hintText: 'Enter amount',
                    hintStyle: TextStyle(fontSize: 20, color: Colors.grey),
                  ),
                ),
              ),
              const SizedBox(height: 24),
              SizedBox(
                width: double.infinity,
                height: 54,
                child: ElevatedButton(
                  style: ElevatedButton.styleFrom(
                    backgroundColor: _maroon,
                    foregroundColor: Colors.white,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                  ),
                  onPressed: () {
                    final amount = double.tryParse(amountController.text) ?? 0;
                    _startTopUp(amount);
                  },
                  child: const Text('Proceed to Pay', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600)),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('My Wallet', style: TextStyle(fontWeight: FontWeight.w600)),
        backgroundColor: Colors.transparent,
        elevation: 0,
        foregroundColor: _darkText,
      ),
      backgroundColor: _bg,
      body: _isLoading
          ? const Center(child: CircularProgressIndicator(color: _maroon))
          : Stack(
              children: [
                RefreshIndicator(
                  onRefresh: _fetchWalletData,
                  color: _maroon,
                  child: ListView(
                    padding: const EdgeInsets.all(24),
                    children: [
                      // Balance Card
                      Container(
                        padding: const EdgeInsets.all(32),
                        decoration: BoxDecoration(
                          gradient: const LinearGradient(
                            colors: [_maroon, Color(0xFF6B151F)],
                            begin: Alignment.topLeft,
                            end: Alignment.bottomRight,
                          ),
                          borderRadius: BorderRadius.circular(24),
                          boxShadow: [
                            BoxShadow(
                              color: _maroon.withValues(alpha: 0.3),
                              blurRadius: 20,
                              offset: const Offset(0, 10),
                            ),
                          ],
                        ),
                        child: Column(
                          children: [
                            const Text(
                              'Available Balance',
                              style: TextStyle(color: Colors.white70, fontSize: 16, fontWeight: FontWeight.w500),
                            ),
                            const SizedBox(height: 8),
                            Text(
                              '\u{20B9}${_balance.toStringAsFixed(2)}',
                              style: const TextStyle(color: Colors.white, fontSize: 40, fontWeight: FontWeight.bold),
                            ),
                            const SizedBox(height: 24),
                            ElevatedButton.icon(
                              onPressed: _showTopUpSheet,
                              icon: const Icon(Icons.add_rounded, size: 20),
                              label: const Text('Top-up Wallet'),
                              style: ElevatedButton.styleFrom(
                                backgroundColor: Colors.white,
                                foregroundColor: _maroon,
                                padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
                                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                                elevation: 0,
                              ),
                            ),
                          ],
                        ),
                      ).animate().fadeIn().slideY(begin: 0.1),
                      const SizedBox(height: 32),
                      const Text(
                        'Recent Transactions',
                        style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: _darkText),
                      ),
                      const SizedBox(height: 16),
                      if (_transactions.isEmpty)
                        const Center(
                          child: Padding(
                            padding: EdgeInsets.all(32.0),
                            child: Text('No transactions yet.', style: TextStyle(color: Colors.grey)),
                          ),
                        )
                      else
                        ..._transactions.map((tx) {
                          final isCredit = tx['type'] == 'credit';
                          final amount = double.parse(tx['amount'].toString());
                          final date = DateTime.parse(tx['created_at']);
                          
                          return Container(
                            margin: const EdgeInsets.only(bottom: 12),
                            padding: const EdgeInsets.all(16),
                            decoration: BoxDecoration(
                              color: Colors.white,
                              borderRadius: BorderRadius.circular(16),
                              border: Border.all(color: _maroon.withValues(alpha: 0.05)),
                            ),
                            child: Row(
                              children: [
                                Container(
                                  padding: const EdgeInsets.all(12),
                                  decoration: BoxDecoration(
                                    color: isCredit ? Colors.green.withValues(alpha: 0.1) : Colors.red.withValues(alpha: 0.1),
                                    shape: BoxShape.circle,
                                  ),
                                  child: Icon(
                                    isCredit ? Icons.arrow_downward_rounded : Icons.arrow_upward_rounded,
                                    color: isCredit ? Colors.green : Colors.red,
                                    size: 20,
                                  ),
                                ),
                                const SizedBox(width: 16),
                                Expanded(
                                  child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      Text(
                                        tx['description'] ?? (isCredit ? 'Top-up' : 'Payment'),
                                        style: const TextStyle(fontWeight: FontWeight.bold, color: _darkText, fontSize: 15),
                                      ),
                                      const SizedBox(height: 4),
                                      Text(
                                        '${date.day}/${date.month}/${date.year} ${date.hour}:${date.minute.toString().padLeft(2, '0')}',
                                        style: TextStyle(color: Colors.grey.shade500, fontSize: 12),
                                      ),
                                    ],
                                  ),
                                ),
                                Text(
                                  '${isCredit ? '+' : '-'}\u{20B9}${amount.toStringAsFixed(2)}',
                                  style: TextStyle(
                                    fontWeight: FontWeight.bold,
                                    color: isCredit ? Colors.green : _darkText,
                                    fontSize: 16,
                                  ),
                                ),
                              ],
                            ),
                          ).animate().fadeIn().slideX(begin: 0.1);
                        }),
                    ],
                  ),
                ),
                if (_isProcessingPayment)
                  Container(
                    color: Colors.black.withValues(alpha: 0.3),
                    child: const Center(
                      child: CircularProgressIndicator(color: _maroon),
                    ),
                  ),
              ],
            ),
    );
  }
}

class OrderHistoryScreen extends StatefulWidget {
  const OrderHistoryScreen({super.key});
  @override
  State<OrderHistoryScreen> createState() => _OrderHistoryScreenState();
}

class _OrderHistoryScreenState extends State<OrderHistoryScreen> {
  List<dynamic> _orders = [];
  bool _isLoading = true;
  final Set<int> _expandedOrders = {};

  static const _statusColors = {
    'pending': Color(0xFFF59E0B),
    'preparing': Color(0xFF3B82F6),
    'ready': Color(0xFF10B981),
    'completed': Color(0xFF6B7280),
    'cancelled': Color(0xFFEF4444),
  };

  static const _statusIcons = {
    'pending': Icons.schedule_rounded,
    'preparing': Icons.restaurant_rounded,
    'ready': Icons.check_circle_rounded,
    'completed': Icons.verified_rounded,
    'cancelled': Icons.cancel_rounded,
  };

  @override
  void initState() {
    super.initState();
    _fetchOrders();
  }

  Future<void> _fetchOrders() async {
    try {
      final orders = await OrderService().getMyOrders();
      if (mounted) {
        setState(() {
          _orders = orders;
          _isLoading = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() => _isLoading = false);
      }
    }
  }

  String _formatDate(String? dateStr) {
    if (dateStr == null) return '';
    try {
      final date = DateTime.parse(dateStr).toLocal();
      final now = DateTime.now();
      final diff = now.difference(date);

      if (diff.inMinutes < 60) return '${diff.inMinutes}m ago';
      if (diff.inHours < 24) return '${diff.inHours}h ago';
      if (diff.inDays < 7) return '${diff.inDays}d ago';

      final months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      return '${date.day} ${months[date.month - 1]}, ${date.year}';
    } catch (_) {
      return '';
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: _bg,
      appBar: AppBar(
        title: const Text('My Orders',
            style: TextStyle(fontWeight: FontWeight.w800, color: _darkText)),
        backgroundColor: Colors.transparent,
        elevation: 0,
        foregroundColor: _darkText,
      ),
      body: _isLoading
          ? const Center(
              child: CircularProgressIndicator(color: _maroon, strokeWidth: 2))
          : _orders.isEmpty
              ? _buildEmptyState()
              : RefreshIndicator(
                  color: _maroon,
                  onRefresh: _fetchOrders,
                  child: ListView.builder(
                    physics: const AlwaysScrollableScrollPhysics(),
                    padding: const EdgeInsets.fromLTRB(20, 8, 20, 100),
                    itemCount: _orders.length,
                    itemBuilder: (context, index) =>
                        _buildOrderCard(_orders[index], index),
                  ),
                ),
    );
  }

  Widget _buildEmptyState() {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Container(
            width: 110,
            height: 110,
            decoration: BoxDecoration(
              color: _maroon.withValues(alpha: 0.06),
              shape: BoxShape.circle,
            ),
            child: const Center(
                child: Text('\u{1F4E6}', style: TextStyle(fontSize: 48))),
          ),
          const SizedBox(height: 20),
          const Text('No orders yet',
              style: TextStyle(
                  fontSize: 20, fontWeight: FontWeight.w800, color: _darkText)),
          const SizedBox(height: 8),
          Text('Your order history will appear here',
              style: TextStyle(
                  fontSize: 14,
                  color: _darkText.withValues(alpha: 0.4),
                  fontWeight: FontWeight.w500)),
        ],
      ),
    );
  }

  Widget _buildOrderCard(dynamic order, int index) {
    final String orderId = order['id']?.toString() ?? '';
    final String shortId = orderId.length > 8 ? orderId.substring(orderId.length - 8).toUpperCase() : orderId.toUpperCase();
    final String status = order['status'] ?? 'pending';
    final double total = double.tryParse(order['total_amount']?.toString() ?? '0') ?? 0;
    final String restaurant = order['restaurant_name'] ?? 'Restaurant';
    final String dateStr = _formatDate(order['created_at']?.toString());
    final String orderToken = order['order_token']?.toString() ?? '';
    final List items = order['items'] is List ? order['items'] : [];
    final bool isExpanded = _expandedOrders.contains(index);
    final Color statusColor = _statusColors[status] ?? _maroon;
    final IconData statusIcon = _statusIcons[status] ?? Icons.info_rounded;

    return GestureDetector(
      onTap: () {
        setState(() {
          if (isExpanded) {
            _expandedOrders.remove(index);
          } else {
            _expandedOrders.add(index);
          }
        });
      },
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 300),
        curve: Curves.easeOutCubic,
        margin: const EdgeInsets.only(bottom: 14),
        padding: const EdgeInsets.all(18),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(22),
          border: Border.all(
            color: isExpanded
                ? statusColor.withValues(alpha: 0.2)
                : Colors.transparent,
          ),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: 0.04),
              blurRadius: 16,
              offset: const Offset(0, 4),
            ),
          ],
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Header row
            Row(
              children: [
                // Status icon
                Container(
                  width: 44,
                  height: 44,
                  decoration: BoxDecoration(
                    color: statusColor.withValues(alpha: 0.1),
                    borderRadius: BorderRadius.circular(14),
                  ),
                  child: Icon(statusIcon, color: statusColor, size: 22),
                ),
                const SizedBox(width: 14),
                // Order info
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text('Order #$shortId',
                          style: const TextStyle(
                              fontSize: 15,
                              fontWeight: FontWeight.w800,
                              color: _darkText)),
                      const SizedBox(height: 3),
                      Text(restaurant,
                          style: TextStyle(
                              fontSize: 12,
                              fontWeight: FontWeight.w500,
                              color: _darkText.withValues(alpha: 0.45))),
                    ],
                  ),
                ),
                // Amount & date
                Column(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    Text('\u{20B9}${total.toStringAsFixed(0)}',
                        style: const TextStyle(
                            fontSize: 16,
                            fontWeight: FontWeight.w900,
                            color: _maroon)),
                    const SizedBox(height: 3),
                    Text(dateStr,
                        style: TextStyle(
                            fontSize: 11,
                            fontWeight: FontWeight.w500,
                            color: _darkText.withValues(alpha: 0.35))),
                  ],
                ),
              ],
            ),

            const SizedBox(height: 12),

            // Status badge + item count
            Row(
              children: [
                Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                  decoration: BoxDecoration(
                    color: statusColor.withValues(alpha: 0.1),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Text(
                    status[0].toUpperCase() + status.substring(1),
                    style: TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.w700,
                        color: statusColor),
                  ),
                ),
                const SizedBox(width: 8),
                Text(
                  '${items.length} item${items.length != 1 ? 's' : ''}',
                  style: TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w500,
                      color: _darkText.withValues(alpha: 0.4)),
                ),
                const Spacer(),
                AnimatedRotation(
                  duration: const Duration(milliseconds: 200),
                  turns: isExpanded ? 0.5 : 0,
                  child: Icon(Icons.keyboard_arrow_down_rounded,
                      size: 22, color: _darkText.withValues(alpha: 0.3)),
                ),
              ],
            ),

            // Expanded items
            if (isExpanded && items.isNotEmpty) ...[
              const SizedBox(height: 14),
              Container(
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(
                  color: _bg,
                  borderRadius: BorderRadius.circular(16),
                ),
                child: Column(
                  children: [
                    ...items.where((i) => i['item_name'] != null).map<Widget>((item) {
                      final String itemName = item['item_name'] ?? 'Item';
                      final int qty = item['quantity'] ?? 1;
                      final double price =
                          double.tryParse(item['price_at_time']?.toString() ?? '0') ?? 0;
                      return Padding(
                        padding: const EdgeInsets.only(bottom: 10),
                        child: Row(
                          children: [
                            Container(
                              width: 30,
                              height: 30,
                              decoration: BoxDecoration(
                                color: _maroon.withValues(alpha: 0.08),
                                borderRadius: BorderRadius.circular(8),
                              ),
                              child: Center(
                                child: Text('${qty}x',
                                    style: const TextStyle(
                                        fontSize: 11,
                                        fontWeight: FontWeight.w800,
                                        color: _maroon)),
                              ),
                            ),
                            const SizedBox(width: 12),
                            Expanded(
                              child: Text(itemName,
                                  style: const TextStyle(
                                      fontSize: 13,
                                      fontWeight: FontWeight.w600,
                                      color: _darkText)),
                            ),
                            Text(
                                '\u{20B9}${(price * qty).toStringAsFixed(0)}',
                                style: TextStyle(
                                    fontSize: 13,
                                    fontWeight: FontWeight.w700,
                                    color: _darkText.withValues(alpha: 0.7))),
                          ],
                        ),
                      );
                    }),
                    // Divider + Total
                    Container(
                      margin: const EdgeInsets.only(top: 4),
                      padding: const EdgeInsets.only(top: 10),
                      decoration: BoxDecoration(
                        border: Border(
                          top: BorderSide(
                              color: _darkText.withValues(alpha: 0.08)),
                        ),
                      ),
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Text('Total',
                              style: TextStyle(
                                  fontSize: 14,
                                  fontWeight: FontWeight.w700,
                                  color: _darkText.withValues(alpha: 0.5))),
                          Text('\u{20B9}${total.toStringAsFixed(0)}',
                              style: const TextStyle(
                                  fontSize: 16,
                                  fontWeight: FontWeight.w900,
                                  color: _maroon)),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
              // Show QR button for active orders
              if (isExpanded &&
                  orderToken.isNotEmpty &&
                  ['pending', 'preparing', 'ready'].contains(status)) ...[
                const SizedBox(height: 12),
                SizedBox(
                  width: double.infinity,
                  height: 46,
                  child: ElevatedButton.icon(
                    onPressed: () {
                      Navigator.push(
                        context,
                        MaterialPageRoute(
                          builder: (_) => OrderQrScreen(
                            orderToken: orderToken,
                            orderId: orderId,
                            status: status,
                            amount: total,
                            restaurantName: restaurant,
                          ),
                        ),
                      );
                    },
                    icon: const Icon(Icons.qr_code_2_rounded, size: 20),
                    label: const Text(
                      'Show QR at Counter',
                      style: TextStyle(
                          fontWeight: FontWeight.w700, fontSize: 13),
                    ),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: _maroon,
                      foregroundColor: Colors.white,
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(14),
                      ),
                      elevation: 0,
                    ),
                  ),
                ),
              ],
            ],
          ],
        ),
      ),
    ).animate().fadeIn(delay: (50 * index).ms, duration: 300.ms);
  }
}

// ─── Main Profile ────────────────────────────────────
class ProfileScreen extends StatefulWidget {
  const ProfileScreen({super.key});
  @override
  State<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends State<ProfileScreen> {
  File? _profileImage;
  String _userPhone = '';
  double _walletBalance = 0.0;

  @override
  void initState() {
    super.initState();
    _loadUserProfile();
  }

  Future<void> _loadUserProfile() async {
    final phone = await TokenStorage.getPhone();
    if (mounted) {
      setState(() {
        _userPhone = phone ?? '';
      });
    }
    // Fetch wallet balance for the menu card
    try {
      final data = await WalletService().getWalletData();
      if (mounted) {
        setState(() {
          _walletBalance = double.tryParse(data['balance'].toString()) ?? 0.0;
        });
      }
    } catch (_) {}
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: _bg,
      body: SingleChildScrollView(
        physics: const BouncingScrollPhysics(),
        child: Column(
          children: [
            // ── Premium Header ──────────────────────
            _buildHeader(),

            // ── Menu Sections ───────────────────────
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 20),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const SizedBox(height: 28),

                  _sectionTitle('Account'),
                  const SizedBox(height: 12),
                  _menuGroup([
                    _MenuItem(
                      icon: Icons.account_balance_wallet_rounded,
                      label: 'Wallet',
                      subtitle: 'Balance: \u{20B9}${_walletBalance.toStringAsFixed(2)}',
                      emoji: '\u{1F4B0}',
                      onTap: () => _navigate(const WalletScreen()),
                    ),
                    _MenuItem(
                      icon: Icons.receipt_long_rounded,
                      label: 'Order History',
                      subtitle: 'View past orders',
                      emoji: '\u{1F4CB}',
                      onTap: () => _navigate(const OrderHistoryScreen()),
                    ),
                  ]),

                  const SizedBox(height: 24),
                  _sectionTitle('Settings'),
                  const SizedBox(height: 12),
                  _menuGroup([
                    _MenuItem(
                      icon: Icons.tune_rounded,
                      label: 'Preferences',
                      subtitle: 'Dietary, allergies',
                      emoji: '\u{2699}\u{FE0F}',
                      onTap: () => _navigate(const PreferencesScreen()),
                    ),
                    _MenuItem(
                      icon: Icons.notifications_active_rounded,
                      label: 'Notifications',
                      subtitle: 'Push, email alerts',
                      emoji: '\u{1F514}',
                      onTap: () => _navigate(const NotificationsScreen()),
                    ),
                    _MenuItem(
                      icon: Icons.chat_bubble_outline_rounded,
                      label: 'Feedback',
                      subtitle: 'Help us improve',
                      emoji: '\u{1F4AC}',
                      onTap: () => _navigate(const FeedbackScreen()),
                    ),
                  ]),

                  const SizedBox(height: 24),

                  // Logout
                  GestureDetector(
                    onTap: _logout,
                    child: Container(
                      width: double.infinity,
                      padding: const EdgeInsets.symmetric(vertical: 16),
                      decoration: BoxDecoration(
                        color: Colors.red.withValues(alpha: 0.06),
                        borderRadius: BorderRadius.circular(20),
                        border: Border.all(
                            color: Colors.red.withValues(alpha: 0.12)),
                      ),
                      child: const Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Icon(Icons.logout_rounded,
                              color: Colors.redAccent, size: 20),
                          SizedBox(width: 10),
                          Text(
                            'Log Out',
                            style: TextStyle(
                              color: Colors.redAccent,
                              fontSize: 16,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ).animate().fadeIn(delay: 500.ms, duration: 300.ms),

                  const SizedBox(height: 20),

                  // App version
                  Center(
                    child: Text(
                      'Scholar Bites v1.0.0',
                      style: TextStyle(
                        fontSize: 12,
                        color: _darkText.withValues(alpha: 0.25),
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                  ),
                  const SizedBox(height: 32),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  // ── HEADER ──────────────────────────────────────────
  Widget _buildHeader() {
    return Container(
      width: double.infinity,
      decoration: const BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [Color(0xFF8B1C28), Color(0xFF5D121B), Color(0xFF3A0B10)],
        ),
        borderRadius: BorderRadius.vertical(bottom: Radius.circular(36)),
      ),
      child: SafeArea(
        bottom: false,
        child: Padding(
          padding: const EdgeInsets.fromLTRB(24, 12, 24, 28),
          child: Column(
            children: [
              // Top bar
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  GestureDetector(
                    onTap: () => Navigator.pop(context),
                    child: Container(
                      width: 40,
                      height: 40,
                      decoration: BoxDecoration(
                        color: Colors.white.withValues(alpha: 0.12),
                        borderRadius: BorderRadius.circular(14),
                      ),
                      child: const Icon(Icons.arrow_back_ios_new_rounded,
                          color: Colors.white, size: 18),
                    ),
                  ),
                  const Text(
                    'Profile',
                    style: TextStyle(
                      color: Colors.white,
                      fontSize: 18,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                  const SizedBox(width: 40),
                ],
              ),
              const SizedBox(height: 24),

              // Avatar
              Container(
                width: 100,
                height: 100,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  border: Border.all(color: Colors.white, width: 3),
                  boxShadow: [
                    BoxShadow(
                      color: Colors.black.withValues(alpha: 0.3),
                      blurRadius: 20,
                      offset: const Offset(0, 8),
                    ),
                  ],
                  image: DecorationImage(
                    image: _profileImage != null
                        ? FileImage(_profileImage!) as ImageProvider
                        : const NetworkImage(
                            'https://www.docbox.asia/images/dummy.png'),
                    fit: BoxFit.cover,
                  ),
                ),
              ).animate().scaleXY(
                  begin: 0.8,
                  end: 1.0,
                  duration: 400.ms,
                  curve: Curves.easeOutBack),
              const SizedBox(height: 14),

              // Phone Number
              Text(
                _userPhone.isNotEmpty ? '+91 $_userPhone' : 'Student',
                style: const TextStyle(
                  color: Colors.white,
                  fontSize: 22,
                  fontWeight: FontWeight.w900,
                ),
              ).animate().fadeIn(delay: 150.ms, duration: 300.ms),

              const SizedBox(height: 22),
            ],
          ),
        ),
      ),
    );
  }

  // ── SECTION TITLE ──────────────────────────────────
  Widget _sectionTitle(String text) {
    return Text(
      text,
      style: const TextStyle(
        fontSize: 16,
        fontWeight: FontWeight.w800,
        color: _darkText,
        letterSpacing: 0.5,
      ),
    ).animate().fadeIn(delay: 400.ms, duration: 300.ms);
  }

  // ── MENU GROUP ─────────────────────────────────────
  Widget _menuGroup(List<_MenuItem> items) {
    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(22),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.04),
            blurRadius: 16,
            offset: const Offset(0, 6),
          ),
        ],
      ),
      child: Column(
        children: List.generate(items.length, (i) {
          final item = items[i];
          final isLast = i == items.length - 1;
          return Column(
            children: [
              Material(
                color: Colors.transparent,
                child: InkWell(
                  onTap: item.onTap,
                  borderRadius: BorderRadius.vertical(
                    top: i == 0 ? const Radius.circular(22) : Radius.zero,
                    bottom: isLast ? const Radius.circular(22) : Radius.zero,
                  ),
                  child: Padding(
                    padding: const EdgeInsets.symmetric(
                        horizontal: 18, vertical: 16),
                    child: Row(
                      children: [
                        // Emoji circle
                        Container(
                          width: 42,
                          height: 42,
                          decoration: BoxDecoration(
                            color: _maroon.withValues(alpha: 0.06),
                            borderRadius: BorderRadius.circular(14),
                          ),
                          child: Center(
                            child: Text(item.emoji,
                                style: const TextStyle(fontSize: 20)),
                          ),
                        ),
                        const SizedBox(width: 16),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                item.label,
                                style: const TextStyle(
                                  fontWeight: FontWeight.w700,
                                  fontSize: 15,
                                  color: _darkText,
                                ),
                              ),
                              if (item.subtitle != null) ...[
                                const SizedBox(height: 2),
                                Text(
                                  item.subtitle!,
                                  style: TextStyle(
                                    fontSize: 12,
                                    color: _darkText.withValues(alpha: 0.4),
                                    fontWeight: FontWeight.w500,
                                  ),
                                ),
                              ],
                            ],
                          ),
                        ),
                        Icon(Icons.arrow_forward_ios_rounded,
                            size: 14, color: _maroon.withValues(alpha: 0.3)),
                      ],
                    ),
                  ),
                ),
              ),
              if (!isLast)
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 20),
                  child: Divider(
                      height: 1, color: Colors.grey.withValues(alpha: 0.08)),
                ),
            ],
          );
        }),
      ),
    )
        .animate()
        .fadeIn(delay: 450.ms, duration: 350.ms)
        .slideY(begin: 0.05, end: 0);
  }

  // ── NAVIGATION HELPER ──────────────────────────────
  void _navigate(Widget screen) {
    Navigator.push(context, MaterialPageRoute(builder: (context) => screen));
  }

  // ── LOGOUT ─────────────────────────────────────────
  void _logout() {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
        title: const Text('Log Out',
            style: TextStyle(fontWeight: FontWeight.w800, color: _darkText)),
        content: const Text('Are you sure you want to log out?'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: Text('Cancel',
                style: TextStyle(
                    color: _darkText.withValues(alpha: 0.5),
                    fontWeight: FontWeight.w600)),
          ),
          ElevatedButton(
            onPressed: () async {
              Navigator.pop(context);
              await AuthService.logout();
              if (!context.mounted) return;
              Navigator.pushAndRemoveUntil(
                context,
                MaterialPageRoute(builder: (context) => const WelcomeScreen()),
                (route) => false,
              );
            },
            style: ElevatedButton.styleFrom(
              backgroundColor: Colors.redAccent,
              foregroundColor: Colors.white,
              shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(14)),
            ),
            child: const Text('Log Out',
                style: TextStyle(fontWeight: FontWeight.w700)),
          ),
        ],
      ),
    );
  }
}

// ── Helper model ─────────────────────────────────────
class _MenuItem {
  final IconData icon;
  final String label;
  final String? subtitle;
  final String emoji;
  final VoidCallback onTap;

  _MenuItem({
    required this.icon,
    required this.label,
    this.subtitle,
    required this.emoji,
    required this.onTap,
  });
}
