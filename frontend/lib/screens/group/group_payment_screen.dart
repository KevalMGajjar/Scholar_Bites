import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:flutter_animate/flutter_animate.dart';
import '../../services/group_service.dart';
import '../../services/group_socket_service.dart';
import '../../utils/custom_toast.dart';
import '../../utils/token_storage.dart';
import '../../widgets/spoon_loader.dart';
import '../../services/wallet_service.dart';
import 'group_lobby_screen.dart';
import 'group_waiting_screen.dart';
import '../home_screen.dart';

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
  final _socketService = GroupSocketService();
  bool _isLoading = true;
  bool _isPaying = false;
  bool _isUnlocking = false;
  double _myShare = 0;
  String _splitMode = 'individual';
  String? _myUserId;
  List<Map<String, dynamic>> _myItems = [];
  List<Map<String, dynamic>> _allItems = [];
  double _walletBalance = 0.0;
  bool _isLoadingBalance = true;

  @override
  void initState() {
    super.initState();
    _loadPaymentDetails();
    _fetchWalletBalance();
    _connectSocket();
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
    _socketService.disconnect();
    super.dispose();
  }

  void _connectSocket() {
    _socketService.connect(
      widget.groupCode,
      onLobbyUnlocked: (data) {
        // Leader unlocked — everyone goes back to lobby
        _socketService.disconnect();
        if (mounted) {
          CustomToast.showSuccessToast(context, 'Group has been unlocked');
          Navigator.pushReplacement(
            context,
            MaterialPageRoute(
              builder: (_) => GroupLobbyScreen(
                groupCode: widget.groupCode,
                isLeader: widget.isLeader,
                myNickname: widget.myNickname,
              ),
            ),
          );
        }
      },
      onGroupDeleted: (data) {
        _socketService.disconnect();
        if (mounted) {
          CustomToast.showErrorToast(context, 'Group has been disbanded');
          Navigator.pushAndRemoveUntil(
            context,
            MaterialPageRoute(builder: (_) => const HomeScreen()),
            (route) => false,
          );
        }
      },
      onMemberPaid: (data) => _loadPaymentDetails(),
    );
  }

  Future<void> _loadPaymentDetails() async {
    try {
      _myUserId = await TokenStorage.getUserId();
      final data = await _groupService.getGroupState(widget.groupCode);
      if (!mounted) return;

      _splitMode = data['split_mode']?.toString() ?? 'individual';
      final members = List<Map<String, dynamic>>.from(data['members'] ?? []);
      final items = List<Map<String, dynamic>>.from(data['items'] ?? []);

      // Find my member record — try user_id first, then fall back to nickname
      Map<String, dynamic>? myMember;
      for (final m in members) {
        if (_myUserId != null && _myUserId!.isNotEmpty && m['user_id'] == _myUserId) {
          myMember = m;
          break;
        }
      }
      // Fallback: match by nickname if userId wasn't found
      if (myMember == null) {
        for (final m in members) {
          if (m['nickname'] == widget.myNickname) {
            myMember = m;
            _myUserId = m['user_id']?.toString();
            break;
          }
        }
      }

      if (myMember != null) {
        _myShare = double.tryParse(myMember['share_amount']?.toString() ?? '0') ?? 0;

        // Check if already paid
        if (myMember['payment_status'] == 'paid') {
          if (mounted) {
            _navigateToWaiting();
            return;
          }
        }
      }

      // Filter items added by me
      _myItems = items.where((i) => i['added_by'] == _myUserId).toList();
      _allItems = items;

      setState(() {
        _isLoading = false;
      });
    } catch (e) {
      if (mounted) {
        CustomToast.showErrorToast(context, 'Failed to load payment details');
        setState(() => _isLoading = false);
      }
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
      } else {
        CustomToast.showErrorToast(context, result['message']?.toString() ?? 'Payment failed');
        setState(() => _isPaying = false);
      }
    } catch (e) {
      if (mounted) {
        String errorMsg = 'Payment failed. Check your wallet balance.';
        if (e.toString().contains('Insufficient')) {
          errorMsg = 'Insufficient wallet balance';
        }
        CustomToast.showErrorToast(context, errorMsg);
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
        final mockOrderId = result['order_id']?.toString() ?? '';
        final verifyResult = await _groupService.verifyShare(
          code: widget.groupCode,
          razorpayOrderId: mockOrderId,
          razorpayPaymentId: 'mock_payment_${DateTime.now().millisecondsSinceEpoch}',
          razorpaySignature: 'mock_signature',
        );

        if (!mounted) return;

        if (verifyResult['status'] == 'success') {
          CustomToast.showSuccessToast(context, 'Payment successful!');
          _navigateToWaiting();
        } else {
          CustomToast.showErrorToast(context, 'Payment verification failed');
          setState(() => _isPaying = false);
        }
      } else if (result['status'] == 'success') {
        CustomToast.showSuccessToast(context, 'No payment needed!');
        _navigateToWaiting();
      }
    } catch (e) {
      if (mounted) {
        CustomToast.showErrorToast(context, 'Payment failed');
        setState(() => _isPaying = false);
      }
    }
  }

  Future<void> _unlockGroup() async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: _bg,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: Text('Unlock Group?', style: GoogleFonts.poppins(fontWeight: FontWeight.w800, color: _darkText)),
        content: Text(
          'This will reopen the group for adding/removing items. All payment progress will be reset.',
          style: GoogleFonts.poppins(color: _darkText.withValues(alpha: 0.6), fontSize: 14, height: 1.5),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: Text('Cancel', style: GoogleFonts.poppins(fontWeight: FontWeight.w700, color: _darkText)),
          ),
          TextButton(
            onPressed: () => Navigator.pop(ctx, true),
            child: Text('Unlock', style: GoogleFonts.poppins(fontWeight: FontWeight.w700, color: _maroon)),
          ),
        ],
      ),
    );

    if (confirmed != true || !mounted) return;

    setState(() => _isUnlocking = true);
    try {
      await _groupService.unlockGroup(widget.groupCode);
      if (!mounted) return;

      CustomToast.showSuccessToast(context, 'Group unlocked!');
      // Navigate back to lobby
      Navigator.pushReplacement(
        context,
        MaterialPageRoute(
          builder: (_) => GroupLobbyScreen(
            groupCode: widget.groupCode,
            isLeader: widget.isLeader,
            myNickname: widget.myNickname,
          ),
        ),
      );
    } catch (e) {
      if (mounted) {
        CustomToast.showErrorToast(context, 'Failed to unlock group');
        setState(() => _isUnlocking = false);
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

    return PopScope(
      canPop: false,
      onPopInvokedWithResult: (didPop, _) {
        if (!didPop) {
          if (widget.isLeader) {
            _unlockGroup();
          } else {
            CustomToast.showErrorToast(context, 'You must pay your share before leaving');
          }
        }
      },
      child: Scaffold(
        backgroundColor: _bg,
        body: SafeArea(
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 24),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.center,
              children: [
                const SizedBox(height: 16),

                // Leader unlock button (top-left)
                if (widget.isLeader)
                  Align(
                    alignment: Alignment.centerLeft,
                    child: GestureDetector(
                      onTap: _isUnlocking ? null : _unlockGroup,
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                        decoration: BoxDecoration(
                          color: Colors.white,
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(color: _maroon.withValues(alpha: 0.2)),
                        ),
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Icon(Icons.lock_open_rounded, color: _maroon, size: 18),
                            const SizedBox(width: 6),
                            Text(
                              _isUnlocking ? 'Unlocking...' : 'Unlock Group',
                              style: GoogleFonts.poppins(color: _maroon, fontSize: 13, fontWeight: FontWeight.w700),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ).animate().fadeIn(duration: 400.ms),

                const SizedBox(height: 16),

                // Header
                const Icon(Icons.payment_rounded, size: 64, color: _maroon)
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

                const SizedBox(height: 4),

                // Split mode badge
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
                  decoration: BoxDecoration(
                    color: _maroon.withValues(alpha: 0.08),
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(
                        _splitMode == 'equal' ? Icons.bar_chart_rounded : Icons.receipt_long_rounded,
                        size: 14,
                        color: _maroon,
                      ),
                      const SizedBox(width: 4),
                      Text(
                        _splitMode == 'equal' ? 'Split Equally' : 'Pay Own Share',
                        style: GoogleFonts.poppins(fontSize: 12, fontWeight: FontWeight.w600, color: _maroon),
                      ),
                    ],
                  ),
                ).animate().fadeIn(delay: 350.ms),

                const SizedBox(height: 30),

                // Items breakdown
                if (_myShare > 0 && _displayItems.isNotEmpty)
                  Expanded(
                    child: ListView(
                      children: [
                        Text(
                          _splitMode == 'equal' ? 'All Group Items' : 'Your Items',
                          style: GoogleFonts.poppins(fontSize: 15, fontWeight: FontWeight.w800, color: _darkText),
                        ),
                        const SizedBox(height: 10),
                        ..._displayItems.map((item) {
                          final price = double.tryParse(item['price_at_time']?.toString() ?? '0') ?? 0;
                          final qty = item['quantity'] ?? 1;
                          return Container(
                            margin: const EdgeInsets.only(bottom: 8),
                            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                            decoration: BoxDecoration(
                              color: Colors.white,
                              borderRadius: BorderRadius.circular(14),
                              border: Border.all(color: _maroon.withValues(alpha: 0.08)),
                            ),
                            child: Row(
                              children: [
                                const Icon(Icons.restaurant_menu_rounded, size: 16, color: _maroon),
                                const SizedBox(width: 10),
                                Expanded(
                                  child: Text(
                                    '${item['item_name']} ×$qty',
                                    style: GoogleFonts.poppins(fontWeight: FontWeight.w600, fontSize: 13, color: _darkText),
                                  ),
                                ),
                                Text(
                                  '₹${(price * qty).toStringAsFixed(0)}',
                                  style: GoogleFonts.poppins(fontWeight: FontWeight.w800, fontSize: 13, color: _maroon),
                                ),
                              ],
                            ),
                          );
                        }),
                      ],
                    ),
                  ),

                if (_myShare <= 0)
                  Expanded(
                    child: Center(
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          const Icon(Icons.celebration_rounded, size: 48, color: _maroon),
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
                      onTap: (_isPaying || _walletBalance < _myShare) ? null : _payWithWallet,
                      child: Container(
                        width: double.infinity,
                        padding: const EdgeInsets.symmetric(vertical: 18),
                        decoration: BoxDecoration(
                          gradient: LinearGradient(
                            colors: (_walletBalance >= _myShare)
                                ? const [_maroon, Color(0xFFB52A3A)]
                                : [Colors.grey.shade400, Colors.grey.shade500],
                          ),
                          borderRadius: BorderRadius.circular(18),
                          boxShadow: (_walletBalance >= _myShare)
                              ? [BoxShadow(color: _maroon.withValues(alpha: 0.35), blurRadius: 20, offset: const Offset(0, 8))]
                              : [],
                        ),
                        child: Row(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            const Icon(Icons.account_balance_wallet_rounded, color: Colors.white, size: 22),
                            const SizedBox(width: 10),
                            Text(
                              _isLoadingBalance 
                                ? 'Loading Wallet...' 
                                : (_walletBalance >= _myShare)
                                    ? 'Pay ₹${_myShare.toStringAsFixed(0)} with Wallet'
                                    : 'Wallet (Insufficient Balance)', 
                              style: GoogleFonts.poppins(color: Colors.white, fontSize: 15, fontWeight: FontWeight.w700),
                            ),
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
                      onTap: () async {
                        try {
                          await _groupService.payShare(widget.groupCode, method: 'wallet');
                        } catch (_) {}
                        _navigateToWaiting();
                      },
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
      ),
    );
  }

  List<Map<String, dynamic>> get _displayItems {
    if (_splitMode == 'equal') return _allItems;
    return _myItems;
  }
}
