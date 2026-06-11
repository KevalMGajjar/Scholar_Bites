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
  final Map<String, int> _cart = {};
  final Set<String> _collapsedCategories = {};

  final TextEditingController _eventNameController = TextEditingController();
  final TextEditingController _guestsController = TextEditingController();
  final TextEditingController _staffNameController = TextEditingController();
  final TextEditingController _staffEmailController = TextEditingController();
  final TextEditingController _customOrderController = TextEditingController();
  DateTime? _selectedDate;
  TimeOfDay? _selectedTime;

  @override
  void initState() {
    super.initState();
    _fetchEventMenu();
  }

  @override
  void dispose() {
    _eventNameController.dispose();
    _guestsController.dispose();
    _staffNameController.dispose();
    _staffEmailController.dispose();
    _customOrderController.dispose();
    super.dispose();
  }

  Future<void> _fetchEventMenu() async {
    try {
      final uniId = await TokenStorage.getUniversityId();
      if (uniId != null) {
        final items = await _staffService.getEventMenu(uniId);
        setState(() { _menuItems = items; _isLoading = false; });
      }
    } catch (e) {
      setState(() => _isLoading = false);
    }
  }

  Map<String, List<dynamic>> get _groupedItems {
    final Map<String, List<dynamic>> groups = {};
    for (final item in _menuItems) {
      final cat = (item['category_name'] ?? item['category'] ?? 'Other') as String;
      groups.putIfAbsent(cat, () => []).add(item);
    }
    return groups;
  }

  double _itemPrice(dynamic item) {
    return item['price'] is num
        ? (item['price'] as num).toDouble()
        : double.tryParse(item['price'].toString()) ?? 0.0;
  }

  double get _cartTotal {
    double total = 0;
    for (final entry in _cart.entries) {
      final item = _menuItems.cast<dynamic?>().firstWhere((m) => m['id'] == entry.key, orElse: () => null);
      if (item != null) total += _itemPrice(item) * entry.value;
    }
    return total;
  }

  int get _cartItemCount => _cart.values.fold(0, (a, b) => a + b);
  bool get _hasCustomOrder => _customOrderController.text.trim().isNotEmpty;
  bool get _canConfirm => _cart.isNotEmpty || _hasCustomOrder;

  void _selectDateTime() async {
    final now = DateTime.now();
    // Same-day ordering allowed; the required lead time is enforced server-side per item.
    final firstDate = DateTime(now.year, now.month, now.day);
    final pickedDate = await showDatePicker(context: context, initialDate: firstDate, firstDate: firstDate, lastDate: DateTime(now.year + 1, now.month, now.day));
    if (pickedDate != null) {
      final pickedTime = await showTimePicker(context: context, initialTime: const TimeOfDay(hour: 12, minute: 0));
      if (pickedTime != null) setState(() { _selectedDate = pickedDate; _selectedTime = pickedTime; });
    }
  }

  bool _validateForm() {
    if (_eventNameController.text.trim().isEmpty) { CustomToast.showErrorToast(context, 'Please enter an event name'); return false; }
    if (_guestsController.text.trim().isEmpty || int.tryParse(_guestsController.text) == null) { CustomToast.showErrorToast(context, 'Please enter valid guest count'); return false; }
    if (_staffNameController.text.trim().isEmpty) { CustomToast.showErrorToast(context, 'Please enter staff name'); return false; }
    if (_staffEmailController.text.trim().isEmpty || !_staffEmailController.text.contains('@')) { CustomToast.showErrorToast(context, 'Please enter a valid staff email'); return false; }
    if (_selectedDate == null || _selectedTime == null) { CustomToast.showErrorToast(context, 'Please select date and time'); return false; }
    if (_cart.isEmpty && !_hasCustomOrder) { CustomToast.showErrorToast(context, 'Please add menu items or describe a custom order'); return false; }
    return true;
  }

  void _showConfirmation() {
    if (!_validateForm()) return;
    showModalBottomSheet(context: context, isScrollControlled: true, backgroundColor: Colors.transparent, builder: (_) => _buildConfirmationSheet());
  }

  void _submitOrder() async {
    Navigator.pop(context); // close popup
    setState(() => _isSubmitting = true);
    final itemsList = _cart.entries.map((e) {
      final item = _menuItems.firstWhere((m) => m['id'] == e.key);
      return { 'menu_item_id': item['id'], 'quantity': e.value, 'price': item['price'] };
    }).toList();
    try {
      await _staffService.createEventOrder(
        eventName: _eventNameController.text.trim(),
        eventDate: _selectedDate!.toIso8601String().split('T')[0],
        eventTime: '${_selectedTime!.hour.toString().padLeft(2, '0')}:${_selectedTime!.minute.toString().padLeft(2, '0')}',
        memberCount: int.parse(_guestsController.text),
        staffName: _staffNameController.text.trim(),
        staffEmail: _staffEmailController.text.trim(),
        items: itemsList,
        specialRequirements: _customOrderController.text.trim(),
      );
      if (mounted) { setState(() => _isSubmitting = false); CustomToast.showSuccessToast(context, 'Catering request submitted!'); Navigator.pop(context, true); }
    } catch (e) { setState(() => _isSubmitting = false); CustomToast.showErrorToast(context, e.toString().replaceAll('Exception: ', '')); }
  }

  // ── PLACEHOLDER: build, _buildConfirmationSheet, UI widgets below ──
  // Phase 2 will replace from here down

  Widget _buildConfirmationSheet() {
    final cartEntries = _cart.entries.map((e) {
      final item = _menuItems.firstWhere((m) => m['id'] == e.key);
      return {'item': item, 'qty': e.value, 'lineTotal': _itemPrice(item) * e.value};
    }).toList();

    return DraggableScrollableSheet(
      initialChildSize: 0.75, maxChildSize: 0.9, minChildSize: 0.5,
      builder: (_, sc) => Container(
        decoration: const BoxDecoration(color: Colors.white, borderRadius: BorderRadius.vertical(top: Radius.circular(28))),
        child: Column(children: [
          // Handle
          Container(margin: const EdgeInsets.only(top: 12), width: 40, height: 4, decoration: BoxDecoration(color: Colors.grey[300], borderRadius: BorderRadius.circular(2))),
          Padding(padding: const EdgeInsets.all(20),
            child: Text('Order Summary', style: GoogleFonts.poppins(fontSize: 20, fontWeight: FontWeight.w700, color: const Color(0xFF4A0E13)))),
          // Event info
          Padding(padding: const EdgeInsets.symmetric(horizontal: 20),
            child: Container(padding: const EdgeInsets.all(16), decoration: BoxDecoration(color: const Color(0xFFFDF0F0), borderRadius: BorderRadius.circular(16)),
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                _infoRow('Event', _eventNameController.text),
                _infoRow('Date', _selectedDate != null ? DateFormat('MMM d, yyyy').format(_selectedDate!) : ''),
                _infoRow('Time', _selectedTime?.format(context) ?? ''),
                _infoRow('Guests', _guestsController.text),
                _infoRow('Staff', _staffNameController.text),
              ]))),
          const SizedBox(height: 12),
          // Items list (+ custom order)
          Expanded(child: ListView(controller: sc, padding: const EdgeInsets.symmetric(horizontal: 20), children: [
            ...cartEntries.map((e) {
              final item = e['item'] as Map;
              return Padding(padding: const EdgeInsets.only(bottom: 8),
                child: Row(children: [
                  _vegDot(item['is_veg'] != false),
                  const SizedBox(width: 8),
                  Expanded(child: Text('${item['name']}', style: GoogleFonts.poppins(fontWeight: FontWeight.w600, fontSize: 14, color: const Color(0xFF4A0E13)))),
                  Text('x${e['qty']}', style: GoogleFonts.poppins(color: Colors.grey[600], fontSize: 13)),
                  const SizedBox(width: 16),
                  Text('Rs ${(e['lineTotal'] as double).toStringAsFixed(0)}', style: GoogleFonts.poppins(fontWeight: FontWeight.w700, fontSize: 14, color: const Color(0xFF8B1C28))),
                ]));
            }),
            if (_hasCustomOrder)
              Container(
                margin: const EdgeInsets.only(top: 4, bottom: 8),
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(color: const Color(0xFFFFF3E0), borderRadius: BorderRadius.circular(14), border: Border.all(color: const Color(0xFFE65100).withValues(alpha: 0.25))),
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Row(children: [
                    const Icon(Icons.edit_note_rounded, size: 16, color: Color(0xFFE65100)),
                    const SizedBox(width: 6),
                    Text('Custom Order', style: GoogleFonts.poppins(fontSize: 12, fontWeight: FontWeight.w700, color: const Color(0xFFE65100))),
                  ]),
                  const SizedBox(height: 6),
                  Text(_customOrderController.text.trim(), style: GoogleFonts.poppins(fontSize: 13, color: const Color(0xFF4A0E13), height: 1.4)),
                ]),
              ),
          ])),
          // Total + confirm button
          Container(padding: const EdgeInsets.all(20), decoration: BoxDecoration(color: Colors.white, boxShadow: [BoxShadow(color: Colors.black.withValues(alpha: 0.05), blurRadius: 20, offset: const Offset(0, -5))]),
            child: SafeArea(child: Column(mainAxisSize: MainAxisSize.min, children: [
              Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
                Text('Total', style: GoogleFonts.poppins(fontSize: 18, fontWeight: FontWeight.w700, color: const Color(0xFF4A0E13))),
                Text(_cart.isEmpty ? 'Quote on review' : 'Rs ${_cartTotal.toStringAsFixed(0)}', style: GoogleFonts.poppins(fontSize: _cart.isEmpty ? 15 : 22, fontWeight: FontWeight.w800, color: const Color(0xFF8B1C28))),
              ]),
              const SizedBox(height: 12),
              SizedBox(width: double.infinity, child: PrimaryButton(text: _cart.isEmpty ? 'Submit Request' : 'Confirm Payment', onTap: _submitOrder)),
            ]))),
        ]),
      ),
    );
  }

  // Veg / Non-Veg marker — identical to the indicator used on normal food items.
  Widget _vegDot(bool isVeg) {
    final color = isVeg ? const Color(0xFF2E7D32) : const Color(0xFFD32F2F);
    return Container(
      width: 14,
      height: 14,
      decoration: BoxDecoration(
        border: Border.all(color: color, width: 1.5),
        borderRadius: BorderRadius.circular(3),
      ),
      child: Center(
        child: Container(width: 6, height: 6, decoration: BoxDecoration(color: color, shape: BoxShape.circle)),
      ),
    );
  }

  Widget _infoRow(String label, String value) {
    return Padding(padding: const EdgeInsets.only(bottom: 4),
      child: Row(children: [
        SizedBox(width: 70, child: Text(label, style: GoogleFonts.poppins(fontSize: 12, fontWeight: FontWeight.w500, color: Colors.grey[600]))),
        Expanded(child: Text(value, style: GoogleFonts.poppins(fontSize: 13, fontWeight: FontWeight.w600, color: const Color(0xFF4A0E13)))),
      ]));
  }

  @override
  Widget build(BuildContext context) {
    final groups = _groupedItems;
    return Scaffold(
      backgroundColor: const Color(0xFFFDF0F0),
      appBar: AppBar(
        backgroundColor: Colors.transparent, elevation: 0, centerTitle: true,
        leading: IconButton(icon: const Icon(Icons.arrow_back_ios_rounded, color: Color(0xFF4A0E13)), onPressed: () => Navigator.pop(context)),
        title: Text('Request Catering', style: GoogleFonts.poppins(color: const Color(0xFF4A0E13), fontSize: 20, fontWeight: FontWeight.w700)),
      ),
      bottomNavigationBar: SafeArea(
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
          decoration: BoxDecoration(color: Colors.white, boxShadow: [BoxShadow(color: Colors.black.withValues(alpha: 0.05), blurRadius: 20, offset: const Offset(0, -5))]),
          child: _isSubmitting
              ? Center(child: SpoonLoader(size: 50))
              : Column(mainAxisSize: MainAxisSize.min, children: [
                  // Running total
                  if (_cart.isNotEmpty) ...[
                    Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
                      Text('${_cartItemCount} item${_cartItemCount == 1 ? '' : 's'} selected', style: GoogleFonts.poppins(fontSize: 13, fontWeight: FontWeight.w500, color: Colors.grey[600])),
                      Text('Rs ${_cartTotal.toStringAsFixed(0)}', style: GoogleFonts.poppins(fontSize: 20, fontWeight: FontWeight.w800, color: const Color(0xFF8B1C28))),
                    ]),
                    const SizedBox(height: 10),
                  ] else if (_hasCustomOrder) ...[
                    Row(children: [
                      const Icon(Icons.edit_note_rounded, size: 18, color: Color(0xFF8B1C28)),
                      const SizedBox(width: 6),
                      Text('Custom order ready', style: GoogleFonts.poppins(fontSize: 13, fontWeight: FontWeight.w600, color: const Color(0xFF8B1C28))),
                    ]),
                    const SizedBox(height: 10),
                  ],
                  PrimaryButton(text: _canConfirm ? 'Confirm Selection' : 'Select Items', onTap: _canConfirm ? _showConfirmation : () {}),
                ]),
        ),
      ),
      body: _isLoading
          ? Center(child: SpoonLoader(size: 50))
          : SingleChildScrollView(
              padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 16),
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                // Event Details
                Text('Event Details', style: GoogleFonts.poppins(fontSize: 18, fontWeight: FontWeight.bold, color: const Color(0xFF4A0E13))),
                const SizedBox(height: 16),
                _buildTextField(_eventNameController, 'Event Name', Icons.event_rounded),
                const SizedBox(height: 12),
                _buildTextField(_guestsController, 'Expected Guests', Icons.people_alt_rounded, isNumber: true),
                const SizedBox(height: 12),
                _buildTextField(_staffNameController, 'Staff Name', Icons.person_rounded),
                const SizedBox(height: 12),
                _buildTextField(_staffEmailController, 'Staff Email', Icons.email_rounded, isEmail: true),
                const SizedBox(height: 12),
                GestureDetector(
                  onTap: _selectDateTime,
                  child: Container(padding: const EdgeInsets.all(16), decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(16)),
                    child: Row(children: [
                      const Icon(Icons.access_time_rounded, color: Color(0xFF8B1C28)),
                      const SizedBox(width: 12),
                      Text(
                        _selectedDate == null || _selectedTime == null
                            ? 'Select Event Date & Time'
                            : '${DateFormat('MMM d, yyyy').format(_selectedDate!)} at ${_selectedTime!.format(context)}',
                        style: GoogleFonts.poppins(color: _selectedDate == null ? Colors.grey[600] : const Color(0xFF4A0E13), fontWeight: _selectedDate == null ? FontWeight.normal : FontWeight.w600, fontSize: 16),
                      ),
                    ])),
                ),
                const SizedBox(height: 32),
                // Catering Menu
                Text('Catering Menu', style: GoogleFonts.poppins(fontSize: 18, fontWeight: FontWeight.bold, color: const Color(0xFF4A0E13))),
                const SizedBox(height: 16),
                if (_menuItems.isEmpty)
                  const Text('No catering menu available.', style: TextStyle(color: Colors.grey))
                else
                  ...groups.entries.map((entry) => _buildCategorySection(entry.key, entry.value)),
                const SizedBox(height: 28),
                // ── Custom Order ──
                Row(children: [
                  Text('Custom Order', style: GoogleFonts.poppins(fontSize: 18, fontWeight: FontWeight.bold, color: const Color(0xFF4A0E13))),
                  const SizedBox(width: 8),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                    decoration: BoxDecoration(color: const Color(0xFF8B1C28).withValues(alpha: 0.10), borderRadius: BorderRadius.circular(8)),
                    child: Text('Optional', style: GoogleFonts.poppins(fontSize: 10, fontWeight: FontWeight.w700, color: const Color(0xFF8B1C28))),
                  ),
                ]),
                const SizedBox(height: 4),
                Text(
                  'Need a tailor-made menu or have special requirements? Describe them here and our team will get in touch.',
                  style: GoogleFonts.poppins(fontSize: 12, color: Colors.grey[600], height: 1.4),
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: _customOrderController,
                  maxLines: 4,
                  onChanged: (_) => setState(() {}),
                  textCapitalization: TextCapitalization.sentences,
                  style: GoogleFonts.poppins(fontSize: 14, color: const Color(0xFF4A0E13)),
                  decoration: InputDecoration(
                    hintText: 'e.g. Jain meal (no onion/garlic), live counter, specific cuisine, allergy notes, plating preferences…',
                    hintStyle: GoogleFonts.poppins(fontSize: 13, color: Colors.grey[400]),
                    filled: true,
                    fillColor: Colors.white,
                    contentPadding: const EdgeInsets.all(16),
                    border: OutlineInputBorder(borderRadius: BorderRadius.circular(16), borderSide: BorderSide.none),
                    prefixIcon: const Padding(
                      padding: EdgeInsets.only(bottom: 48),
                      child: Icon(Icons.edit_note_rounded, color: Color(0xFF8B1C28)),
                    ),
                  ),
                ),
                const SizedBox(height: 80), // space for bottom bar
              ]),
            ),
    );
  }

  Widget _buildTextField(TextEditingController ctrl, String label, IconData icon, {bool isNumber = false, bool isEmail = false}) {
    return TextField(
      controller: ctrl,
      keyboardType: isNumber ? TextInputType.number : isEmail ? TextInputType.emailAddress : TextInputType.text,
      decoration: InputDecoration(
        labelText: label, filled: true, fillColor: Colors.white,
        border: OutlineInputBorder(borderRadius: BorderRadius.circular(16), borderSide: BorderSide.none),
        prefixIcon: Icon(icon, color: const Color(0xFF8B1C28)),
      ),
    );
  }

  Widget _buildCategorySection(String categoryName, List<dynamic> items) {
    final isCollapsed = _collapsedCategories.contains(categoryName);
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      GestureDetector(
        onTap: () => setState(() {
          if (isCollapsed) _collapsedCategories.remove(categoryName);
          else _collapsedCategories.add(categoryName);
        }),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
          margin: const EdgeInsets.only(bottom: 8),
          decoration: BoxDecoration(color: const Color(0xFF8B1C28).withValues(alpha: 0.08), borderRadius: BorderRadius.circular(14)),
          child: Row(children: [
            Icon(isCollapsed ? Icons.chevron_right_rounded : Icons.expand_more_rounded, color: const Color(0xFF8B1C28), size: 20),
            const SizedBox(width: 8),
            Text(categoryName, style: GoogleFonts.poppins(fontSize: 15, fontWeight: FontWeight.w700, color: const Color(0xFF4A0E13))),
            const Spacer(),
            Container(padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2), decoration: BoxDecoration(color: const Color(0xFF8B1C28).withValues(alpha: 0.12), borderRadius: BorderRadius.circular(8)),
              child: Text('${items.length}', style: GoogleFonts.poppins(fontSize: 11, fontWeight: FontWeight.w700, color: const Color(0xFF8B1C28)))),
          ]),
        ),
      ),
      if (!isCollapsed)
        ...items.map((item) {
          final qty = _cart[item['id']] ?? 0;
          return GestureDetector(
            onTap: () => _showItemDetails(item),
            child: Container(
            margin: const EdgeInsets.only(bottom: 10),
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(16)),
            child: Row(children: [
              if (item['image_url'] != null)
                Container(width: 56, height: 56, decoration: BoxDecoration(borderRadius: BorderRadius.circular(12), image: DecorationImage(image: NetworkImage(item['image_url']), fit: BoxFit.cover)))
              else
                Container(width: 56, height: 56, decoration: BoxDecoration(borderRadius: BorderRadius.circular(12), color: const Color(0xFFFDF0F0)),
                  child: const Icon(Icons.fastfood_rounded, color: Color(0xFF8B1C28), size: 24)),
              const SizedBox(width: 14),
              Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Row(children: [
                  _vegDot(item['is_veg'] != false),
                  const SizedBox(width: 6),
                  Expanded(child: Text(item['name'], style: GoogleFonts.poppins(fontWeight: FontWeight.w700, color: const Color(0xFF4A0E13), fontSize: 14), maxLines: 1, overflow: TextOverflow.ellipsis)),
                ]),
                if (item['description'] != null && item['description'].toString().isNotEmpty)
                  Text(item['description'], style: GoogleFonts.poppins(fontSize: 11, color: Colors.grey[500]), maxLines: 2, overflow: TextOverflow.ellipsis),
                Row(children: [
                  Text('Rs ${_itemPrice(item).toStringAsFixed(0)}', style: GoogleFonts.poppins(fontWeight: FontWeight.w600, color: const Color(0xFF8B1C28), fontSize: 14)),
                  const SizedBox(width: 8),
                  Icon(Icons.unfold_more_rounded, size: 13, color: Colors.grey[400]),
                  Text(' tap to view', style: GoogleFonts.poppins(fontSize: 10, color: Colors.grey[400], fontWeight: FontWeight.w500)),
                ]),
              ])),
              Row(mainAxisSize: MainAxisSize.min, children: [
                if (qty > 0) ...[
                  GestureDetector(
                    onTap: () => setState(() { _cart[item['id']] = qty - 1; if (_cart[item['id']] == 0) _cart.remove(item['id']); }),
                    child: Container(padding: const EdgeInsets.all(6), decoration: BoxDecoration(color: const Color(0xFFFDF0F0), shape: BoxShape.circle, border: Border.all(color: const Color(0xFF8B1C28).withValues(alpha: 0.2))),
                      child: const Icon(Icons.remove, size: 16, color: Color(0xFF8B1C28))),
                  ),
                  Padding(padding: const EdgeInsets.symmetric(horizontal: 14),
                    child: Text(qty.toString(), style: GoogleFonts.poppins(fontWeight: FontWeight.bold, fontSize: 16, color: const Color(0xFF4A0E13)))),
                ],
                GestureDetector(
                  onTap: () => setState(() => _cart[item['id']] = qty + 1),
                  child: Container(padding: const EdgeInsets.all(6), decoration: const BoxDecoration(color: Color(0xFF8B1C28), shape: BoxShape.circle),
                    child: const Icon(Icons.add, size: 16, color: Colors.white)),
                ),
              ]),
            ]),
          ),
          );
        }),
      const SizedBox(height: 8),
    ]);
  }

  void _showItemDetails(dynamic item) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) {
        return StatefulBuilder(
          builder: (ctx, setSheet) {
            final qty = _cart[item['id']] ?? 0;
            final desc = item['description']?.toString() ?? '';
            final category = (item['category_name'] ?? item['category'] ?? '').toString();
            void changeQty(int delta) {
              final current = _cart[item['id']] ?? 0;
              final next = current + delta;
              setState(() {
                if (next <= 0) {
                  _cart.remove(item['id']);
                } else {
                  _cart[item['id']] = next;
                }
              });
              setSheet(() {});
            }

            return Container(
              constraints: BoxConstraints(maxHeight: MediaQuery.of(context).size.height * 0.82),
              decoration: const BoxDecoration(color: Colors.white, borderRadius: BorderRadius.vertical(top: Radius.circular(28))),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Container(margin: const EdgeInsets.only(top: 12), width: 40, height: 4, decoration: BoxDecoration(color: Colors.grey[300], borderRadius: BorderRadius.circular(2))),
                  Flexible(
                    child: SingleChildScrollView(
                      padding: const EdgeInsets.fromLTRB(20, 20, 20, 16),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          if (item['image_url'] != null)
                            ClipRRect(
                              borderRadius: BorderRadius.circular(20),
                              child: Image.network(item['image_url'], height: 180, width: double.infinity, fit: BoxFit.cover,
                                errorBuilder: (_, __, ___) => Container(height: 180, color: const Color(0xFFFDF0F0), child: const Icon(Icons.fastfood_rounded, color: Color(0xFF8B1C28), size: 48))),
                            )
                          else
                            Container(height: 140, width: double.infinity, decoration: BoxDecoration(color: const Color(0xFFFDF0F0), borderRadius: BorderRadius.circular(20)),
                              child: const Icon(Icons.fastfood_rounded, color: Color(0xFF8B1C28), size: 48)),
                          const SizedBox(height: 18),
                          Row(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Padding(padding: const EdgeInsets.only(top: 4), child: _vegDot(item['is_veg'] != false)),
                              const SizedBox(width: 10),
                              Expanded(child: Text(item['name']?.toString() ?? 'Item', style: GoogleFonts.poppins(fontSize: 20, fontWeight: FontWeight.w800, color: const Color(0xFF4A0E13)))),
                            ],
                          ),
                          const SizedBox(height: 8),
                          Row(
                            children: [
                              Text('Rs ${_itemPrice(item).toStringAsFixed(0)}', style: GoogleFonts.poppins(fontSize: 18, fontWeight: FontWeight.w700, color: const Color(0xFF8B1C28))),
                              if (category.isNotEmpty) ...[
                                const SizedBox(width: 10),
                                Container(padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4), decoration: BoxDecoration(color: const Color(0xFF8B1C28).withValues(alpha: 0.08), borderRadius: BorderRadius.circular(8)),
                                  child: Text(category, style: GoogleFonts.poppins(fontSize: 11, fontWeight: FontWeight.w600, color: const Color(0xFF8B1C28)))),
                              ],
                            ],
                          ),
                          const SizedBox(height: 16),
                          Text('Details', style: GoogleFonts.poppins(fontSize: 13, fontWeight: FontWeight.w700, color: const Color(0xFF4A0E13))),
                          const SizedBox(height: 6),
                          Text(desc.isNotEmpty ? desc : 'No description provided for this item.',
                            style: GoogleFonts.poppins(fontSize: 14, color: const Color(0xFF4A0E13).withValues(alpha: 0.7), height: 1.5)),
                        ],
                      ),
                    ),
                  ),
                  Container(
                    padding: const EdgeInsets.all(20),
                    decoration: BoxDecoration(color: Colors.white, boxShadow: [BoxShadow(color: Colors.black.withValues(alpha: 0.05), blurRadius: 20, offset: const Offset(0, -5))]),
                    child: SafeArea(
                      top: false,
                      child: qty == 0
                          ? GestureDetector(
                              onTap: () => changeQty(1),
                              child: Container(
                                padding: const EdgeInsets.symmetric(vertical: 16),
                                decoration: BoxDecoration(color: const Color(0xFF8B1C28), borderRadius: BorderRadius.circular(16)),
                                child: Row(mainAxisAlignment: MainAxisAlignment.center, children: [
                                  const Icon(Icons.add, color: Colors.white, size: 20),
                                  const SizedBox(width: 8),
                                  Text('Add to Order', style: GoogleFonts.poppins(color: Colors.white, fontWeight: FontWeight.w700, fontSize: 15)),
                                ]),
                              ),
                            )
                          : Row(
                              children: [
                                Expanded(
                                  child: Row(
                                    mainAxisAlignment: MainAxisAlignment.center,
                                    children: [
                                      GestureDetector(onTap: () => changeQty(-1),
                                        child: Container(padding: const EdgeInsets.all(10), decoration: BoxDecoration(color: const Color(0xFFFDF0F0), shape: BoxShape.circle, border: Border.all(color: const Color(0xFF8B1C28).withValues(alpha: 0.2))),
                                          child: const Icon(Icons.remove, size: 18, color: Color(0xFF8B1C28)))),
                                      Padding(padding: const EdgeInsets.symmetric(horizontal: 20), child: Text('$qty', style: GoogleFonts.poppins(fontWeight: FontWeight.bold, fontSize: 18, color: const Color(0xFF4A0E13)))),
                                      GestureDetector(onTap: () => changeQty(1),
                                        child: Container(padding: const EdgeInsets.all(10), decoration: const BoxDecoration(color: Color(0xFF8B1C28), shape: BoxShape.circle),
                                          child: const Icon(Icons.add, size: 18, color: Colors.white))),
                                    ],
                                  ),
                                ),
                                const SizedBox(width: 12),
                                GestureDetector(
                                  onTap: () => Navigator.pop(ctx),
                                  child: Container(padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 14), decoration: BoxDecoration(color: const Color(0xFF8B1C28).withValues(alpha: 0.1), borderRadius: BorderRadius.circular(14)),
                                    child: Text('Done', style: GoogleFonts.poppins(color: const Color(0xFF8B1C28), fontWeight: FontWeight.w700, fontSize: 15))),
                                ),
                              ],
                            ),
                    ),
                  ),
                ],
              ),
            );
          },
        );
      },
    );
  }
}
