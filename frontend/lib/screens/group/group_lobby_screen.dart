import 'dart:math';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:qr_flutter/qr_flutter.dart';
import '../../services/group_service.dart';
import '../../services/group_socket_service.dart';
import '../../services/menu_service.dart';
import '../../models/food_item.dart';
import '../../utils/custom_toast.dart';
import '../../utils/token_storage.dart';
import '../../widgets/spoon_loader.dart';
import 'group_payment_screen.dart';

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
    required this.myUserId,
  });

  @override
  State<GroupLobbyScreen> createState() => _GroupLobbyScreenState();
}

class _GroupLobbyScreenState extends State<GroupLobbyScreen> with TickerProviderStateMixin {
  static const _maroon = Color(0xFF8B1C28);
  static const _darkText = Color(0xFF4A0E13);
  static const _bg = Color(0xFFFCF9F5);

  final _groupService = GroupService();
  final _menuService = MenuService();
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

  void _connectSocket() {
    _socketService.connect(
      widget.groupCode,
      onMemberJoined: (data) {
        _loadState(); // Refresh to get new member
      },
      onItemAdded: (data) {
        // Trigger flying animation
        final userId = data['userId'] ?? '';
        final itemName = data['item_name'] ?? 'Item';
        _triggerFlyingAnimation(userId, itemName);
        _loadState();
      },
      onLobbyLocked: (data) {
        setState(() => _status = 'locked');
        // Navigate to payment
        _navigateToPayment();
      },
      onMemberPaid: (data) => _loadState(),
      onOrderCompleted: (data) => _loadState(),
    );
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

  Future<void> _showMenuPicker() async {
    final universityId = await TokenStorage.getUniversityId();
    if (universityId == null || !mounted) return;

    List<FoodItem> menuItems = [];
    try {
      menuItems = await _menuService.getMenuItems(universityId);
    } catch (e) {
      if (mounted) CustomToast.showErrorToast(context, 'Failed to load menu');
      return;
    }

    if (!mounted) return;

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: _bg,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(24))),
      builder: (_) => _MenuPickerSheet(
        items: menuItems,
        onAddItem: (FoodItem item) async {
          try {
            await _groupService.addItem(widget.groupCode, item.id, 1);
          } catch (e) {
            if (mounted) CustomToast.showErrorToast(context, 'Failed to add item');
          }
        },
      ),
    );
  }

  void _lockGroup() async {
    try {
      await _groupService.lockGroup(widget.groupCode);
    } catch (e) {
      if (mounted) CustomToast.showErrorToast(context, 'Failed to lock group');
    }
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

    return Scaffold(
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
    );
  }

  Widget _buildHeader() {
    return Container(
      padding: const EdgeInsets.fromLTRB(20, 8, 20, 16),
      child: Row(
        children: [
          IconButton(
            icon: const Icon(Icons.arrow_back_ios_rounded, color: _darkText),
            onPressed: () => Navigator.pop(context),
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

  Widget _buildFoodPile() {
    if (_items.isEmpty) {
      return Container(
        height: 80,
        margin: const EdgeInsets.symmetric(horizontal: 24),
        decoration: BoxDecoration(
          color: _maroon.withValues(alpha: 0.04),
          borderRadius: BorderRadius.circular(20),
          border: Border.all(color: _maroon.withValues(alpha: 0.1), style: BorderStyle.solid),
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
      height: 100,
      margin: const EdgeInsets.symmetric(horizontal: 16),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: [_maroon.withValues(alpha: 0.08), _maroon.withValues(alpha: 0.03)],
        ),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: _maroon.withValues(alpha: 0.12)),
      ),
      child: Column(
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
          const SizedBox(height: 8),
          Expanded(
            child: ListView.builder(
              scrollDirection: Axis.horizontal,
              itemCount: _items.length,
              itemBuilder: (_, i) {
                final item = _items[i];
                return Container(
                  margin: const EdgeInsets.only(right: 8),
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(10),
                    border: Border.all(color: _maroon.withValues(alpha: 0.1)),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text('🍽️', style: const TextStyle(fontSize: 14)),
                      const SizedBox(width: 4),
                      Text(
                        item['item_name'] ?? 'Item',
                        style: GoogleFonts.poppins(fontSize: 11, fontWeight: FontWeight.w600, color: _darkText),
                      ),
                      Text(
                        ' ×${item['quantity'] ?? 1}',
                        style: GoogleFonts.poppins(fontSize: 10, color: _maroon, fontWeight: FontWeight.w700),
                      ),
                    ],
                  ),
                ).animate().fadeIn(delay: Duration(milliseconds: 100 * i)).slideX(begin: 0.2);
              },
            ),
          ),
        ],
      ),
    );
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
                onTap: _lockGroup,
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

// ─── Menu Picker Bottom Sheet ───
class _MenuPickerSheet extends StatelessWidget {
  final List<FoodItem> items;
  final Function(FoodItem) onAddItem;

  const _MenuPickerSheet({required this.items, required this.onAddItem});

  @override
  Widget build(BuildContext context) {
    return DraggableScrollableSheet(
      initialChildSize: 0.7,
      maxChildSize: 0.9,
      minChildSize: 0.4,
      expand: false,
      builder: (_, controller) => Column(
        children: [
          const SizedBox(height: 12),
          Container(width: 40, height: 4, decoration: BoxDecoration(color: Colors.grey[300], borderRadius: BorderRadius.circular(2))),
          Padding(
            padding: const EdgeInsets.all(16),
            child: Text('Add to Group Pile', style: GoogleFonts.poppins(fontSize: 18, fontWeight: FontWeight.w800, color: const Color(0xFF4A0E13))),
          ),
          Expanded(
            child: ListView.builder(
              controller: controller,
              itemCount: items.length,
              padding: const EdgeInsets.symmetric(horizontal: 16),
              itemBuilder: (_, i) {
                final item = items[i];
                return Container(
                  margin: const EdgeInsets.only(bottom: 10),
                  padding: const EdgeInsets.all(14),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(color: const Color(0xFF8B1C28).withValues(alpha: 0.08)),
                  ),
                  child: Row(
                    children: [
                      // Item image
                      ClipRRect(
                        borderRadius: BorderRadius.circular(12),
                        child: item.imageUrl.isNotEmpty
                            ? Image.network(item.imageUrl, width: 50, height: 50, fit: BoxFit.cover,
                                errorBuilder: (_, __, ___) => Container(width: 50, height: 50, color: Colors.grey[200], child: const Icon(Icons.fastfood_rounded)))
                            : Container(width: 50, height: 50, color: Colors.grey[200], child: const Icon(Icons.fastfood_rounded)),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(item.name, style: GoogleFonts.poppins(fontWeight: FontWeight.w700, fontSize: 14, color: const Color(0xFF4A0E13))),
                            Text('₹${item.price.toStringAsFixed(0)}', style: GoogleFonts.poppins(fontWeight: FontWeight.w800, fontSize: 13, color: const Color(0xFF8B1C28))),
                          ],
                        ),
                      ),
                      GestureDetector(
                        onTap: () {
                          onAddItem(item);
                          Navigator.pop(context);
                          ScaffoldMessenger.of(context).showSnackBar(
                            SnackBar(
                              content: Text('${item.name} added to pile!'),
                              backgroundColor: const Color(0xFF8B1C28),
                              behavior: SnackBarBehavior.floating,
                              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                              duration: const Duration(seconds: 1),
                            ),
                          );
                        },
                        child: Container(
                          padding: const EdgeInsets.all(10),
                          decoration: BoxDecoration(
                            color: const Color(0xFF8B1C28),
                            borderRadius: BorderRadius.circular(12),
                          ),
                          child: const Icon(Icons.add_rounded, color: Colors.white, size: 20),
                        ),
                      ),
                    ],
                  ),
                );
              },
            ),
          ),
        ],
      ),
    );
  }
}
