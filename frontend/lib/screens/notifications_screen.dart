import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';

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

  // Placeholder notification data (empty for now)
  final List<_NotificationItem> _allNotifications = [];

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 3, vsync: this);
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  List<_NotificationItem> _filterByType(String type) {
    if (type == 'all') return _allNotifications;
    return _allNotifications.where((n) => n.type == type).toList();
  }

  @override
  Widget build(BuildContext context) {
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
              labelStyle: const TextStyle(
                  fontSize: 13, fontWeight: FontWeight.w700),
              unselectedLabelStyle: const TextStyle(
                  fontSize: 13, fontWeight: FontWeight.w600),
              padding: const EdgeInsets.all(4),
              tabs: const [
                Tab(text: 'All'),
                Tab(text: 'Orders'),
                Tab(text: 'Promos'),
              ],
            ),
          ),
        ),
      ),
      body: TabBarView(
        controller: _tabController,
        children: [
          _buildNotificationList('all'),
          _buildNotificationList('order'),
          _buildNotificationList('promo'),
        ],
      ),
    );
  }

  Widget _buildNotificationList(String type) {
    final items = _filterByType(type);

    if (items.isEmpty) {
      return _buildEmptyState(type);
    }

    return ListView.separated(
      physics: const BouncingScrollPhysics(),
      padding: const EdgeInsets.fromLTRB(20, 24, 20, 40),
      itemCount: items.length,
      separatorBuilder: (_, __) => const SizedBox(height: 10),
      itemBuilder: (context, index) {
        final item = items[index];
        return _buildNotificationCard(item, index);
      },
    );
  }

  Widget _buildEmptyState(String type) {
    String title;
    String subtitle;
    IconData icon;

    switch (type) {
      case 'order':
        title = 'No order updates';
        subtitle = 'When you place an order, updates\nwill appear here';
        icon = Icons.receipt_long_rounded;
        break;
      case 'promo':
        title = 'No promotions yet';
        subtitle = 'Special deals and discounts\nwill show up here';
        icon = Icons.local_offer_rounded;
        break;
      default:
        title = 'All caught up!';
        subtitle = 'You have no notifications right now.\nWe\'ll let you know when something arrives';
        icon = Icons.notifications_none_rounded;
    }

    return Center(
      child: Padding(
        padding: const EdgeInsets.only(bottom: 60),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            // Animated bell/icon
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
            // Subtle decorative dots
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

  Widget _buildNotificationCard(_NotificationItem item, int index) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: item.isRead ? Colors.white : _maroon.withValues(alpha: 0.04),
        borderRadius: BorderRadius.circular(18),
        border: Border.all(
          color: item.isRead
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
          Container(
            width: 42,
            height: 42,
            decoration: BoxDecoration(
              color: item.iconColor.withValues(alpha: 0.1),
              borderRadius: BorderRadius.circular(12),
            ),
            child: Icon(item.icon, color: item.iconColor, size: 20),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  item.title,
                  style: TextStyle(
                    fontSize: 14,
                    fontWeight: item.isRead ? FontWeight.w600 : FontWeight.w700,
                    color: _darkText,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  item.subtitle,
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
          Text(
            item.timeAgo,
            style: TextStyle(
              fontSize: 11,
              color: _darkText.withValues(alpha: 0.3),
              fontWeight: FontWeight.w500,
            ),
          ),
          if (!item.isRead)
            Container(
              margin: const EdgeInsets.only(left: 6, top: 2),
              width: 8,
              height: 8,
              decoration: const BoxDecoration(
                color: _maroon,
                shape: BoxShape.circle,
              ),
            ),
        ],
      ),
    ).animate().fadeIn(duration: 250.ms, delay: Duration(milliseconds: 50 * index));
  }
}

// ── Data Model ───────────────────────────────────────
class _NotificationItem {
  final String title;
  final String subtitle;
  final String timeAgo;
  final IconData icon;
  final Color iconColor;
  final String type; // 'order', 'promo', 'system'
  final bool isRead;

  const _NotificationItem({
    required this.title,
    required this.subtitle,
    required this.timeAgo,
    required this.icon,
    required this.iconColor,
    required this.type,
    this.isRead = false,
  });
}
