import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:intl/intl.dart';
import '../services/staff_service.dart';
import '../widgets/spoon_loader.dart';
import '../utils/custom_toast.dart';
import 'new_pre_order_screen.dart';

class StaffPreOrderScreen extends StatefulWidget {
  const StaffPreOrderScreen({super.key});

  @override
  State<StaffPreOrderScreen> createState() => _StaffPreOrderScreenState();
}

class _StaffPreOrderScreenState extends State<StaffPreOrderScreen> {
  final StaffService _staffService = StaffService();
  bool _isLoading = true;
  List<dynamic> _preOrders = [];

  @override
  void initState() {
    super.initState();
    _fetchPreOrders();
  }

  Future<void> _fetchPreOrders() async {
    setState(() => _isLoading = true);
    try {
      final orders = await _staffService.getMyPreOrders();
      setState(() {
        _preOrders = orders;
        _isLoading = false;
      });
    } catch (e) {
      setState(() => _isLoading = false);
      CustomToast.showErrorToast(context, 'Failed to list pre-orders');
    }
  }

  void _cancelOrder(String orderId) async {
    try {
      await _staffService.cancelPreOrder(orderId);
      CustomToast.showSuccessToast(context, 'Pre-order cancelled successfully');
      _fetchPreOrders();
    } catch (e) {
      CustomToast.showErrorToast(context, e.toString().replaceAll('Exception: ', ''));
    }
  }

  Color _getStatusColor(String status) {
    if (status == 'pending') return const Color(0xFFF57C00);
    if (status == 'approved') return const Color(0xFF388E3C);
    if (status == 'fulfilled') return const Color(0xFF1976D2);
    if (status == 'cancelled' || status == 'rejected') return const Color(0xFFD32F2F);
    return Colors.grey;
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
          'My Daily Pre-Orders',
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
            MaterialPageRoute(builder: (_) => const NewPreOrderScreen()),
          );
          if (result == true) {
            _fetchPreOrders();
          }
        },
        icon: const Icon(Icons.add_rounded, color: Colors.white),
        label: Text(
          'New Pre-Order',
          style: GoogleFonts.poppins(color: Colors.white, fontWeight: FontWeight.bold),
        ),
      ),
      body: _isLoading
          ? Center(child: SpoonLoader(size: 50))
          : _preOrders.isEmpty
              ? Center(
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Icon(Icons.calendar_month_rounded, size: 80, color: const Color(0xFF8B1C28).withValues(alpha: 0.2)),
                      const SizedBox(height: 16),
                      Text(
                        'No pre-orders found.',
                        style: GoogleFonts.poppins(
                          fontSize: 16,
                          fontWeight: FontWeight.w600,
                          color: const Color(0xFF4A0E13).withValues(alpha: 0.5),
                        ),
                      ),
                    ],
                  ).animate().fadeIn(),
                )
              : RefreshIndicator(
                  color: const Color(0xFF8B1C28),
                  onRefresh: _fetchPreOrders,
                  child: ListView.builder(
                    padding: const EdgeInsets.all(24),
                    itemCount: _preOrders.length,
                    itemBuilder: (context, index) {
                      final order = _preOrders[index];
                      final rawDate = order['order_date'] ?? order['created_at'];
                      final date = rawDate != null ? DateTime.parse(rawDate.toString()).toLocal() : DateTime.now();
                      final dateStr = DateFormat('EEE, MMM d, yyyy').format(date);
                      final total = (double.tryParse(order['total_amount'].toString()) ?? 0).toStringAsFixed(2);
                      final restaurantName = order['restaurant_name']?.toString() ?? 'Restaurant';
                      
                      return Container(
                        margin: const EdgeInsets.only(bottom: 16),
                        padding: const EdgeInsets.all(16),
                        decoration: BoxDecoration(
                          color: Colors.white,
                          borderRadius: BorderRadius.circular(20),
                          boxShadow: [
                            BoxShadow(
                              color: const Color(0xFF8B1C28).withValues(alpha: 0.05),
                              blurRadius: 10,
                              offset: const Offset(0, 5),
                            )
                          ],
                        ),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Row(
                              mainAxisAlignment: MainAxisAlignment.spaceBetween,
                              children: [
                                Expanded(
                                  child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      Text(
                                        restaurantName,
                                        style: GoogleFonts.poppins(
                                          fontWeight: FontWeight.w700,
                                          fontSize: 16,
                                          color: const Color(0xFF4A0E13),
                                        ),
                                      ),
                                      Text(
                                        dateStr,
                                        style: GoogleFonts.poppins(
                                          fontSize: 12,
                                          color: const Color(0xFF4A0E13).withValues(alpha: 0.55),
                                        ),
                                      ),
                                    ],
                                  ),
                                ),
                                Container(
                                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                                  decoration: BoxDecoration(
                                    color: _getStatusColor(order['status']).withValues(alpha: 0.1),
                                    borderRadius: BorderRadius.circular(12),
                                  ),
                                  child: Text(
                                    order['status'].toString().toUpperCase(),
                                    style: GoogleFonts.poppins(
                                      fontWeight: FontWeight.w700,
                                      fontSize: 10,
                                      color: _getStatusColor(order['status']),
                                    ),
                                  ),
                                ),
                              ],
                            ),
                            const SizedBox(height: 12),
                            ...List.generate(order['items'].length, (i) {
                               final item = order['items'][i];
                               return Padding(
                                 padding: const EdgeInsets.only(bottom: 4),
                                 child: Row(
                                   mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                   children: [
                                     Expanded(
                                       child: Text(
                                         '${item['quantity']}x ${item['item_name'] ?? 'Item'}',
                                         style: GoogleFonts.poppins(
                                           color: const Color(0xFF4A0E13).withValues(alpha: 0.8),
                                           fontSize: 14,
                                         ),
                                       ),
                                     ),
                                     Text(
                                       '₹${item['price_at_time']}',
                                       style: GoogleFonts.poppins(
                                         fontWeight: FontWeight.w600,
                                         color: const Color(0xFF4A0E13),
                                       ),
                                     ),
                                   ],
                                 ),
                               );
                            }),
                            const Divider(height: 24),
                            Row(
                              mainAxisAlignment: MainAxisAlignment.spaceBetween,
                              children: [
                                Text(
                                  'Total: ₹$total',
                                  style: GoogleFonts.poppins(
                                    fontWeight: FontWeight.w800,
                                    fontSize: 16,
                                    color: const Color(0xFF4A0E13),
                                  ),
                                ),
                                if (order['status'] == 'pending')
                                  GestureDetector(
                                    onTap: () {
                                      showDialog(
                                        context: context,
                                        builder: (c) => AlertDialog(
                                          title: const Text('Cancel Pre-Order'),
                                          content: const Text('Are you sure you want to cancel this order?'),
                                          actions: [
                                            TextButton(
                                              onPressed: () => Navigator.pop(c),
                                              child: const Text('No'),
                                            ),
                                            TextButton(
                                              onPressed: () {
                                                Navigator.pop(c);
                                                _cancelOrder(order['id']);
                                              },
                                              child: const Text('Yes, Cancel', style: TextStyle(color: Colors.red)),
                                            ),
                                          ],
                                        )
                                      );
                                    },
                                    child: Text(
                                      'Cancel Order',
                                      style: GoogleFonts.poppins(
                                        fontWeight: FontWeight.w600,
                                        color: Colors.red,
                                        fontSize: 14,
                                      ),
                                    ),
                                  ),
                              ],
                            )
                          ],
                        ),
                      ).animate().fadeIn(delay: Duration(milliseconds: 100 * index)).slideY(begin: 0.1, end: 0);
                    },
                  ),
                ),
    );
  }
}
