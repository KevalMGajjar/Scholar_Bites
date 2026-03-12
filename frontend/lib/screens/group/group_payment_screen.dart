import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:flutter_animate/flutter_animate.dart';
import '../../services/group_service.dart';
import '../../utils/custom_toast.dart';
import '../../widgets/spoon_loader.dart';
import 'group_waiting_screen.dart';

class GroupPaymentScreen extends StatefulWidget {
  final String groupCode;
  final bool isLeader;
  final String myNickname;
  final List<Map<String, dynamic>> members;
  final String creatorId;

  const GroupPaymentScreen({
    super.key,
    required this.groupCode,
    required this.isLeader,
    required this.myNickname,
    required this.members,
    required this.creatorId,
  });

  @override
  State<GroupPaymentScreen> createState() => _GroupPaymentScreenState();
}

class _GroupPaymentScreenState extends State<GroupPaymentScreen> {
  static const _maroon = Color(0xFF8B1C28);
  static const _darkText = Color(0xFF4A0E13);
  static const _bg = Color(0xFFFCF9F5);

  final _groupService = GroupService();
  bool _isLoading = true;
  bool _isPaying = false;
  double _myShare = 0;
  Map<String, dynamic> _groupState = {};

  @override
  void initState() {
    super.initState();
    _loadPaymentDetails();
  }

  Future<void> _loadPaymentDetails() async {
    try {
      final data = await _groupService.getGroupState(widget.groupCode);
      if (!mounted) return;

      final members = List<Map<String, dynamic>>.from(data['members'] ?? []);
      // Find my share
      for (final m in members) {
        if (m['nickname'] == widget.myNickname) {
          _myShare = double.tryParse(m['share_amount']?.toString() ?? '0') ?? 0;
          break;
        }
      }

      setState(() {
        _groupState = data;
        _isLoading = false;
      });
    } catch (e) {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  Future<void> _payWithWallet() async {
    setState(() => _isPaying = true);
    try {
      final result = await _groupService.payShare(widget.groupCode, method: 'wallet');
      if (!mounted) return;

      if (result['status'] == 'success') {
        CustomToast.showSuccessToast(context, 'Payment successful!');
        _navigateToWaiting();
      }
    } catch (e) {
      if (mounted) {
        CustomToast.showErrorToast(context, 'Payment failed. Check your wallet balance.');
        setState(() => _isPaying = false);
      }
    }
  }

  Future<void> _payWithRazorpay() async {
    setState(() => _isPaying = true);
    try {
      final result = await _groupService.payShare(widget.groupCode, method: 'razorpay');
      if (!mounted) return;

      if (result['status'] == 'razorpay') {
        // Mock payment for now — in production, launch Razorpay checkout
        final mockOrderId = result['order_id'] ?? '';
        final verifyResult = await _groupService.verifyShare(
          code: widget.groupCode,
          razorpayOrderId: mockOrderId,
          razorpayPaymentId: 'mock_payment_${DateTime.now().millisecondsSinceEpoch}',
          razorpaySignature: 'mock_signature',
        );

        if (verifyResult['status'] == 'success' && mounted) {
          CustomToast.showSuccessToast(context, 'Payment successful!');
          _navigateToWaiting();
        }
      }
    } catch (e) {
      if (mounted) {
        CustomToast.showErrorToast(context, 'Payment failed');
        setState(() => _isPaying = false);
      }
    }
  }

  void _navigateToWaiting() {
    Navigator.pushReplacement(
      context,
      MaterialPageRoute(
        builder: (_) => GroupWaitingScreen(
          groupCode: widget.groupCode,
          isLeader: widget.isLeader,
          myNickname: widget.myNickname,
          members: widget.members,
          creatorId: widget.creatorId,
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    if (_isLoading) {
      return Scaffold(backgroundColor: _bg, body: Center(child: SpoonLoader(size: 60)));
    }

    return Scaffold(
      backgroundColor: _bg,
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.center,
            children: [
              const SizedBox(height: 40),

              // Header
              Text('💳', style: const TextStyle(fontSize: 64))
                  .animate().scaleXY(begin: 0, end: 1, curve: Curves.elasticOut, duration: 800.ms),

              const SizedBox(height: 20),

              Text(
                'Your Share',
                style: GoogleFonts.poppins(fontSize: 18, fontWeight: FontWeight.w600, color: _darkText.withValues(alpha: 0.6)),
              ).animate().fadeIn(delay: 200.ms),

              Text(
                '₹${_myShare.toStringAsFixed(0)}',
                style: GoogleFonts.poppins(fontSize: 48, fontWeight: FontWeight.w900, color: _maroon),
              ).animate().fadeIn(delay: 300.ms).scaleXY(begin: 0.8),

              const SizedBox(height: 8),
              Text(
                'for items you added to the group pile',
                style: GoogleFonts.poppins(fontSize: 14, color: _darkText.withValues(alpha: 0.5)),
              ),

              const SizedBox(height: 40),

              // Items breakdown
              if (_groupState['items'] != null)
                Expanded(
                  child: ListView(
                    children: [
                      Text('Your Items', style: GoogleFonts.poppins(fontSize: 15, fontWeight: FontWeight.w800, color: _darkText)),
                      const SizedBox(height: 10),
                      ...(_groupState['items'] as List).where((item) {
                        return true; // Show all items for now
                      }).map((item) => Container(
                        margin: const EdgeInsets.only(bottom: 8),
                        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                        decoration: BoxDecoration(
                          color: Colors.white,
                          borderRadius: BorderRadius.circular(14),
                          border: Border.all(color: _maroon.withValues(alpha: 0.08)),
                        ),
                        child: Row(
                          children: [
                            const Text('🍽️', style: TextStyle(fontSize: 16)),
                            const SizedBox(width: 10),
                            Expanded(
                              child: Text(
                                '${item['item_name']} ×${item['quantity']}',
                                style: GoogleFonts.poppins(fontWeight: FontWeight.w600, fontSize: 13, color: _darkText),
                              ),
                            ),
                            Text(
                              '₹${(double.tryParse(item['price_at_time']?.toString() ?? '0') ?? 0 * (item['quantity'] ?? 1)).toStringAsFixed(0)}',
                              style: GoogleFonts.poppins(fontWeight: FontWeight.w800, fontSize: 13, color: _maroon),
                            ),
                          ],
                        ),
                      )),
                    ],
                  ),
                ),

              if (_myShare <= 0)
                Expanded(
                  child: Center(
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        const Text('🎉', style: TextStyle(fontSize: 48)),
                        const SizedBox(height: 12),
                        Text('Nothing to pay!', style: GoogleFonts.poppins(fontSize: 18, fontWeight: FontWeight.w700, color: _darkText)),
                        Text("You didn't add any items", style: GoogleFonts.poppins(fontSize: 14, color: _darkText.withValues(alpha: 0.5))),
                      ],
                    ),
                  ),
                ),

              // Payment buttons
              if (_isPaying)
                Padding(
                  padding: const EdgeInsets.only(bottom: 30),
                  child: SpoonLoader(size: 50),
                )
              else ...[
                if (_myShare > 0) ...[
                  // Wallet pay
                  GestureDetector(
                    onTap: _payWithWallet,
                    child: Container(
                      width: double.infinity,
                      padding: const EdgeInsets.symmetric(vertical: 18),
                      decoration: BoxDecoration(
                        gradient: const LinearGradient(colors: [_maroon, Color(0xFFB52A3A)]),
                        borderRadius: BorderRadius.circular(18),
                        boxShadow: [BoxShadow(color: _maroon.withValues(alpha: 0.35), blurRadius: 20, offset: const Offset(0, 8))],
                      ),
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          const Icon(Icons.account_balance_wallet_rounded, color: Colors.white, size: 22),
                          const SizedBox(width: 10),
                          Text('Pay ₹${_myShare.toStringAsFixed(0)} with Wallet', style: GoogleFonts.poppins(color: Colors.white, fontSize: 15, fontWeight: FontWeight.w700)),
                        ],
                      ),
                    ),
                  ).animate().fadeIn(delay: 500.ms),

                  const SizedBox(height: 12),

                  // Razorpay
                  GestureDetector(
                    onTap: _payWithRazorpay,
                    child: Container(
                      width: double.infinity,
                      padding: const EdgeInsets.symmetric(vertical: 18),
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(18),
                        border: Border.all(color: _maroon.withValues(alpha: 0.2)),
                      ),
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          const Icon(Icons.payment_rounded, color: _maroon, size: 22),
                          const SizedBox(width: 10),
                          Text('Pay with Razorpay', style: GoogleFonts.poppins(color: _maroon, fontSize: 15, fontWeight: FontWeight.w700)),
                        ],
                      ),
                    ),
                  ).animate().fadeIn(delay: 600.ms),
                ] else
                  GestureDetector(
                    onTap: _navigateToWaiting,
                    child: Container(
                      width: double.infinity,
                      padding: const EdgeInsets.symmetric(vertical: 18),
                      decoration: BoxDecoration(
                        gradient: const LinearGradient(colors: [_maroon, Color(0xFFB52A3A)]),
                        borderRadius: BorderRadius.circular(18),
                      ),
                      child: Center(
                        child: Text('Continue', style: GoogleFonts.poppins(color: Colors.white, fontSize: 15, fontWeight: FontWeight.w700)),
                      ),
                    ),
                  ).animate().fadeIn(delay: 500.ms),

                const SizedBox(height: 30),
              ],
            ],
          ),
        ),
      ),
    );
  }
}
