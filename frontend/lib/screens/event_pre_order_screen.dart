import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:intl/intl.dart';
import '../services/staff_service.dart';
import '../utils/custom_toast.dart';
import '../widgets/spoon_loader.dart';
import 'new_event_order_screen.dart';

class EventPreOrderScreen extends StatefulWidget {
  const EventPreOrderScreen({super.key});

  @override
  State<EventPreOrderScreen> createState() => _EventPreOrderScreenState();
}

class _EventPreOrderScreenState extends State<EventPreOrderScreen> {
  final StaffService _staffService = StaffService();
  bool _isLoading = true;
  List<dynamic> _orders = [];

  @override
  void initState() {
    super.initState();
    _fetchOrders();
  }

  Future<void> _fetchOrders() async {
    setState(() => _isLoading = true);
    try {
      final data = await _staffService.getMyEventOrders();
      setState(() {
        _orders = data;
        _isLoading = false;
      });
    } catch (e) {
      setState(() => _isLoading = false);
      if (mounted) CustomToast.showErrorToast(context, 'Failed to fetch event orders');
    }
  }

  void _cancelOrder(String id) async {
    try {
      await _staffService.cancelEventOrder(id);
      if (mounted) CustomToast.showSuccessToast(context, 'Event order cancelled');
      _fetchOrders();
    } catch (e) {
      if (mounted) CustomToast.showErrorToast(context, e.toString());
    }
  }

  Color _getStatusColor(String status) {
    switch (status) {
      case 'pending':
      case 'upcoming':
        return const Color(0xFFF57C00);
      case 'approved':
      case 'confirmed':
        return const Color(0xFF388E3C);
      case 'completed':
      case 'preparing':
        return const Color(0xFF1976D2);
      case 'cancelled':
      case 'rejected':
        return const Color(0xFFD32F2F);
      default:
        return Colors.grey;
    }
  }

  IconData _getStatusIcon(String status) {
    switch (status) {
      case 'pending':
      case 'upcoming':
        return Icons.hourglass_top_rounded;
      case 'approved':
      case 'confirmed':
        return Icons.check_circle_rounded;
      case 'completed':
        return Icons.done_all_rounded;
      case 'preparing':
        return Icons.restaurant_rounded;
      case 'cancelled':
        return Icons.cancel_rounded;
      case 'rejected':
        return Icons.block_rounded;
      default:
        return Icons.info_rounded;
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFFDF0F0),
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        elevation: 0,
        centerTitle: true,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_rounded, color: Color(0xFF4A0E13)),
          onPressed: () => Navigator.pop(context),
        ),
        title: Text(
          'My Catering Events',
          style: GoogleFonts.poppins(
            color: const Color(0xFF4A0E13),
            fontSize: 20,
            fontWeight: FontWeight.w700,
          ),
        ),
      ),
      floatingActionButton: FloatingActionButton.extended(
        backgroundColor: const Color(0xFF8B1C28),
        onPressed: () async {
          final result = await Navigator.push(
            context,
            MaterialPageRoute(builder: (_) => const NewEventOrderScreen()),
          );
          if (result == true) {
            _fetchOrders();
          }
        },
        icon: const Icon(Icons.event_available_rounded, color: Colors.white),
        label: Text('Request Catering', style: GoogleFonts.poppins(color: Colors.white, fontWeight: FontWeight.bold)),
      ),
      body: _isLoading
          ? Center(child: SpoonLoader(size: 50))
          : _orders.isEmpty
              ? Center(
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Icon(Icons.event_busy_rounded, size: 80, color: const Color(0xFF8B1C28).withValues(alpha: 0.2)),
                      const SizedBox(height: 16),
                      Text(
                        'No catering requests yet',
                        style: GoogleFonts.poppins(
                          fontSize: 18,
                          fontWeight: FontWeight.w700,
                          color: const Color(0xFF4A0E13).withValues(alpha: 0.6),
                        ),
                      ),
                      const SizedBox(height: 8),
                      Text(
                        'Tap the button below to create your first\ncatering request for an event.',
                        textAlign: TextAlign.center,
                        style: GoogleFonts.poppins(
                          fontSize: 13,
                          color: const Color(0xFF4A0E13).withValues(alpha: 0.4),
                        ),
                      ),
                    ],
                  ).animate().fadeIn(),
                )
              : RefreshIndicator(
                  color: const Color(0xFF8B1C28),
                  onRefresh: _fetchOrders,
                  child: ListView.builder(
                    padding: const EdgeInsets.fromLTRB(20, 16, 20, 100),
                    itemCount: _orders.length,
                    itemBuilder: (context, index) {
                      final order = _orders[index];
                      final status = (order['status'] ?? 'pending').toString();
                      final statusColor = _getStatusColor(status);
                      final statusIcon = _getStatusIcon(status);

                      // Parse date/time safely
                      DateTime? eventDate;
                      String? eventTimeStr;
                      try {
                        eventDate = DateTime.parse(order['event_date']).toLocal();
                        eventTimeStr = order['event_time']?.toString();
                      } catch (_) {
                        try {
                          eventDate = DateTime.parse(order['catering_time']).toLocal();
                        } catch (_) {}
                      }

                      final memberCount = order['member_count'] ?? order['expected_guests'] ?? 0;
                      final items = order['items'] as List<dynamic>? ?? [];
                      final totalAmount = order['total_amount'];
                      final rejectionReason = order['rejection_reason']?.toString();

                      return Container(
                        margin: const EdgeInsets.only(bottom: 16),
                        decoration: BoxDecoration(
                          color: Colors.white,
                          borderRadius: BorderRadius.circular(20),
                          border: status == 'rejected'
                              ? Border.all(color: Colors.red.withValues(alpha: 0.2), width: 1.5)
                              : status == 'approved'
                                  ? Border.all(color: Colors.green.withValues(alpha: 0.2), width: 1.5)
                                  : null,
                          boxShadow: [
                            BoxShadow(
                              color: const Color(0xFF8B1C28).withValues(alpha: 0.04),
                              blurRadius: 16, offset: const Offset(0, 6),
                            )
                          ],
                        ),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            // Header with status
                            Container(
                              padding: const EdgeInsets.fromLTRB(20, 16, 16, 12),
                              decoration: BoxDecoration(
                                color: statusColor.withValues(alpha: 0.04),
                                borderRadius: const BorderRadius.vertical(top: Radius.circular(20)),
                              ),
                              child: Row(
                                children: [
                                  Container(
                                    padding: const EdgeInsets.all(8),
                                    decoration: BoxDecoration(
                                      color: statusColor.withValues(alpha: 0.1),
                                      borderRadius: BorderRadius.circular(12),
                                    ),
                                    child: Icon(statusIcon, size: 20, color: statusColor),
                                  ),
                                  const SizedBox(width: 12),
                                  Expanded(
                                    child: Column(
                                      crossAxisAlignment: CrossAxisAlignment.start,
                                      children: [
                                        Text(
                                          order['event_name'] ?? 'Untitled Event',
                                          style: GoogleFonts.poppins(
                                            fontWeight: FontWeight.w700,
                                            fontSize: 16,
                                            color: const Color(0xFF4A0E13),
                                          ),
                                          maxLines: 1, overflow: TextOverflow.ellipsis,
                                        ),
                                        const SizedBox(height: 2),
                                        Text(
                                          'Staff: ${order['staff_name'] ?? '—'}',
                                          style: GoogleFonts.poppins(
                                            fontSize: 11,
                                            color: const Color(0xFF4A0E13).withValues(alpha: 0.5),
                                          ),
                                        ),
                                      ],
                                    ),
                                  ),
                                  Container(
                                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                                    decoration: BoxDecoration(
                                      color: statusColor.withValues(alpha: 0.12),
                                      borderRadius: BorderRadius.circular(20),
                                    ),
                                    child: Text(
                                      status.toUpperCase(),
                                      style: GoogleFonts.poppins(
                                        fontWeight: FontWeight.w800,
                                        fontSize: 10,
                                        color: statusColor,
                                        letterSpacing: 1,
                                      ),
                                    ),
                                  ),
                                ],
                              ),
                            ),

                            // Details
                            Padding(
                              padding: const EdgeInsets.fromLTRB(20, 12, 20, 0),
                              child: Column(
                                children: [
                                  _buildDetailRow(Icons.calendar_today_rounded, 
                                    eventDate != null ? DateFormat('EEEE, MMM d, yyyy').format(eventDate) : '—'),
                                  const SizedBox(height: 8),
                                  _buildDetailRow(Icons.access_time_rounded,
                                    eventTimeStr != null ? eventTimeStr : (eventDate != null ? DateFormat('h:mm a').format(eventDate) : '—')),
                                  const SizedBox(height: 8),
                                  _buildDetailRow(Icons.people_alt_rounded, '$memberCount Guests'),
                                  if (totalAmount != null) ...[
                                    const SizedBox(height: 8),
                                    _buildDetailRow(Icons.currency_rupee_rounded, '₹${num.tryParse(totalAmount.toString())?.toStringAsFixed(0) ?? totalAmount}'),
                                  ],
                                ],
                              ),
                            ),

                            // Rejection reason
                            if (status == 'rejected' && rejectionReason != null && rejectionReason.isNotEmpty)
                              Container(
                                margin: const EdgeInsets.fromLTRB(20, 12, 20, 0),
                                padding: const EdgeInsets.all(12),
                                decoration: BoxDecoration(
                                  color: Colors.red.withValues(alpha: 0.05),
                                  borderRadius: BorderRadius.circular(12),
                                  border: Border.all(color: Colors.red.withValues(alpha: 0.1)),
                                ),
                                child: Row(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Icon(Icons.info_outline_rounded, size: 16, color: Colors.red.withValues(alpha: 0.6)),
                                    const SizedBox(width: 8),
                                    Expanded(
                                      child: Column(
                                        crossAxisAlignment: CrossAxisAlignment.start,
                                        children: [
                                          Text(
                                            'Reason for Rejection',
                                            style: GoogleFonts.poppins(
                                              fontSize: 10,
                                              fontWeight: FontWeight.w700,
                                              color: Colors.red.withValues(alpha: 0.7),
                                              letterSpacing: 0.5,
                                            ),
                                          ),
                                          const SizedBox(height: 2),
                                          Text(
                                            rejectionReason,
                                            style: GoogleFonts.poppins(
                                              fontSize: 12,
                                              color: const Color(0xFF4A0E13).withValues(alpha: 0.7),
                                            ),
                                          ),
                                        ],
                                      ),
                                    ),
                                  ],
                                ),
                              ),

                            // Items
                            if (items.isNotEmpty) ...[
                              Padding(
                                padding: const EdgeInsets.fromLTRB(20, 16, 20, 0),
                                child: Text(
                                  'Menu Selected',
                                  style: GoogleFonts.poppins(
                                    fontWeight: FontWeight.w600,
                                    fontSize: 13,
                                    color: const Color(0xFF4A0E13).withValues(alpha: 0.7),
                                  ),
                                ),
                              ),
                              const SizedBox(height: 8),
                              ...items.map((item) {
                                final itemName = item['item_name'] ?? item['food_name'] ?? 'Unknown';
                                final qty = item['quantity'] ?? 1;
                                return Padding(
                                  padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 2),
                                  child: Row(
                                    children: [
                                      Container(
                                        width: 6, height: 6,
                                        decoration: BoxDecoration(
                                          color: const Color(0xFF8B1C28).withValues(alpha: 0.4),
                                          shape: BoxShape.circle,
                                        ),
                                      ),
                                      const SizedBox(width: 10),
                                      Expanded(
                                        child: Text(
                                          '${qty}x $itemName',
                                          style: GoogleFonts.poppins(
                                            color: const Color(0xFF4A0E13).withValues(alpha: 0.7),
                                            fontSize: 13,
                                          ),
                                        ),
                                      ),
                                    ],
                                  ),
                                );
                              }),
                            ],

                            // Cancel button
                            if (status == 'pending' || status == 'upcoming')
                              Padding(
                                padding: const EdgeInsets.fromLTRB(20, 16, 20, 16),
                                child: GestureDetector(
                                  onTap: () {
                                    showDialog(
                                      context: context,
                                      builder: (c) => AlertDialog(
                                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                                        title: Text('Cancel Request', style: GoogleFonts.poppins(fontWeight: FontWeight.w700)),
                                        content: Text('Are you sure you want to cancel this catering request?', style: GoogleFonts.poppins()),
                                        actions: [
                                          TextButton(
                                            onPressed: () => Navigator.pop(c),
                                            child: Text('No', style: GoogleFonts.poppins(fontWeight: FontWeight.w600)),
                                          ),
                                          TextButton(
                                            onPressed: () {
                                              Navigator.pop(c);
                                              _cancelOrder(order['id']);
                                            },
                                            child: Text('Yes, Cancel', style: GoogleFonts.poppins(color: Colors.red, fontWeight: FontWeight.w600)),
                                          ),
                                        ],
                                      ),
                                    );
                                  },
                                  child: Align(
                                    alignment: Alignment.centerRight,
                                    child: Container(
                                      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                                      decoration: BoxDecoration(
                                        color: Colors.red.withValues(alpha: 0.06),
                                        borderRadius: BorderRadius.circular(12),
                                      ),
                                      child: Text(
                                        'Cancel Request',
                                        style: GoogleFonts.poppins(
                                          fontWeight: FontWeight.w600,
                                          color: Colors.red,
                                          fontSize: 13,
                                        ),
                                      ),
                                    ),
                                  ),
                                ),
                              )
                            else
                              const SizedBox(height: 16),
                          ],
                        ),
                      ).animate().fadeIn(delay: Duration(milliseconds: 80 * index)).slideY(begin: 0.08, end: 0);
                    },
                  ),
                ),
    );
  }

  Widget _buildDetailRow(IconData icon, String text) {
    return Row(
      children: [
        Icon(icon, size: 15, color: const Color(0xFF8B1C28).withValues(alpha: 0.5)),
        const SizedBox(width: 10),
        Expanded(
          child: Text(
            text,
            style: GoogleFonts.poppins(
              color: const Color(0xFF4A0E13).withValues(alpha: 0.75),
              fontSize: 13,
              fontWeight: FontWeight.w500,
            ),
          ),
        ),
      ],
    );
  }

  // ignore: unused_element
  num? _tryParseNum(dynamic value) {
    if (value == null) return null;
    if (value is num) return value;
    return num.tryParse(value.toString());
  }
}
