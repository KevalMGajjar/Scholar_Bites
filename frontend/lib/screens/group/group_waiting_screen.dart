import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:flutter_animate/flutter_animate.dart';
import '../../services/group_service.dart';
import '../../services/group_socket_service.dart';
import '../../utils/custom_toast.dart';
import '../../widgets/spoon_loader.dart';
import 'group_lobby_screen.dart';
import 'group_success_screen.dart';
import '../home_screen.dart';

class GroupWaitingScreen extends StatefulWidget {
  final String groupCode;
  final bool isLeader;
  final String myNickname;
  final List<Map<String, dynamic>> members;
  final String creatorId;

  const GroupWaitingScreen({
    super.key,
    required this.groupCode,
    required this.isLeader,
    required this.myNickname,
    required this.members,
    required this.creatorId,
  });

  @override
  State<GroupWaitingScreen> createState() => _GroupWaitingScreenState();
}

class _GroupWaitingScreenState extends State<GroupWaitingScreen> {
  static const _maroon = Color(0xFF8B1C28);
  static const _darkText = Color(0xFF4A0E13);
  static const _bg = Color(0xFFFCF9F5);

  final _groupService = GroupService();
  final _socketService = GroupSocketService();
  List<Map<String, dynamic>> _members = [];
  bool _isLoading = true;
  String _creatorId = '';

  @override
  void initState() {
    super.initState();
    _loadState();
    _connectSocket();
  }

  @override
  void dispose() {
    _socketService.disconnect();
    super.dispose();
  }

  Future<void> _loadState() async {
    try {
      final data = await _groupService.getGroupState(widget.groupCode);
      if (!mounted) return;

      final status = data['status']?.toString() ?? '';
      _creatorId = data['creator_id']?.toString() ?? widget.creatorId;

      // If group was unlocked, go back to lobby
      if (status == 'open') {
        _socketService.disconnect();
        if (mounted) {
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
        return;
      }

      setState(() {
        _members = List<Map<String, dynamic>>.from(data['members'] ?? []);
        _isLoading = false;
      });

      _checkAllPaid();
    } catch (e) {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  void _connectSocket() {
    _socketService.connect(
      widget.groupCode,
      onMemberPaid: (data) => _loadState(),
      onLobbyUnlocked: (data) {
        // Leader unlocked — go back to lobby
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
      onOrderCompleted: (data) {
        final pickupRestaurant = data['pickup_restaurant'] ?? 'Restaurant';
        final orderToken = data['order_token'] ?? '';

        if (widget.isLeader) {
          Navigator.pushReplacement(
            context,
            MaterialPageRoute(
              builder: (_) => GroupSuccessScreen(
                groupCode: widget.groupCode,
                members: _members,
                pickupRestaurant: pickupRestaurant,
                orderToken: orderToken,
              ),
            ),
          );
        } else {
          Navigator.pushAndRemoveUntil(
            context,
            MaterialPageRoute(builder: (_) => const HomeScreen()),
            (route) => false,
          );
        }
      },
    );
  }

  void _checkAllPaid() {
    final allPaid = _members.every((m) => m['payment_status'] == 'paid');
    if (allPaid && _members.isNotEmpty) {
      // Everyone paid — the backend will emit 'order_completed' via socket
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_isLoading) {
      return Scaffold(backgroundColor: _bg, body: Center(child: SpoonLoader(size: 60)));
    }

    final paidCount = _members.where((m) => m['payment_status'] == 'paid').length;
    final totalCount = _members.length;

    return PopScope(
      canPop: false,
      onPopInvokedWithResult: (didPop, _) {
        if (!didPop) {
          CustomToast.showErrorToast(context, 'Please wait for all members to pay');
        }
      },
      child: Scaffold(
        backgroundColor: _bg,
        body: SafeArea(
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 24),
            child: Column(
              children: [
                const SizedBox(height: 40),

                // Animated hourglass
                const Text('⏳', style: TextStyle(fontSize: 56))
                    .animate(onPlay: (c) => c.repeat(reverse: true))
                    .rotate(begin: -0.05, end: 0.05, duration: 1.seconds),

                const SizedBox(height: 20),

                Text(
                  'Waiting for Payments',
                  style: GoogleFonts.poppins(fontSize: 22, fontWeight: FontWeight.w800, color: _darkText),
                ).animate().fadeIn(delay: 200.ms),

                const SizedBox(height: 8),

                Text(
                  '$paidCount of $totalCount members paid',
                  style: GoogleFonts.poppins(fontSize: 15, color: _maroon, fontWeight: FontWeight.w600),
                ),

                const SizedBox(height: 12),

                // Progress bar
                ClipRRect(
                  borderRadius: BorderRadius.circular(10),
                  child: LinearProgressIndicator(
                    value: totalCount > 0 ? paidCount / totalCount : 0,
                    minHeight: 10,
                    backgroundColor: _maroon.withValues(alpha: 0.1),
                    valueColor: const AlwaysStoppedAnimation(_maroon),
                  ),
                ).animate().fadeIn(delay: 300.ms),

                const SizedBox(height: 30),

                // Member payment status list
                Expanded(
                  child: ListView.builder(
                    itemCount: _members.length,
                    itemBuilder: (_, i) {
                      final member = _members[i];
                      final isPaid = member['payment_status'] == 'paid';
                      final isCreator = member['user_id'] == _creatorId;

                      return Container(
                        margin: const EdgeInsets.only(bottom: 12),
                        padding: const EdgeInsets.all(16),
                        decoration: BoxDecoration(
                          color: isPaid ? const Color(0xFFE8F5E9) : Colors.white,
                          borderRadius: BorderRadius.circular(18),
                          border: Border.all(
                            color: isPaid ? const Color(0xFF4CAF50).withValues(alpha: 0.3) : _maroon.withValues(alpha: 0.08),
                          ),
                          boxShadow: [
                            BoxShadow(
                              color: isPaid
                                  ? const Color(0xFF4CAF50).withValues(alpha: 0.08)
                                  : _maroon.withValues(alpha: 0.04),
                              blurRadius: 12,
                              offset: const Offset(0, 4),
                            ),
                          ],
                        ),
                        child: Row(
                          children: [
                            // Status icon
                            Container(
                              width: 44,
                              height: 44,
                              decoration: BoxDecoration(
                                color: isPaid
                                    ? const Color(0xFF4CAF50).withValues(alpha: 0.15)
                                    : _maroon.withValues(alpha: 0.08),
                                shape: BoxShape.circle,
                              ),
                              child: Center(
                                child: isPaid
                                    ? const Icon(Icons.check_rounded, color: Color(0xFF4CAF50), size: 24)
                                    : SpoonLoader(size: 24),
                              ),
                            ),

                            const SizedBox(width: 14),

                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Row(
                                    children: [
                                      Text(
                                        member['nickname'] ?? 'Member',
                                        style: GoogleFonts.poppins(
                                          fontWeight: FontWeight.w700,
                                          fontSize: 15,
                                          color: _darkText,
                                        ),
                                      ),
                                      if (isCreator)
                                        const Padding(
                                          padding: EdgeInsets.only(left: 6),
                                          child: Text('👑', style: TextStyle(fontSize: 14)),
                                        ),
                                    ],
                                  ),
                                  Text(
                                    '₹${double.tryParse(member['share_amount']?.toString() ?? '0')?.toStringAsFixed(0) ?? '0'}',
                                    style: GoogleFonts.poppins(
                                      fontWeight: FontWeight.w600,
                                      fontSize: 13,
                                      color: isPaid ? const Color(0xFF4CAF50) : _maroon,
                                    ),
                                  ),
                                ],
                              ),
                            ),

                            // Status badge
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                              decoration: BoxDecoration(
                                color: isPaid ? const Color(0xFF4CAF50) : _maroon.withValues(alpha: 0.1),
                                borderRadius: BorderRadius.circular(10),
                              ),
                              child: Text(
                                isPaid ? 'Paid' : 'Paying…',
                                style: GoogleFonts.poppins(
                                  color: isPaid ? Colors.white : _maroon,
                                  fontSize: 12,
                                  fontWeight: FontWeight.w700,
                                ),
                              ),
                            ),
                          ],
                        ),
                      ).animate().fadeIn(delay: Duration(milliseconds: 100 * i)).slideX(begin: 0.1);
                    },
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
