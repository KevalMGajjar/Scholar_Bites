import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:qr_flutter/qr_flutter.dart';
import '../services/order_service.dart';

/// Multi-restaurant QR screen with:
/// - Horizontal PageView for swiping between restaurant sub-orders
/// - 15-second rotating QR codes (HMAC-based)
/// - "Not Ready" overlay when food isn't ready
/// - Screenshot prevention (Android FLAG_SECURE)
class MultiQrScreen extends StatefulWidget {
  final String batchId;
  final List<Map<String, dynamic>> subOrders;

  const MultiQrScreen({
    super.key,
    required this.batchId,
    required this.subOrders,
  });

  @override
  State<MultiQrScreen> createState() => _MultiQrScreenState();
}

class _MultiQrScreenState extends State<MultiQrScreen> {
  static const _rotationInterval = Duration(seconds: 15);
  static const platform = MethodChannel('com.nexplay/security');

  final OrderService _orderService = OrderService();
  final PageController _pageController = PageController(viewportFraction: 0.88);

  // QR data per sub-order index
  Map<int, String?> _qrData = {};
  Map<int, String> _statuses = {};
  Map<int, int> _expiresIn = {};

  Timer? _refreshTimer;
  int _currentPage = 0;
  bool _disposed = false;

  @override
  void initState() {
    super.initState();
    _enableScreenSecurity();
    _initializeStatuses();
    _fetchAllQrTokens();
    _refreshTimer = Timer.periodic(_rotationInterval, (_) => _fetchAllQrTokens());
  }

  @override
  void dispose() {
    _disposed = true;
    _refreshTimer?.cancel();
    _pageController.dispose();
    _disableScreenSecurity();
    super.dispose();
  }

  void _initializeStatuses() {
    for (int i = 0; i < widget.subOrders.length; i++) {
      _statuses[i] = widget.subOrders[i]['status'] ?? 'preparing';
      _qrData[i] = null;
    }
  }

  Future<void> _enableScreenSecurity() async {
    try {
      await platform.invokeMethod('enableSecureScreen');
    } catch (e) {
      debugPrint('Screen security not supported: $e');
    }
  }

  Future<void> _disableScreenSecurity() async {
    try {
      await platform.invokeMethod('disableSecureScreen');
    } catch (e) {
      debugPrint('Screen security cleanup failed: $e');
    }
  }

  Future<void> _fetchAllQrTokens() async {
    if (_disposed) return;
    for (int i = 0; i < widget.subOrders.length; i++) {
      await _fetchQrToken(i);
    }
  }

  Future<void> _fetchQrToken(int index) async {
    if (_disposed) return;
    try {
      final orderId = widget.subOrders[index]['id'];
      final response = await _orderService.getQrToken(orderId);
      if (_disposed) return;
      setState(() {
        _statuses[index] = response['status'] ?? 'preparing';
        if (response['ready'] == true) {
          _qrData[index] = response['qr_data'];
          _expiresIn[index] = response['expires_in'] ?? 15;
        } else {
          _qrData[index] = null;
        }
      });
    } catch (e) {
      debugPrint('Failed to fetch QR for index $index: $e');
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Scaffold(
      backgroundColor: const Color(0xFF0A0E1A),
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        elevation: 0,
        title: Column(
          children: [
            Text(
              'Your Pickup QR Codes',
              style: theme.textTheme.titleMedium?.copyWith(
                fontWeight: FontWeight.w800,
                color: Colors.white,
                letterSpacing: -0.3,
              ),
            ),
            Text(
              '${widget.subOrders.length} restaurant${widget.subOrders.length > 1 ? 's' : ''} · Swipe to navigate',
              style: theme.textTheme.bodySmall?.copyWith(
                color: Colors.white.withOpacity(0.4),
                fontSize: 11,
              ),
            ),
          ],
        ),
        centerTitle: true,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new_rounded, size: 18),
          onPressed: () => Navigator.pop(context),
        ),
      ),
      body: Column(
        children: [
          const SizedBox(height: 16),
          // Page indicators
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: List.generate(widget.subOrders.length, (i) {
              final isActive = i == _currentPage;
              return AnimatedContainer(
                duration: const Duration(milliseconds: 300),
                margin: const EdgeInsets.symmetric(horizontal: 4),
                width: isActive ? 28 : 8,
                height: 8,
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(4),
                  color: isActive
                      ? const Color(0xFF818CF8)
                      : Colors.white.withOpacity(0.1),
                ),
              );
            }),
          ),
          const SizedBox(height: 20),
          // QR Cards PageView
          Expanded(
            child: PageView.builder(
              controller: _pageController,
              itemCount: widget.subOrders.length,
              onPageChanged: (idx) => setState(() => _currentPage = idx),
              itemBuilder: (context, index) {
                final sub = widget.subOrders[index];
                final status = _statuses[index] ?? 'preparing';
                final qrData = _qrData[index];
                final isReady = status == 'ready';
                final isCompleted = status == 'completed';

                return AnimatedScale(
                  scale: index == _currentPage ? 1.0 : 0.92,
                  duration: const Duration(milliseconds: 300),
                  child: _buildQrCard(
                    sub: sub,
                    index: index,
                    status: status,
                    qrData: qrData,
                    isReady: isReady,
                    isCompleted: isCompleted,
                  ),
                );
              },
            ),
          ),
          const SizedBox(height: 24),
        ],
      ),
    );
  }

  Widget _buildQrCard({
    required Map<String, dynamic> sub,
    required int index,
    required String status,
    required String? qrData,
    required bool isReady,
    required bool isCompleted,
  }) {
    final restaurantName = sub['restaurant_name'] ?? 'Restaurant';
    final orderToken = sub['order_token'] ?? '';
    final amount = sub['total_amount'] ?? sub['amount'] ?? 0;

    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(28),
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: isCompleted
              ? [const Color(0xFF0F1218), const Color(0xFF0A0E16)]
              : [const Color(0xFF10141E), const Color(0xFF0C1020)],
        ),
        border: Border.all(
          color: isReady
              ? const Color(0xFF818CF8).withOpacity(0.3)
              : Colors.white.withOpacity(0.06),
          width: isReady ? 1.5 : 1,
        ),
        boxShadow: isReady
            ? [BoxShadow(color: const Color(0xFF818CF8).withOpacity(0.08), blurRadius: 40)]
            : null,
      ),
      child: Column(
        children: [
          // Restaurant header
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 18),
            decoration: BoxDecoration(
              border: Border(
                bottom: BorderSide(color: Colors.white.withOpacity(0.04)),
              ),
            ),
            child: Row(
              children: [
                Container(
                  width: 42,
                  height: 42,
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(14),
                    gradient: const LinearGradient(
                      colors: [Color(0xFF818CF8), Color(0xFFA78BFA)],
                    ),
                  ),
                  child: Center(
                    child: Text(
                      restaurantName.isNotEmpty ? restaurantName[0].toUpperCase() : 'R',
                      style: const TextStyle(
                        color: Colors.white,
                        fontWeight: FontWeight.w800,
                        fontSize: 18,
                      ),
                    ),
                  ),
                ),
                const SizedBox(width: 14),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        restaurantName,
                        style: const TextStyle(
                          color: Colors.white,
                          fontWeight: FontWeight.w700,
                          fontSize: 15,
                          letterSpacing: -0.3,
                        ),
                      ),
                      const SizedBox(height: 3),
                      Text(
                        'Token: $orderToken · ₹${_formatAmount(amount)}',
                        style: TextStyle(
                          color: Colors.white.withOpacity(0.4),
                          fontSize: 12,
                          fontWeight: FontWeight.w500,
                        ),
                      ),
                    ],
                  ),
                ),
                _buildStatusBadge(status),
              ],
            ),
          ),
          // QR Code area
          Expanded(
            child: Center(
              child: Stack(
                alignment: Alignment.center,
                children: [
                  // QR Code
                  if (isReady && qrData != null)
                    _buildActiveQr(qrData, index)
                  else if (isCompleted)
                    _buildCompletedState()
                  else
                    _buildNotReadyOverlay(status),
                ],
              ),
            ),
          ),
          // Items preview
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 14),
            decoration: BoxDecoration(
              border: Border(
                top: BorderSide(color: Colors.white.withOpacity(0.04)),
              ),
            ),
            child: Row(
              children: [
                Icon(Icons.receipt_long_rounded, size: 14, color: Colors.white.withOpacity(0.3)),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    _buildItemsSummary(sub),
                    style: TextStyle(
                      color: Colors.white.withOpacity(0.35),
                      fontSize: 11,
                      fontWeight: FontWeight.w500,
                    ),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildActiveQr(String qrData, int index) {
    final expiresIn = _expiresIn[index] ?? 15;
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          padding: const EdgeInsets.all(20),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(20),
            boxShadow: [
              BoxShadow(
                color: const Color(0xFF818CF8).withOpacity(0.1),
                blurRadius: 30,
                spreadRadius: 5,
              ),
            ],
          ),
          child: QrImageView(
            data: qrData,
            version: QrVersions.auto,
            size: 180,
            backgroundColor: Colors.white,
            eyeStyle: const QrEyeStyle(
              eyeShape: QrEyeShape.square,
              color: Color(0xFF1A1A2E),
            ),
            dataModuleStyle: const QrDataModuleStyle(
              dataModuleShape: QrDataModuleShape.square,
              color: Color(0xFF1A1A2E),
            ),
          ),
        ),
        const SizedBox(height: 16),
        // Countdown indicator
        Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            SizedBox(
              width: 14,
              height: 14,
              child: CircularProgressIndicator(
                value: expiresIn / 15.0,
                strokeWidth: 2,
                backgroundColor: Colors.white.withOpacity(0.06),
                valueColor: const AlwaysStoppedAnimation(Color(0xFF818CF8)),
              ),
            ),
            const SizedBox(width: 8),
            Text(
              'Refreshes in ${expiresIn}s',
              style: TextStyle(
                color: Colors.white.withOpacity(0.35),
                fontSize: 11,
                fontWeight: FontWeight.w600,
              ),
            ),
          ],
        ),
      ],
    );
  }

  Widget _buildNotReadyOverlay(String status) {
    final statusLabel = status == 'preparing' ? 'Being Prepared' : status.toUpperCase();
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        // Blurred/dimmed QR placeholder
        Container(
          width: 180,
          height: 180,
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(20),
            color: Colors.white.withOpacity(0.03),
            border: Border.all(color: Colors.white.withOpacity(0.06)),
          ),
          child: Center(
            child: Icon(
              Icons.qr_code_2_rounded,
              size: 80,
              color: Colors.white.withOpacity(0.06),
            ),
          ),
        ),
        const SizedBox(height: 20),
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 10),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(14),
            color: const Color(0xFFF59E0B).withOpacity(0.08),
            border: Border.all(color: const Color(0xFFF59E0B).withOpacity(0.15)),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(Icons.schedule_rounded, size: 16, color: Color(0xFFF59E0B)),
              const SizedBox(width: 8),
              Text(
                'Food is $statusLabel',
                style: const TextStyle(
                  color: Color(0xFFF59E0B),
                  fontWeight: FontWeight.w700,
                  fontSize: 13,
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 8),
        Text(
          'QR code will appear when your order is ready',
          style: TextStyle(
            color: Colors.white.withOpacity(0.3),
            fontSize: 11,
          ),
        ),
      ],
    );
  }

  Widget _buildCompletedState() {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          width: 80,
          height: 80,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            color: const Color(0xFF10B981).withOpacity(0.1),
          ),
          child: const Icon(Icons.check_circle_rounded, size: 48, color: Color(0xFF10B981)),
        ),
        const SizedBox(height: 16),
        const Text(
          'Picked Up',
          style: TextStyle(color: Color(0xFF10B981), fontWeight: FontWeight.w800, fontSize: 18),
        ),
        const SizedBox(height: 4),
        Text(
          'This order has been collected',
          style: TextStyle(color: Colors.white.withOpacity(0.3), fontSize: 12),
        ),
      ],
    );
  }

  Widget _buildStatusBadge(String status) {
    Color color;
    String label;
    switch (status) {
      case 'preparing':
        color = const Color(0xFF818CF8);
        label = 'PREPARING';
      case 'ready':
        color = const Color(0xFF10B981);
        label = 'READY';
      case 'completed':
        color = const Color(0xFF6B7280);
        label = 'DONE';
      default:
        color = const Color(0xFFF59E0B);
        label = status.toUpperCase();
    }
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(10),
        color: color.withOpacity(0.1),
        border: Border.all(color: color.withOpacity(0.2)),
      ),
      child: Text(
        label,
        style: TextStyle(
          color: color,
          fontSize: 10,
          fontWeight: FontWeight.w800,
          letterSpacing: 0.8,
        ),
      ),
    );
  }

  String _formatAmount(dynamic amount) {
    if (amount is num) return amount.toStringAsFixed(0);
    return double.tryParse(amount.toString())?.toStringAsFixed(0) ?? '0';
  }

  String _buildItemsSummary(Map<String, dynamic> sub) {
    final items = sub['items'] as List? ?? [];
    if (items.isEmpty) return 'No items';
    return items.map((i) => '${i['quantity']}x ${i['item_name'] ?? i['name'] ?? 'Item'}').join(', ');
  }
}
