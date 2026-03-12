import 'dart:math';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:qr_flutter/qr_flutter.dart';
import '../../services/group_service.dart';
import '../../services/group_socket_service.dart';
import '../../utils/custom_toast.dart';
import '../../widgets/spoon_loader.dart';
import 'group_payment_screen.dart';
import 'group_menu_picker_screen.dart';

class GroupLobbyScreen extends StatefulWidget {
  final String groupCode;
  final bool isLeader;
  final String myNickname;
  final String myUserId;

  const GroupLobbyScreen({
    super.key,
    required this.groupCode,
    required this.isLeader,
    required this.myNickname,
    this.myUserId = '',
  });

  @override
  State<GroupLobbyScreen> createState() => _GroupLobbyScreenState();
}

class _GroupLobbyScreenState extends State<GroupLobbyScreen> with TickerProviderStateMixin {
  static const _maroon = Color(0xFF8B1C28);
  static const _darkText = Color(0xFF4A0E13);
  static const _bg = Color(0xFFFCF9F5);

  final _groupService = GroupService();
  final _socketService = GroupSocketService();

  bool _isLoading = true;
  bool _showQR = false;
  String _status = 'open';
  String _creatorId = '';

  List<Map<String, dynamic>> _members = [];
  List<Map<String, dynamic>> _items = [];
  final List<_FlyingItem> _flyingItems = [];

  // Character colors/emojis for each member
  static const _characterEmojis = ['🧑‍🍳', '🦸', '🧙', '🥷', '🧑‍🚀', '🦹', '🧝', '🧞'];
  static const _characterColors = [
    Color(0xFF4CAF50), Color(0xFF2196F3), Color(0xFFFF9800),
    Color(0xFF9C27B0), Color(0xFFE91E63), Color(0xFF00BCD4),
    Color(0xFFFF5722), Color(0xFF607D8B),
  ];

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
      setState(() {
        _status = data['status'] ?? 'open';
        _creatorId = data['creator_id'] ?? '';
        _members = List<Map<String, dynamic>>.from(data['members'] ?? []);
        _items = List<Map<String, dynamic>>.from(data['items'] ?? []);
        _isLoading = false;
      });
    } catch (e) {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  // ─── Leave / system messages ───
  final List<String> _systemMessages = [];

  void _connectSocket() {
    _socketService.connect(
      widget.groupCode,
      onMemberJoined: (data) {
        final nickname = data['nickname']?.toString() ?? 'Someone';
        _addSystemMessage('$nickname joined the group');
        _loadState();
      },
      onMemberLeft: (data) {
        final nickname = data['nickname']?.toString() ?? 'Someone';
        _addSystemMessage('$nickname left the group');
        _loadState();
      },
      onGroupDeleted: (data) {
        if (mounted) {
          _socketService.disconnect();
          CustomToast.showErrorToast(context, 'Group has been disbanded by the leader');
          Navigator.pop(context);
        }
      },
      onItemAdded: (data) {
        final userId = data['userId'] ?? '';
        final itemName = data['item_name'] ?? 'Item';
        _triggerFlyingAnimation(userId, itemName);
        _loadState();
      },
      onLobbyLocked: (data) {
        setState(() => _status = 'locked');
        _navigateToPayment();
      },
      onLobbyUnlocked: (data) {
        setState(() => _status = 'open');
        _addSystemMessage('Leader has reopened the group');
        _loadState();
      },
      onMemberPaid: (data) => _loadState(),
      onOrderCompleted: (data) => _loadState(),
    );
  }

  void _addSystemMessage(String msg) {
    if (!mounted) return;
    setState(() {
      _systemMessages.add(msg);
      if (_systemMessages.length > 10) _systemMessages.removeAt(0);
    });
  }

  void _triggerFlyingAnimation(String userId, String itemName) {
    final memberIndex = _members.indexWhere((m) => m['user_id'] == userId);
    if (memberIndex < 0) return;

    final isLeft = memberIndex % 2 == 0;
    final yPos = 0.15 + (memberIndex ~/ 2) * 0.18;

    setState(() {
      _flyingItems.add(_FlyingItem(
        id: DateTime.now().millisecondsSinceEpoch,
        itemName: itemName,
        startLeft: isLeft,
        startY: yPos,
      ));
    });

    // Remove after animation
    Future.delayed(const Duration(milliseconds: 1200), () {
      if (mounted) {
        setState(() {
          _flyingItems.removeWhere((f) => f.itemName == itemName && f.startY == yPos);
        });
      }
    });
  }

  void _showMenuPicker() {
    Navigator.push(
      context,
      MaterialPageRoute(
        builder: (_) => GroupMenuPickerScreen(groupCode: widget.groupCode),
      ),
    );
  }

  void _showSplitModeDialog() {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: _bg,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: Text('Split Mode', style: GoogleFonts.poppins(fontWeight: FontWeight.w800, color: _darkText)),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              'How should the bill be split?',
              style: GoogleFonts.poppins(color: _darkText.withValues(alpha: 0.6), fontSize: 14),
            ),
            const SizedBox(height: 20),
            _buildSplitOption(
              ctx,
              icon: Icons.person_rounded,
              title: 'Pay Own Share',
              subtitle: 'Each pays for their items',
              mode: 'individual',
            ),
            const SizedBox(height: 12),
            _buildSplitOption(
              ctx,
              icon: Icons.group_rounded,
              title: 'Split Equally',
              subtitle: 'Total divided equally',
              mode: 'equal',
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildSplitOption(BuildContext ctx, {required IconData icon, required String title, required String subtitle, required String mode}) {
    return GestureDetector(
      onTap: () {
        Navigator.pop(ctx);
        _lockWithMode(mode);
      },
      child: Container(
        width: double.infinity,
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: _maroon.withValues(alpha: 0.15)),
          boxShadow: [BoxShadow(color: _maroon.withValues(alpha: 0.05), blurRadius: 8)],
        ),
        child: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: _maroon.withValues(alpha: 0.1),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Icon(icon, color: _maroon, size: 22),
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(title, style: GoogleFonts.poppins(fontWeight: FontWeight.w700, fontSize: 14, color: _darkText)),
                  Text(subtitle, style: GoogleFonts.poppins(fontSize: 11, color: _darkText.withValues(alpha: 0.5))),
                ],
              ),
            ),
            Icon(Icons.arrow_forward_ios_rounded, color: _maroon, size: 16),
          ],
        ),
      ),
    );
  }

  Future<void> _lockWithMode(String mode) async {
    try {
      await _groupService.lockGroup(widget.groupCode, splitMode: mode);
    } catch (e) {
      if (mounted) CustomToast.showErrorToast(context, 'Failed to lock group');
    }
  }

  Future<bool> _showExitConfirmation() async {
    // Can't leave if locked
    if (_status != 'open') {
      CustomToast.showErrorToast(context, 'Group is locked — pay your share first');
      return false;
    }

    final result = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: _bg,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: Text(
          widget.isLeader ? 'Delete Group?' : 'Leave Group?',
          style: GoogleFonts.poppins(fontWeight: FontWeight.w800, color: _darkText),
        ),
        content: Text(
          widget.isLeader
              ? 'Leaving as leader will permanently delete this group for everyone. This cannot be undone.'
              : 'Are you sure you want to leave? Your added items will be removed.',
          style: GoogleFonts.poppins(color: _darkText.withValues(alpha: 0.6), fontSize: 14, height: 1.5),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: Text('Stay', style: GoogleFonts.poppins(fontWeight: FontWeight.w700, color: _darkText)),
          ),
          TextButton(
            onPressed: () => Navigator.pop(ctx, true),
            child: Text(
              widget.isLeader ? 'Delete Group' : 'Leave',
              style: GoogleFonts.poppins(fontWeight: FontWeight.w700, color: Colors.red),
            ),
          ),
        ],
      ),
    );
    return result ?? false;
  }

  Future<void> _handleExit() async {
    final confirmed = await _showExitConfirmation();
    if (!confirmed || !mounted) return;

    try {
      await _groupService.leaveGroup(widget.groupCode);
    } catch (_) {
      // Silently handle — still navigate out
    }
    _socketService.disconnect();
    if (mounted) Navigator.pop(context);
  }

  void _navigateToPayment() {
    Navigator.pushReplacement(
      context,
      MaterialPageRoute(
        builder: (_) => GroupPaymentScreen(
          groupCode: widget.groupCode,
          isLeader: widget.isLeader,
          myNickname: widget.myNickname,
          members: _members,
          creatorId: _creatorId,
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
        if (!didPop) _handleExit();
      },
      child: Scaffold(
      backgroundColor: _bg,
      body: Stack(
        children: [
          // Background gradient
          Positioned.fill(
            child: Container(
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.topCenter,
                  end: Alignment.bottomCenter,
                  colors: [_bg, _maroon.withValues(alpha: 0.03)],
                ),
              ),
            ),
          ),

          // Main content
          SafeArea(
            child: Column(
              children: [
                // Header with code and QR
                _buildHeader(),

                // Members area
                Expanded(child: _buildMembersArea()),

                // Food pile
                _buildFoodPile(),

                // Bottom controls
                _buildBottomControls(),
              ],
            ),
          ),

          // Flying items
          ..._flyingItems.map((f) => _buildFlyingItem(f)),

          // QR overlay
          if (_showQR) _buildQROverlay(),
        ],
      ),
      ),
    );
  }

  Widget _buildHeader() {
    return Container(
      padding: const EdgeInsets.fromLTRB(20, 8, 20, 16),
      child: Row(
        children: [
          IconButton(
            icon: const Icon(Icons.arrow_back_ios_rounded, color: _darkText),
            onPressed: _handleExit,
          ),
          Expanded(
            child: Column(
              children: [
                Text('GROUP CODE', style: GoogleFonts.poppins(fontSize: 10, fontWeight: FontWeight.w600, color: _maroon, letterSpacing: 2)),
                const SizedBox(height: 2),
                GestureDetector(
                  onTap: () {
                    Clipboard.setData(ClipboardData(text: widget.groupCode));
                    CustomToast.showSuccessToast(context, 'Code copied!');
                  },
                  child: Text(
                    widget.groupCode,
                    style: GoogleFonts.poppins(fontSize: 28, fontWeight: FontWeight.w900, color: _darkText, letterSpacing: 6),
                  ),
                ),
              ],
            ),
          ),
          // QR button
          GestureDetector(
            onTap: () => setState(() => _showQR = true),
            child: Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: _maroon.withValues(alpha: 0.1),
                borderRadius: BorderRadius.circular(14),
              ),
              child: const Icon(Icons.qr_code_rounded, color: _maroon, size: 26),
            ),
          ),
        ],
      ),
    ).animate().fadeIn(duration: 400.ms);
  }

  Widget _buildMembersArea() {
    return LayoutBuilder(
      builder: (context, constraints) {
        return Stack(
          children: [
            // Place characters along left/right edges
            for (int i = 0; i < _members.length; i++)
              _buildCharacter(i, constraints),

            // "Waiting for friends..." if only 1 member
            if (_members.length <= 1)
              Center(
                child: Text(
                  'Waiting for friends to join...',
                  style: GoogleFonts.poppins(
                    color: _darkText.withValues(alpha: 0.3),
                    fontSize: 16,
                    fontWeight: FontWeight.w600,
                  ),
                ).animate(onPlay: (c) => c.repeat())
                  .shimmer(duration: 2.seconds, color: _maroon.withValues(alpha: 0.2)),
              ),

            // ─── System Messages (WhatsApp-style) ───
            if (_systemMessages.isNotEmpty)
              Positioned(
                bottom: 8,
                left: 0,
                right: 0,
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: _systemMessages.map((msg) => Padding(
                    padding: const EdgeInsets.only(bottom: 4),
                    child: Center(
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 5),
                        decoration: BoxDecoration(
                          color: _darkText.withValues(alpha: 0.08),
                          borderRadius: BorderRadius.circular(12),
                        ),
                        child: Text(
                          msg,
                          style: GoogleFonts.poppins(fontSize: 11, color: _darkText.withValues(alpha: 0.5), fontWeight: FontWeight.w500),
                        ),
                      ).animate().fadeIn(duration: 300.ms).slideY(begin: 0.3),
                    ),
                  )).toList(),
                ),
              ),
          ],
        );
      },
    );
  }

  Widget _buildCharacter(int index, BoxConstraints constraints) {
    final member = _members[index];
    final isLeft = index % 2 == 0;
    final yOffset = 20.0 + (index ~/ 2) * (constraints.maxHeight * 0.22);
    final isCreator = member['user_id'] == _creatorId;
    final emoji = _characterEmojis[index % _characterEmojis.length];
    final color = _characterColors[index % _characterColors.length];

    return Positioned(
      left: isLeft ? 12 : null,
      right: isLeft ? null : 12,
      top: yOffset,
      child: Column(
        children: [
          // Crown for leader
          if (isCreator)
            const Text('👑', style: TextStyle(fontSize: 20))
                .animate(onPlay: (c) => c.repeat(reverse: true))
                .moveY(begin: 0, end: -4, duration: 800.ms),

          // Character avatar
          Container(
            width: 64,
            height: 64,
            decoration: BoxDecoration(
              gradient: LinearGradient(
                colors: [color.withValues(alpha: 0.2), color.withValues(alpha: 0.08)],
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              ),
              shape: BoxShape.circle,
              border: Border.all(color: color.withValues(alpha: 0.4), width: 2.5),
              boxShadow: [
                BoxShadow(color: color.withValues(alpha: 0.2), blurRadius: 12, offset: const Offset(0, 4)),
              ],
            ),
            child: Center(child: Text(emoji, style: const TextStyle(fontSize: 32))),
          ).animate()
            .fadeIn(delay: Duration(milliseconds: 200 * index), duration: 500.ms)
            .scaleXY(begin: 0, end: 1, curve: Curves.elasticOut, duration: 800.ms),

          const SizedBox(height: 4),

          // Nickname
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 3),
            decoration: BoxDecoration(
              color: color.withValues(alpha: 0.15),
              borderRadius: BorderRadius.circular(8),
            ),
            child: Text(
              member['nickname'] ?? 'Member',
              style: GoogleFonts.poppins(fontSize: 11, fontWeight: FontWeight.w700, color: color),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
            ),
          ),
        ],
      ),
    );
  }

  // ─── Circular Dish Colors ───
  static const _dishColors = [
    Color(0xFF4285F4), Color(0xFFC8E02A), Color(0xFFFFB800),
    Color(0xFFE91E63), Color(0xFF9C27B0), Color(0xFF00BCD4),
    Color(0xFFFF5722), Color(0xFF4CAF50),
  ];

  Widget _buildFoodPile() {
    if (_items.isEmpty) {
      return Container(
        height: 80,
        margin: const EdgeInsets.symmetric(horizontal: 24),
        decoration: BoxDecoration(
          color: _maroon.withValues(alpha: 0.04),
          borderRadius: BorderRadius.circular(20),
          border: Border.all(color: _maroon.withValues(alpha: 0.1)),
        ),
        child: Center(
          child: Text(
            '🍽️ Add items to start the pile!',
            style: GoogleFonts.poppins(color: _darkText.withValues(alpha: 0.35), fontWeight: FontWeight.w600),
          ),
        ),
      );
    }

    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 16),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: [_maroon.withValues(alpha: 0.06), _maroon.withValues(alpha: 0.02)],
        ),
        borderRadius: BorderRadius.circular(22),
        border: Border.all(color: _maroon.withValues(alpha: 0.1)),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Text('🍔', style: TextStyle(fontSize: 16)),
              const SizedBox(width: 6),
              Text(
                'Food Pile',
                style: GoogleFonts.poppins(fontSize: 13, fontWeight: FontWeight.w800, color: _darkText),
              ),
              const Spacer(),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 3),
                decoration: BoxDecoration(color: _maroon, borderRadius: BorderRadius.circular(10)),
                child: Text(
                  '${_items.length} items',
                  style: GoogleFonts.poppins(color: Colors.white, fontSize: 11, fontWeight: FontWeight.w700),
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),

          // ─── Triangle Pile ───
          _buildTrianglePile(),
        ],
      ),
    );
  }

  /// Arrange items in a triangle: row 0 has 1 item, row 1 has 2, row 2 has 3...
  /// Items shrink as more are added.
  Widget _buildTrianglePile() {
    // Figure out how many rows we need
    int totalRows = 1;
    int capacity = 1;
    while (capacity < _items.length) {
      totalRows++;
      capacity += totalRows;
    }

    // Calculate circle size based on row count
    // Fewer rows = bigger circles, more rows = smaller
    final double circleSize;
    if (totalRows <= 1) {
      circleSize = 56;
    } else if (totalRows <= 2) {
      circleSize = 50;
    } else if (totalRows <= 3) {
      circleSize = 44;
    } else if (totalRows <= 4) {
      circleSize = 38;
    } else if (totalRows <= 5) {
      circleSize = 32;
    } else {
      circleSize = 26;
    }

    final double borderWidth = circleSize > 40 ? 3.0 : 2.5;
    final double fontSize = circleSize > 40 ? 20.0 : (circleSize > 30 ? 16.0 : 12.0);
    final double overlap = circleSize * 0.15; // slight overlap between circles

    // Distribute items into rows: row i has (i+1) items
    List<List<Map<String, dynamic>>> rows = [];
    int itemIndex = 0;
    for (int r = 0; r < totalRows && itemIndex < _items.length; r++) {
      int rowCount = r + 1;
      List<Map<String, dynamic>> row = [];
      for (int c = 0; c < rowCount && itemIndex < _items.length; c++) {
        row.add(_items[itemIndex]);
        itemIndex++;
      }
      rows.add(row);
    }

    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        for (int r = 0; r < rows.length; r++)
          Padding(
            padding: EdgeInsets.only(bottom: r < rows.length - 1 ? (circleSize * 0.05) : 0),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                for (int c = 0; c < rows[r].length; c++)
                  Padding(
                    padding: EdgeInsets.only(right: c < rows[r].length - 1 ? overlap : 0),
                    child: _buildDishCircle(
                      rows[r][c],
                      _getGlobalIndex(r, c),
                      circleSize,
                      borderWidth,
                      fontSize,
                    ),
                  ),
              ],
            ),
          ),
      ],
    );
  }

  int _getGlobalIndex(int row, int col) {
    // Sum of 1+2+...+row = row*(row+1)/2, then add col
    return (row * (row + 1)) ~/ 2 + col;
  }

  Widget _buildDishCircle(Map<String, dynamic> item, int index, double size, double borderWidth, double fontSize) {
    final color = _dishColors[index % _dishColors.length];
    final imageUrl = item['item_image']?.toString() ?? '';
    final firstLetter = item['item_name']?.toString().isNotEmpty == true
        ? item['item_name'].toString().substring(0, 1).toUpperCase()
        : '🍽';

    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        border: Border.all(color: color, width: borderWidth),
        color: Colors.white,
        boxShadow: [
          BoxShadow(color: color.withValues(alpha: 0.25), blurRadius: 6, offset: const Offset(0, 2)),
          BoxShadow(color: Colors.black.withValues(alpha: 0.08), blurRadius: 3, offset: const Offset(0, 1)),
        ],
      ),
      child: ClipOval(
        child: imageUrl.isNotEmpty
            ? Image.network(
                imageUrl,
                fit: BoxFit.cover,
                errorBuilder: (_, __, ___) => Center(
                  child: Text(firstLetter, style: GoogleFonts.poppins(fontSize: fontSize, fontWeight: FontWeight.w800, color: color)),
                ),
              )
            : Center(
                child: Text(firstLetter, style: GoogleFonts.poppins(fontSize: fontSize, fontWeight: FontWeight.w800, color: color)),
              ),
      ),
    ).animate()
        .fadeIn(delay: Duration(milliseconds: 60 * index), duration: 350.ms)
        .scaleXY(begin: 0, end: 1, curve: Curves.elasticOut, duration: 500.ms);
  }

  Widget _buildBottomControls() {
    return Padding(
      padding: const EdgeInsets.fromLTRB(24, 12, 24, 20),
      child: Row(
        children: [
          // Add item button
          if (_status == 'open')
            Expanded(
              child: GestureDetector(
                onTap: _showMenuPicker,
                child: Container(
                  padding: const EdgeInsets.symmetric(vertical: 16),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(color: _maroon.withValues(alpha: 0.2)),
                    boxShadow: [BoxShadow(color: _maroon.withValues(alpha: 0.08), blurRadius: 12, offset: const Offset(0, 4))],
                  ),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Icon(Icons.add_rounded, color: _maroon, size: 22),
                      const SizedBox(width: 6),
                      Text('Add Food', style: GoogleFonts.poppins(color: _maroon, fontWeight: FontWeight.w700, fontSize: 14)),
                    ],
                  ),
                ),
              ),
            ),

          if (_status == 'open' && widget.isLeader)
            const SizedBox(width: 12),

          // Lock button (leader only)
          if (_status == 'open' && widget.isLeader)
            Expanded(
              child: GestureDetector(
                onTap: _showSplitModeDialog,
                child: Container(
                  padding: const EdgeInsets.symmetric(vertical: 16),
                  decoration: BoxDecoration(
                    gradient: const LinearGradient(colors: [_maroon, Color(0xFFB52A3A)]),
                    borderRadius: BorderRadius.circular(16),
                    boxShadow: [BoxShadow(color: _maroon.withValues(alpha: 0.35), blurRadius: 16, offset: const Offset(0, 6))],
                  ),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      const Icon(Icons.lock_rounded, color: Colors.white, size: 20),
                      const SizedBox(width: 6),
                      Text('Close & Pay', style: GoogleFonts.poppins(color: Colors.white, fontWeight: FontWeight.w700, fontSize: 14)),
                    ],
                  ),
                ),
              ),
            ),
        ],
      ),
    ).animate().fadeIn(delay: 600.ms).slideY(begin: 0.3);
  }

  Widget _buildFlyingItem(_FlyingItem item) {
    final screenWidth = MediaQuery.of(context).size.width;
    final screenHeight = MediaQuery.of(context).size.height;
    final startX = item.startLeft ? 50.0 : screenWidth - 100;
    final startY = screenHeight * item.startY;
    final endX = screenWidth / 2 - 30;
    final endY = screenHeight * 0.75;

    return TweenAnimationBuilder<double>(
      tween: Tween(begin: 0, end: 1),
      duration: const Duration(milliseconds: 1000),
      curve: Curves.easeInOutCubic,
      builder: (context, t, child) {
        final x = startX + (endX - startX) * t;
        final y = startY + (endY - startY) * t - 60 * sin(t * 3.14159);
        final scale = 1.0 - t * 0.4;
        return Positioned(
          left: x,
          top: y,
          child: Transform.scale(
            scale: scale,
            child: Opacity(
              opacity: 1 - t * 0.3,
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                decoration: BoxDecoration(
                  color: _maroon,
                  borderRadius: BorderRadius.circular(12),
                  boxShadow: [BoxShadow(color: _maroon.withValues(alpha: 0.4), blurRadius: 10)],
                ),
                child: Text(
                  '🍔 ${item.itemName}',
                  style: GoogleFonts.poppins(color: Colors.white, fontSize: 12, fontWeight: FontWeight.w700),
                ),
              ),
            ),
          ),
        );
      },
    );
  }

  Widget _buildQROverlay() {
    return GestureDetector(
      onTap: () => setState(() => _showQR = false),
      child: Container(
        color: Colors.black.withValues(alpha: 0.7),
        child: Center(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                'Scan to Join',
                style: GoogleFonts.poppins(color: Colors.white, fontSize: 22, fontWeight: FontWeight.w800),
              ),
              const SizedBox(height: 20),
              Container(
                padding: const EdgeInsets.all(20),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(24),
                  boxShadow: [BoxShadow(color: _maroon.withValues(alpha: 0.3), blurRadius: 30)],
                ),
                child: QrImageView(
                  data: widget.groupCode,
                  version: QrVersions.auto,
                  size: 220,
                  eyeStyle: const QrEyeStyle(eyeShape: QrEyeShape.square, color: _darkText),
                  dataModuleStyle: const QrDataModuleStyle(dataModuleShape: QrDataModuleShape.square, color: _maroon),
                ),
              ),
              const SizedBox(height: 16),
              Text(
                widget.groupCode,
                style: GoogleFonts.poppins(color: Colors.white, fontSize: 32, fontWeight: FontWeight.w900, letterSpacing: 8),
              ),
              const SizedBox(height: 20),
              Text(
                'Tap anywhere to close',
                style: GoogleFonts.poppins(color: Colors.white54, fontSize: 14),
              ),
            ],
          ),
        ),
      ),
    ).animate().fadeIn(duration: 300.ms);
  }
}

// ─── Flying Item Data ───
class _FlyingItem {
  final int id;
  final String itemName;
  final bool startLeft;
  final double startY;

  _FlyingItem({required this.id, required this.itemName, required this.startLeft, required this.startY});
}
