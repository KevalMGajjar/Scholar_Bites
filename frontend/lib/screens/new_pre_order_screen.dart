import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:intl/intl.dart';
import '../services/staff_service.dart';
import '../services/menu_service.dart';
import '../utils/token_storage.dart';
import '../utils/custom_toast.dart';
import '../widgets/spoon_loader.dart';
import '../widgets/primary_button.dart';
import '../models/food_item.dart';

class NewPreOrderScreen extends StatefulWidget {
  const NewPreOrderScreen({super.key});

  @override
  State<NewPreOrderScreen> createState() => _NewPreOrderScreenState();
}

class _NewPreOrderScreenState extends State<NewPreOrderScreen> {
  final StaffService _staffService = StaffService();
  bool _isLoading = true;
  bool _isPaying = false;
  List<FoodItem> _menuItems = [];
  Map<String, int> _cart = {}; // foodId -> quantity
  DateTime? _selectedDate;
  
  @override
  void initState() {
    super.initState();
    _fetchMenu();
  }

  Future<void> _fetchMenu() async {
    try {
      final uniId = await TokenStorage.getUniversityId();
      if (uniId != null) {
        final items = await MenuService().getMenuItems(uniId);
        setState(() {
          _menuItems = items;
          _isLoading = false;
        });
      }
    } catch (e) {
      setState(() => _isLoading = false);
    }
  }

  void _selectDate() async {
    final now = DateTime.now();
    final firstDate = DateTime(now.year, now.month, now.day + 1); // Tomorrow at earliest
    final picked = await showDatePicker(
      context: context,
      initialDate: firstDate,
      firstDate: firstDate,
      lastDate: DateTime(now.year, now.month + 1, now.day), 
      builder: (context, child) {
         return Theme(
           data: ThemeData.light().copyWith(
             colorScheme: const ColorScheme.light(
               primary: Color(0xFF8B1C28),
               onPrimary: Colors.white,
               onSurface: Color(0xFF4A0E13),
             ),
           ),
           child: child!,
         );
      }
    );
    if (picked != null) {
      setState(() => _selectedDate = picked);
    }
  }

  double get _totalAmount {
    double total = 0;
    _cart.forEach((id, qty) {
      final item = _menuItems.firstWhere((e) => e.id == id);
      total += item.price * qty;
    });
    return total;
  }

  void _placeOrder() async {
    if (_selectedDate == null) {
      CustomToast.showErrorToast(context, 'Please select a target date for your pre-order');
      return;
    }
    if (_cart.isEmpty) {
      CustomToast.showErrorToast(context, 'Please add items to your pre-order');
      return;
    }

    setState(() => _isPaying = true);

    final itemsList = _cart.entries.map((e) {
      final item = _menuItems.firstWhere((m) => m.id == e.key);
      return {
        'food_id': item.id,
        'quantity': e.value,
        'price': item.price,
      };
    }).toList();

    try {
      await _staffService.createPreOrder(
        items: itemsList,
        targetDate: _selectedDate!.toIso8601String(),
        notes: '',
      );
      
      if (mounted) {
        setState(() => _isPaying = false);
        CustomToast.showSuccessToast(context, 'Pre-Order created! Balance deducted.');
        Navigator.pop(context, true);
      }
    } catch (e) {
      setState(() => _isPaying = false);
      CustomToast.showErrorToast(context, e.toString().replaceAll('Exception: ', ''));
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
          'New Daily Pre-Order',
          style: GoogleFonts.poppins(
            color: const Color(0xFF4A0E13),
            fontSize: 20,
            fontWeight: FontWeight.w700,
          ),
        ),
      ),
      bottomNavigationBar: SafeArea(
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 16),
          decoration: BoxDecoration(
            color: Colors.white,
            boxShadow: [
              BoxShadow(
                color: Colors.black.withValues(alpha: 0.05),
                blurRadius: 20,
                offset: const Offset(0, -5),
              )
            ],
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(
                    'Total (${_cart.values.fold(0, (a, b) => a + b)} items):',
                    style: GoogleFonts.poppins(
                      fontWeight: FontWeight.w600,
                      color: const Color(0xFF4A0E13).withValues(alpha: 0.6),
                    ),
                  ),
                  Text(
                    '₹${_totalAmount.toStringAsFixed(2)}',
                    style: GoogleFonts.poppins(
                      fontWeight: FontWeight.w800,
                      fontSize: 24,
                      color: const Color(0xFF8B1C28),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 16),
              _isPaying
                  ? Center(child: SpoonLoader(size: 50))
                  : PrimaryButton(
                      text: 'Place Pre-Order',
                      onTap: _placeOrder,
                    ),
            ],
          ),
        ),
      ),
      body: _isLoading
          ? Center(child: SpoonLoader(size: 50))
          : SingleChildScrollView(
              padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Target Date
                  Text(
                    'Target Date',
                    style: GoogleFonts.poppins(
                      fontSize: 18,
                      fontWeight: FontWeight.bold,
                      color: const Color(0xFF4A0E13),
                    ),
                  ),
                  const SizedBox(height: 12),
                  GestureDetector(
                    onTap: _selectDate,
                    child: Container(
                      padding: const EdgeInsets.all(16),
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(16),
                        border: Border.all(color: const Color(0xFF8B1C28).withValues(alpha: 0.2)),
                      ),
                      child: Row(
                        children: [
                          const Icon(Icons.calendar_month_rounded, color: Color(0xFF8B1C28)),
                          const SizedBox(width: 12),
                          Text(
                            _selectedDate == null 
                                ? 'Select delivery date (Tomorrow+)'
                                : DateFormat('EEEE, MMMM d, yyyy').format(_selectedDate!),
                            style: GoogleFonts.poppins(
                              color: _selectedDate == null ? Colors.grey : const Color(0xFF4A0E13),
                              fontWeight: _selectedDate == null ? FontWeight.normal : FontWeight.w600,
                              fontSize: 16,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                  const SizedBox(height: 32),
                  
                  // Menu
                  Text(
                    'Menu',
                    style: GoogleFonts.poppins(
                      fontSize: 18,
                      fontWeight: FontWeight.bold,
                      color: const Color(0xFF4A0E13),
                    ),
                  ),
                  const SizedBox(height: 16),
                  
                  ..._menuItems.map((item) {
                     final qty = _cart[item.id] ?? 0;
                     return Container(
                       margin: const EdgeInsets.only(bottom: 12),
                       padding: const EdgeInsets.all(12),
                       decoration: BoxDecoration(
                         color: Colors.white,
                         borderRadius: BorderRadius.circular(16),
                       ),
                       child: Row(
                         children: [
                           Container(
                             width: 60,
                             height: 60,
                             decoration: BoxDecoration(
                               borderRadius: BorderRadius.circular(12),
                               image: DecorationImage(
                                 image: NetworkImage(item.imageUrl),
                                 fit: BoxFit.cover,
                               ),
                             ),
                           ),
                           const SizedBox(width: 16),
                           Expanded(
                             child: Column(
                               crossAxisAlignment: CrossAxisAlignment.start,
                               children: [
                                 Text(
                                   item.name,
                                   style: GoogleFonts.poppins(
                                     fontWeight: FontWeight.w700,
                                     color: const Color(0xFF4A0E13),
                                   ),
                                   maxLines: 1,
                                   overflow: TextOverflow.ellipsis,
                                 ),
                                 Text(
                                   '₹${item.price}',
                                   style: GoogleFonts.poppins(
                                     fontWeight: FontWeight.w600,
                                     color: const Color(0xFF8B1C28),
                                   ),
                                 ),
                               ],
                             ),
                           ),
                           // Quantity selector
                           Row(
                             children: [
                               if (qty > 0)
                                 GestureDetector(
                                   onTap: () {
                                     setState(() {
                                       _cart[item.id] = qty - 1;
                                       if (_cart[item.id] == 0) _cart.remove(item.id);
                                     });
                                   },
                                   child: Container(
                                     padding: const EdgeInsets.all(4),
                                     decoration: const BoxDecoration(
                                       color: Color(0xFFFDF0F0),
                                       shape: BoxShape.circle,
                                     ),
                                     child: const Icon(Icons.remove, size: 16, color: Color(0xFF8B1C28)),
                                   ),
                                 ),
                               if (qty > 0)
                                 Padding(
                                   padding: const EdgeInsets.symmetric(horizontal: 12),
                                   child: Text(
                                     qty.toString(),
                                     style: GoogleFonts.poppins(
                                       fontWeight: FontWeight.bold,
                                       fontSize: 16,
                                     ),
                                   ),
                                 ),
                               GestureDetector(
                                 onTap: () {
                                   setState(() {
                                     _cart[item.id] = qty + 1;
                                   });
                                 },
                                 child: Container(
                                   padding: const EdgeInsets.all(4),
                                   decoration: const BoxDecoration(
                                     color: Color(0xFF8B1C28),
                                     shape: BoxShape.circle,
                                   ),
                                   child: const Icon(Icons.add, size: 16, color: Colors.white),
                                 ),
                               ),
                             ],
                           )
                         ],
                       ),
                     );
                  }),
                ],
              ),
            ),
    );
  }
}
