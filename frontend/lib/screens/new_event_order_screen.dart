import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:intl/intl.dart';
import '../services/staff_service.dart';
import '../utils/token_storage.dart';
import '../utils/custom_toast.dart';
import '../widgets/spoon_loader.dart';
import '../widgets/primary_button.dart';

class NewEventOrderScreen extends StatefulWidget {
  const NewEventOrderScreen({super.key});

  @override
  State<NewEventOrderScreen> createState() => _NewEventOrderScreenState();
}

class _NewEventOrderScreenState extends State<NewEventOrderScreen> {
  final StaffService _staffService = StaffService();
  bool _isLoading = true;
  bool _isSubmitting = false;
  
  List<dynamic> _menuItems = [];
  Map<String, int> _cart = {}; 

  final TextEditingController _eventNameController = TextEditingController();
  final TextEditingController _guestsController = TextEditingController();
  DateTime? _selectedDate;
  TimeOfDay? _selectedTime;

  @override
  void initState() {
    super.initState();
    _fetchEventMenu();
  }

  Future<void> _fetchEventMenu() async {
    try {
      final uniId = await TokenStorage.getUniversityId();
      if (uniId != null) {
        final items = await _staffService.getEventMenu(uniId);
        setState(() {
          _menuItems = items;
          _isLoading = false;
        });
      }
    } catch (e) {
      setState(() => _isLoading = false);
    }
  }

  void _selectDateTime() async {
    final now = DateTime.now();
    final firstDate = DateTime(now.year, now.month, now.day + 7); // Requires 1 week notice 
    
    final pickedDate = await showDatePicker(
      context: context,
      initialDate: firstDate,
      firstDate: firstDate,
      lastDate: DateTime(now.year + 1, now.month, now.day),
    );
    
    if (pickedDate != null) {
      final pickedTime = await showTimePicker(
        context: context,
        initialTime: const TimeOfDay(hour: 12, minute: 0),
      );
      
      if (pickedTime != null) {
        setState(() {
          _selectedDate = pickedDate;
          _selectedTime = pickedTime;
        });
      }
    }
  }

  void _submitRequest() async {
    if (_eventNameController.text.trim().isEmpty) {
      CustomToast.showErrorToast(context, 'Please enter an event name');
      return;
    }
    if (_guestsController.text.trim().isEmpty || int.tryParse(_guestsController.text) == null) {
      CustomToast.showErrorToast(context, 'Please enter a valid number of guests');
      return;
    }
    if (_selectedDate == null || _selectedTime == null) {
      CustomToast.showErrorToast(context, 'Please select date and time for catering');
      return;
    }
    if (_cart.isEmpty) {
      CustomToast.showErrorToast(context, 'Please add items to your menu');
      return;
    }

    setState(() => _isSubmitting = true);

    final eventDateTime = DateTime(
      _selectedDate!.year, _selectedDate!.month, _selectedDate!.day,
      _selectedTime!.hour, _selectedTime!.minute,
    );

    final itemsList = _cart.entries.map((e) {
      final item = _menuItems.firstWhere((m) => m['id'] == e.key);
      return {
        'food_id': item['id'],
        'quantity': e.value,
        'price': item['price'],
      };
    }).toList();

    try {
      await _staffService.createEventOrder(
        eventName: _eventNameController.text.trim(),
        cateringTime: eventDateTime.toIso8601String(),
        expectedGuests: int.parse(_guestsController.text),
        items: itemsList,
      );
      
      if (mounted) {
        setState(() => _isSubmitting = false);
        CustomToast.showSuccessToast(context, 'Catering request submitted for admin review!');
        Navigator.pop(context, true);
      }
    } catch (e) {
      setState(() => _isSubmitting = false);
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
          'Request Catering',
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
            boxShadow: [BoxShadow(color: Colors.black.withValues(alpha: 0.05), blurRadius: 20, offset: const Offset(0, -5))],
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              _isSubmitting
                  ? Center(child: SpoonLoader(size: 50))
                  : PrimaryButton(
                      text: 'Submit Request',
                      onTap: _submitRequest,
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
                  // Event Details
                  Text('Event Details', style: GoogleFonts.poppins(fontSize: 18, fontWeight: FontWeight.bold, color: const Color(0xFF4A0E13))),
                  const SizedBox(height: 16),
                  
                  TextField(
                    controller: _eventNameController,
                    decoration: InputDecoration(
                      labelText: 'Event Name',
                      filled: true,
                      fillColor: Colors.white,
                      border: OutlineInputBorder(borderRadius: BorderRadius.circular(16), borderSide: BorderSide.none),
                      prefixIcon: const Icon(Icons.event_rounded, color: Color(0xFF8B1C28)),
                    ),
                  ),
                  const SizedBox(height: 12),
                  
                  TextField(
                    controller: _guestsController,
                    keyboardType: TextInputType.number,
                    decoration: InputDecoration(
                      labelText: 'Expected Guests',
                      filled: true,
                      fillColor: Colors.white,
                      border: OutlineInputBorder(borderRadius: BorderRadius.circular(16), borderSide: BorderSide.none),
                      prefixIcon: const Icon(Icons.people_alt_rounded, color: Color(0xFF8B1C28)),
                    ),
                  ),
                  const SizedBox(height: 12),

                  GestureDetector(
                    onTap: _selectDateTime,
                    child: Container(
                      padding: const EdgeInsets.all(16),
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(16),
                      ),
                      child: Row(
                        children: [
                          const Icon(Icons.access_time_rounded, color: Color(0xFF8B1C28)),
                          const SizedBox(width: 12),
                          Text(
                            _selectedDate == null || _selectedTime == null
                                ? 'Select Date & Time (7 days notice)'
                                : '${DateFormat('MMM d, yyyy').format(_selectedDate!)} at ${_selectedTime!.format(context)}',
                            style: GoogleFonts.poppins(
                              color: _selectedDate == null ? Colors.grey[600] : const Color(0xFF4A0E13),
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
                  Text('Catering Menu', style: GoogleFonts.poppins(fontSize: 18, fontWeight: FontWeight.bold, color: const Color(0xFF4A0E13))),
                  const SizedBox(height: 16),
                  
                  if (_menuItems.isEmpty)
                     const Text('No catering menu available.', style: TextStyle(color: Colors.grey))
                  else
                    ..._menuItems.map((item) {
                       final qty = _cart[item['id']] ?? 0;
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
                               width: 60, height: 60,
                               decoration: BoxDecoration(
                                 borderRadius: BorderRadius.circular(12),
                                 image: DecorationImage(image: NetworkImage(item['image_url']), fit: BoxFit.cover),
                               ),
                             ),
                             const SizedBox(width: 16),
                             Expanded(
                               child: Column(
                                 crossAxisAlignment: CrossAxisAlignment.start,
                                 children: [
                                   Text(item['name'], style: GoogleFonts.poppins(fontWeight: FontWeight.w700, color: const Color(0xFF4A0E13)), maxLines: 1),
                                   Text('₹${item['price']}', style: GoogleFonts.poppins(fontWeight: FontWeight.w600, color: const Color(0xFF8B1C28))),
                                 ],
                               ),
                             ),
                             Row(
                               children: [
                                 if (qty > 0)
                                   GestureDetector(
                                     onTap: () {
                                       setState(() {
                                         _cart[item['id']] = qty - 1;
                                         if (_cart[item['id']] == 0) _cart.remove(item['id']);
                                       });
                                     },
                                     child: Container(padding: const EdgeInsets.all(4), decoration: const BoxDecoration(color: Color(0xFFFDF0F0), shape: BoxShape.circle), child: const Icon(Icons.remove, size: 16, color: Color(0xFF8B1C28))),
                                   ),
                                 if (qty > 0)
                                   Padding(
                                     padding: const EdgeInsets.symmetric(horizontal: 12),
                                     child: Text(qty.toString(), style: GoogleFonts.poppins(fontWeight: FontWeight.bold, fontSize: 16)),
                                   ),
                                 GestureDetector(
                                   onTap: () => setState(() => _cart[item['id']] = qty + 1),
                                   child: Container(padding: const EdgeInsets.all(4), decoration: const BoxDecoration(color: Color(0xFF8B1C28), shape: BoxShape.circle), child: const Icon(Icons.add, size: 16, color: Colors.white)),
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
