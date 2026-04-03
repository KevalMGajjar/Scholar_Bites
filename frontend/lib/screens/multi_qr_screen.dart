import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:qr_flutter/qr_flutter.dart';
import '../services/order_service.dart';

/// Premium multi-restaurant QR screen matching the app's maroon/cream design.
/// Features:
/// - Horizontal PageView for swiping between restaurant sub-orders
/// - 15-second rotating QR codes (HMAC-based)
/// - "Not Ready" overlay when food isn't ready
/// - "Continue Browsing" button
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
  static const _maroon = Color(0xFF8B1C28);
  static const _darkText = Color(0xFF4A0E13);
  static const _bg = Color(0xFFFCF9F5);
  static const _rotationInterval = Duration(seconds: 15);
  static const platform = MethodChannel('com.nexplay/security');

  final OrderService _orderService = OrderService();
  final PageController _pageController = PageController(viewportFraction: 0.88);

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
    return PopScope(
      canPop: false,
      child: Scaffold(
        backgroundColor: _bg,
        appBar: AppBar(
          backgroundColor: Colors.transparent,
          elevation: 0,
          foregroundColor: _darkText,
          centerTitle: true,
          leading: IconButton(
            icon: const Icon(Icons.arrow_back_ios_new_rounded, size: 18),
            onPressed: () => Navigator.of(context).popUntil((route) => route.isFirst),
          ),
          title: Column(
            children: [
              const Text(
                'Pickup QR Codes',
                style: TextStyle(
                  fontWeight: FontWeight.w800,
                  color: _darkText,
                  fontSize: 17,
                ),
              ),
              Text(
                '${widget.subOrders.length} restaurant${widget.subOrders.length > 1 ? 's' : ''} · Swipe to view',
                style: TextStyle(
                  color: _darkText.withOpacity(0.4),
                  fontSize: 11,
                  fontWeight: FontWeight.w500,
                ),
              ),
            ],
          ),
        ),
        body: SafeArea(
          child: Column(
            children: [
              const SizedBox(height: 12),
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
                      color: isActive ? _maroon : _maroon.withOpacity(0.12),
                    ),
                  );
                }),
              ).animate().fadeIn(duration: 400.ms),
              const SizedBox(height: 16),
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
                      scale: index == _currentPage ? 1.0 : 0.93,
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
              // Continue Browsing button
              Padding(
                padding: const EdgeInsets.fromLTRB(32, 16, 32, 24),
                child: SizedBox(
                  width: double.infinity,
                  height: 56,
                  child: ElevatedButton(
                    onPressed: () {
                      Navigator.of(context).popUntil((route) => route.isFirst);
                    },
                    style: ElevatedButton.styleFrom(
                      backgroundColor: _maroon,
                      foregroundColor: Colors.white,
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(20),
                      ),
                      elevation: 8,
                      shadowColor: _maroon.withOpacity(0.4),
                    ),
                    child: const Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Icon(Icons.restaurant_menu_rounded, size: 20),
                        SizedBox(width: 10),
                        Text(
                          'Continue Browsing',
                          style: TextStyle(
                            fontSize: 16,
                            fontWeight: FontWeight.w800,
                            letterSpacing: 0.3,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ).animate().fadeIn(delay: 600.ms, duration: 400.ms).slideY(begin: 0.3),
            ],
          ),
        ),
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
      margin: const EdgeInsets.symmetric(horizontal: 8, vertical: 8),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(28),
        border: Border.all(
          color: isReady
              ? _maroon.withOpacity(0.2)
              : _darkText.withOpacity(0.05),
          width: isReady ? 1.5 : 1,
        ),
        boxShadow: [
          BoxShadow(
            color: isReady
                ? _maroon.withOpacity(0.08)
                : Colors.black.withOpacity(0.04),
            blurRadius: 24,
            offset: const Offset(0, 8),
          ),
        ],
      ),
      child: Column(
        children: [
          // Restaurant header
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 22, vertical: 16),
            decoration: BoxDecoration(
              border: Border(
                bottom: BorderSide(color: _darkText.withOpacity(0.05)),
              ),
            ),
            child: Row(
              children: [
                Container(
                  width: 44,
                  height: 44,
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(14),
                    gradient: const LinearGradient(
                      colors: [_maroon, Color(0xFF6B151F)],
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
                          color: _darkText,
                          fontWeight: FontWeight.w800,
                          fontSize: 15,
                        ),
                      ),
                      const SizedBox(height: 3),
                      Text(
                        'Token: $orderToken · ₹${_formatAmount(amount)}',
                        style: TextStyle(
                          color: _darkText.withOpacity(0.4),
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
              child: isReady && qrData != null
                  ? _buildActiveQr(qrData, index)
                  : isCompleted
                      ? _buildCompletedState()
                      : _buildNotReadyOverlay(status),
            ),
          ),
          // Items summary footer
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 22, vertical: 12),
            decoration: BoxDecoration(
              border: Border(
                top: BorderSide(color: _darkText.withOpacity(0.05)),
              ),
            ),
            child: Row(
              children: [
                Icon(Icons.receipt_long_rounded, size: 14, color: _darkText.withOpacity(0.25)),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    _buildItemsSummary(sub),
                    style: TextStyle(
                      color: _darkText.withOpacity(0.35),
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
    ).animate().fadeIn(delay: (100 * index).ms, duration: 400.ms).slideY(begin: 0.1);
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
            borderRadius: BorderRadius.circular(24),
            boxShadow: [
              BoxShadow(
                color: _maroon.withOpacity(0.06),
                blurRadius: 30,
                spreadRadius: 2,
              ),
            ],
          ),
          child: QrImageView(
            data: qrData,
            version: QrVersions.auto,
            size: 180,
            eyeStyle: const QrEyeStyle(
              eyeShape: QrEyeShape.square,
              color: _darkText,
            ),
            dataModuleStyle: const QrDataModuleStyle(
              dataModuleShape: QrDataModuleShape.square,
              color: _darkText,
            ),
          ),
        ),
        const SizedBox(height: 14),
        // Refresh countdown
        Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            SizedBox(
              width: 14,
              height: 14,
              child: CircularProgressIndicator(
                value: expiresIn / 15.0,
                strokeWidth: 2,
                backgroundColor: _maroon.withOpacity(0.08),
                valueColor: AlwaysStoppedAnimation(_maroon.withOpacity(0.5)),
              ),
            ),
            const SizedBox(width: 8),
            Text(
              'Refreshes in ${expiresIn}s',
              style: TextStyle(
                color: _darkText.withOpacity(0.3),
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
    final statusLabel = status == 'preparing' ? 'Being Prepared' : status;
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        // Dimmed QR placeholder
        Container(
          width: 180,
          height: 180,
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(24),
            color: _maroon.withOpacity(0.03),
            border: Border.all(color: _maroon.withOpacity(0.06)),
          ),
          child: Center(
            child: Icon(
              Icons.qr_code_2_rounded,
              size: 80,
              color: _maroon.withOpacity(0.08),
            ),
          ),
        ),
        const SizedBox(height: 18),
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 10),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(14),
            color: const Color(0xFFF59E0B).withOpacity(0.1),
            border: Border.all(color: const Color(0xFFF59E0B).withOpacity(0.2)),
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
          'QR code will appear when ready',
          style: TextStyle(
            color: _darkText.withOpacity(0.3),
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
          style: TextStyle(color: _darkText.withOpacity(0.3), fontSize: 12),
        ),
      ],
    );
  }

  Widget _buildStatusBadge(String status) {
    Color color;
    String label;
    switch (status) {
      case 'preparing':
        color = const Color(0xFF3B82F6);
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
