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

// ─── Colors ──────────────────────────────────────────
const _maroon = Color(0xFF8B1C28);
const _darkText = Color(0xFF4A0E13);
const _bg = Color(0xFFFCF9F5);

// ─── Placeholder Screens ─────────────────────────────
class WalletScreen extends StatelessWidget {
  const WalletScreen({super.key});
  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('My Wallet'),
        backgroundColor: Colors.transparent,
        elevation: 0,
        foregroundColor: _darkText,
      ),
      backgroundColor: _bg,
      body: Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Container(
              width: 100,
              height: 100,
              decoration: BoxDecoration(
                color: _maroon.withValues(alpha: 0.08),
                shape: BoxShape.circle,
              ),
              child: const Icon(Icons.account_balance_wallet_rounded,
                  size: 48, color: _maroon),
            ),
            const SizedBox(height: 20),
            const Text(
              '\u{20B9}250.00',
              style: TextStyle(
                  fontSize: 32, fontWeight: FontWeight.w900, color: _maroon),
            ),
            const SizedBox(height: 4),
            Text(
              'Available Balance',
              style: TextStyle(
                  fontSize: 14,
                  color: _darkText.withValues(alpha: 0.5),
                  fontWeight: FontWeight.w500),
            ),
          ],
        ),
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

  @override
  void initState() {
    super.initState();
    _fetchOrders();
  }

  Future<void> _fetchOrders() async {
    try {
      final orders = await OrderService().getMyOrders();
      if (mounted)
        setState(() {
          _orders = orders;
          _isLoading = false;
        });
    } catch (e) {
      if (mounted) {
        setState(() => _isLoading = false);
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text('Error: $e')));
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Order History'),
        backgroundColor: Colors.transparent,
        elevation: 0,
        foregroundColor: _darkText,
      ),
      backgroundColor: _bg,
      body: _isLoading
          ? const Center(
              child: CircularProgressIndicator(color: _maroon, strokeWidth: 2))
          : _orders.isEmpty
              ? Center(
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Container(
                        width: 100,
                        height: 100,
                        decoration: BoxDecoration(
                            color: _maroon.withValues(alpha: 0.08),
                            shape: BoxShape.circle),
                        child: const Center(
                            child: Text('\u{1F4E6}',
                                style: TextStyle(fontSize: 40))),
                      ),
                      const SizedBox(height: 16),
                      const Text('No orders yet',
                          style: TextStyle(
                              fontSize: 18,
                              fontWeight: FontWeight.w700,
                              color: _darkText)),
                    ],
                  ),
                )
              : ListView.builder(
                  padding: const EdgeInsets.all(20),
                  itemCount: _orders.length,
                  itemBuilder: (context, index) {
                    final order = _orders[index];
                    final orderId = order['id'].toString().substring(0, 8);
                    final subtotal = order['total_amount'];
                    final status = order['status'];
                    return Container(
                      margin: const EdgeInsets.only(bottom: 12),
                      padding: const EdgeInsets.all(16),
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(20),
                        boxShadow: [
                          BoxShadow(
                              color: Colors.black.withValues(alpha: 0.04),
                              blurRadius: 12,
                              offset: const Offset(0, 4))
                        ],
                      ),
                      child: Row(
                        children: [
                          Container(
                            width: 48,
                            height: 48,
                            decoration: BoxDecoration(
                                color: _maroon.withValues(alpha: 0.08),
                                borderRadius: BorderRadius.circular(14)),
                            child: const Icon(Icons.receipt_long_rounded,
                                color: _maroon, size: 22),
                          ),
                          const SizedBox(width: 14),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text('Order #$orderId',
                                    style: const TextStyle(
                                        fontWeight: FontWeight.w700,
                                        color: _darkText)),
                                const SizedBox(height: 2),
                                Text('$status \u{2022} \u{20B9}$subtotal',
                                    style: TextStyle(
                                        fontSize: 12,
                                        color:
                                            _darkText.withValues(alpha: 0.5))),
                              ],
                            ),
                          ),
                          Icon(Icons.arrow_forward_ios_rounded,
                              size: 14, color: _maroon.withValues(alpha: 0.4)),
                        ],
                      ),
                    )
                        .animate()
                        .fadeIn(delay: (50 * index).ms, duration: 300.ms);
                  },
                ),
    );
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
                      subtitle: 'Balance: \u{20B9}250',
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
