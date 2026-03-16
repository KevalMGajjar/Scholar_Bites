import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import '../services/notification_service.dart';
import '../widgets/spoon_loader.dart';

// ─── Colors ──────────────────────────────────────────
const _maroon = Color(0xFF8B1C28);
const _darkText = Color(0xFF4A0E13);
const _bg = Color(0xFFFCF9F5);

class NotificationsScreen extends StatefulWidget {
  const NotificationsScreen({super.key});

  @override
  State<NotificationsScreen> createState() => _NotificationsScreenState();
}

class _NotificationsScreenState extends State<NotificationsScreen>
    with SingleTickerProviderStateMixin {
  late TabController _tabController;
  final _notificationService = NotificationService();

  List<Map<String, dynamic>> _notifications = [];
  bool _isLoading = true;
  bool _hasError = false;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 3, vsync: this);
    _fetchNotifications();
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  Future<void> _fetchNotifications() async {
    if (!mounted) return;
    setState(() {
      _isLoading = true;
      _hasError = false;
    });

    try {
      final data = await _notificationService.getNotifications(limit: 50);
      if (!mounted) return;
      setState(() {
        _notifications = List<Map<String, dynamic>>.from(data['notifications'] ?? []);
        _isLoading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _isLoading = false;
        _hasError = true;
      });
    }
  }

  Future<void> _markAllRead() async {
    await _notificationService.markAllAsRead();
    setState(() {
      for (var n in _notifications) {
        n['is_read'] = true;
      }
    });
  }

  Future<void> _markRead(String id, int index) async {
    await _notificationService.markAsRead(id);
    setState(() {
      _notifications[index]['is_read'] = true;
    });
  }

  List<Map<String, dynamic>> _filterByType(String type) {
    if (type == 'all') return _notifications;
    if (type == 'food') {
      return _notifications
          .where((n) => n['type'] == 'item_available' || n['type'] == 'cart_reminder')
          .toList();
    }
    if (type == 'restaurant') {
      return _notifications
          .where((n) => n['type'] == 'restaurant_open' || n['type'] == 'restaurant_closing')
          .toList();
    }
    return _notifications;
  }

  IconData _getIcon(String type) {
    switch (type) {
      case 'item_available':
        return Icons.fastfood_rounded;
      case 'restaurant_open':
        return Icons.store_rounded;
      case 'restaurant_closing':
        return Icons.schedule_rounded;
      case 'cart_reminder':
        return Icons.shopping_cart_rounded;
      default:
        return Icons.notifications_rounded;
    }
  }

  Color _getIconColor(String type) {
    switch (type) {
      case 'item_available':
        return const Color(0xFF2E7D32);
      case 'restaurant_open':
        return _maroon;
      case 'restaurant_closing':
        return const Color(0xFFE65100);
      case 'cart_reminder':
        return const Color(0xFF1565C0);
      default:
        return _maroon;
    }
  }

  String _timeAgo(String createdAt) {
    final dt = DateTime.tryParse(createdAt);
    if (dt == null) return '';
    final diff = DateTime.now().difference(dt);
    if (diff.inMinutes < 1) return 'just now';
    if (diff.inMinutes < 60) return '${diff.inMinutes}m';
    if (diff.inHours < 24) return '${diff.inHours}h';
    if (diff.inDays < 7) return '${diff.inDays}d';
    return '${(diff.inDays / 7).floor()}w';
  }

  @override
  Widget build(BuildContext context) {
    final hasUnread = _notifications.any((n) => n['is_read'] == false);

    return Scaffold(
      backgroundColor: _bg,
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        elevation: 0,
        foregroundColor: _darkText,
        title: const Text(
          'Notifications',
          style: TextStyle(fontWeight: FontWeight.w800, fontSize: 20),
        ),
        actions: [
          if (hasUnread)
            TextButton(
              onPressed: _markAllRead,
              child: Text(
                'Read all',
                style: TextStyle(
                  color: _maroon,
                  fontWeight: FontWeight.w700,
                  fontSize: 13,
                ),
              ),
            ),
        ],
        bottom: PreferredSize(
          preferredSize: const Size.fromHeight(48),
          child: Container(
            margin: const EdgeInsets.symmetric(horizontal: 20),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(14),
              boxShadow: [
                BoxShadow(
                  color: _darkText.withValues(alpha: 0.04),
                  blurRadius: 8,
                  offset: const Offset(0, 2),
                ),
              ],
            ),
            child: TabBar(
              controller: _tabController,
              indicator: BoxDecoration(
                color: _maroon,
                borderRadius: BorderRadius.circular(12),
              ),
              dividerColor: Colors.transparent,
              indicatorSize: TabBarIndicatorSize.tab,
              labelColor: Colors.white,
              unselectedLabelColor: _darkText.withValues(alpha: 0.45),
              labelStyle: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700),
              unselectedLabelStyle:
                  const TextStyle(fontSize: 13, fontWeight: FontWeight.w600),
              padding: const EdgeInsets.all(4),
              tabs: const [
                Tab(text: 'All'),
                Tab(text: 'Food'),
                Tab(text: 'Restaurants'),
              ],
            ),
          ),
        ),
      ),
      body: _isLoading
          ? Center(child: SpoonLoader(size: 60))
          : _hasError
              ? _buildErrorState()
              : TabBarView(
                  controller: _tabController,
                  children: [
                    _buildNotificationList('all'),
                    _buildNotificationList('food'),
                    _buildNotificationList('restaurant'),
                  ],
                ),
    );
  }

  Widget _buildErrorState() {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(Icons.wifi_off_rounded, size: 48, color: _maroon.withValues(alpha: 0.3)),
          const SizedBox(height: 16),
          const Text(
            'Couldn\'t load notifications',
            style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600, color: _darkText),
          ),
          const SizedBox(height: 16),
          GestureDetector(
            onTap: _fetchNotifications,
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
              decoration: BoxDecoration(
                color: _maroon,
                borderRadius: BorderRadius.circular(12),
              ),
              child: const Text('Retry',
                  style: TextStyle(color: Colors.white, fontWeight: FontWeight.w700)),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildNotificationList(String type) {
    final items = _filterByType(type);

    if (items.isEmpty) return _buildEmptyState(type);

    return RefreshIndicator(
      color: _maroon,
      onRefresh: _fetchNotifications,
      child: ListView.separated(
        physics: const AlwaysScrollableScrollPhysics(parent: BouncingScrollPhysics()),
        padding: const EdgeInsets.fromLTRB(20, 24, 20, 40),
        itemCount: items.length,
        separatorBuilder: (_, __) => const SizedBox(height: 10),
        itemBuilder: (context, index) {
          final item = items[index];
          final globalIndex = _notifications.indexOf(item);
          return _buildNotificationCard(item, index, globalIndex);
        },
      ),
    );
  }

  Widget _buildEmptyState(String type) {
    String title;
    String subtitle;
    IconData icon;

    switch (type) {
      case 'food':
        title = 'no food alerts yet';
        subtitle = 'when your fav items drop back,\nyou\'ll know first bestie';
        icon = Icons.fastfood_rounded;
        break;
      case 'restaurant':
        title = 'no restaurant updates';
        subtitle = 'we\'ll ping you when spots\nopen or are about to close';
        icon = Icons.store_rounded;
        break;
      default:
        title = 'all caught up! 🎉';
        subtitle = 'no notifications rn\nwe\'ll hit you up when something drops';
        icon = Icons.notifications_none_rounded;
    }

    return Center(
      child: Padding(
        padding: const EdgeInsets.only(bottom: 60),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Container(
              width: 100,
              height: 100,
              decoration: BoxDecoration(
                color: _maroon.withValues(alpha: 0.06),
                shape: BoxShape.circle,
              ),
              child: Icon(icon, size: 44, color: _maroon.withValues(alpha: 0.4)),
            )
                .animate(onPlay: (c) => c.repeat(reverse: true))
                .scaleXY(begin: 1.0, end: 1.05, duration: 2000.ms)
                .then()
                .scaleXY(begin: 1.05, end: 1.0, duration: 2000.ms),
            const SizedBox(height: 24),
            Text(
              title,
              style: const TextStyle(
                fontSize: 20,
                fontWeight: FontWeight.w800,
                color: _darkText,
              ),
            ).animate().fadeIn(duration: 400.ms),
            const SizedBox(height: 8),
            Text(
              subtitle,
              textAlign: TextAlign.center,
              style: TextStyle(
                fontSize: 14,
                color: _darkText.withValues(alpha: 0.4),
                fontWeight: FontWeight.w500,
                height: 1.5,
              ),
            ).animate().fadeIn(duration: 400.ms, delay: 100.ms),
            const SizedBox(height: 32),
            Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: List.generate(3, (i) {
                return Container(
                  margin: const EdgeInsets.symmetric(horizontal: 4),
                  width: 6,
                  height: 6,
                  decoration: BoxDecoration(
                    color: _maroon.withValues(alpha: 0.1 + (i * 0.08)),
                    shape: BoxShape.circle,
                  ),
                );
              }),
            ).animate().fadeIn(duration: 400.ms, delay: 200.ms),
          ],
        ),
      ),
    );
  }

  Widget _buildNotificationCard(Map<String, dynamic> item, int animIndex, int globalIndex) {
    final type = item['type']?.toString() ?? '';
    final isRead = item['is_read'] == true;
    final iconData = _getIcon(type);
    final iconColor = _getIconColor(type);
    final title = item['title']?.toString() ?? '';
    final body = item['body']?.toString() ?? '';
    final timeAgo = _timeAgo(item['created_at']?.toString() ?? '');
    final id = item['id']?.toString() ?? '';

    return GestureDetector(
      onTap: () {
        if (!isRead) _markRead(id, globalIndex);
      },
      child: Dismissible(
        key: Key(id),
        direction: DismissDirection.startToEnd,
        background: Container(
          alignment: Alignment.centerLeft,
          padding: const EdgeInsets.only(left: 20),
          decoration: BoxDecoration(
            color: _maroon.withValues(alpha: 0.1),
            borderRadius: BorderRadius.circular(18),
          ),
          child: Icon(Icons.done_all_rounded, color: _maroon),
        ),
        confirmDismiss: (_) async {
          if (!isRead) _markRead(id, globalIndex);
          return false; // Don't actually dismiss, just mark as read
        },
        child: Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: isRead ? Colors.white : _maroon.withValues(alpha: 0.04),
            borderRadius: BorderRadius.circular(18),
            border: Border.all(
              color: isRead
                  ? _darkText.withValues(alpha: 0.06)
                  : _maroon.withValues(alpha: 0.12),
            ),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withValues(alpha: 0.02),
                blurRadius: 8,
                offset: const Offset(0, 2),
              ),
            ],
          ),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Icon
              Container(
                width: 42,
                height: 42,
                decoration: BoxDecoration(
                  color: iconColor.withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Icon(iconData, color: iconColor, size: 20),
              ),
              const SizedBox(width: 14),
              // Content
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      title,
                      style: TextStyle(
                        fontSize: 14,
                        fontWeight: isRead ? FontWeight.w600 : FontWeight.w700,
                        color: _darkText,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      body,
                      style: TextStyle(
                        fontSize: 12.5,
                        color: _darkText.withValues(alpha: 0.5),
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 8),
              // Time + unread dot
              Column(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  Text(
                    timeAgo,
                    style: TextStyle(
                      fontSize: 11,
                      color: _darkText.withValues(alpha: 0.3),
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                  if (!isRead)
                    Container(
                      margin: const EdgeInsets.only(top: 8),
                      width: 8,
                      height: 8,
                      decoration: const BoxDecoration(
                        color: _maroon,
                        shape: BoxShape.circle,
                      ),
                    ),
                ],
              ),
            ],
          ),
        ),
      ),
    ).animate().fadeIn(duration: 250.ms, delay: Duration(milliseconds: 50 * animIndex));
  }
}
