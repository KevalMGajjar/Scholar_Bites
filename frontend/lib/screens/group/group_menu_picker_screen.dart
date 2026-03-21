import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:cached_network_image/cached_network_image.dart';
import '../../services/group_service.dart';
import '../../services/menu_service.dart';
import '../../models/food_item.dart';
import '../../utils/custom_toast.dart';
import '../../utils/token_storage.dart';
import '../../widgets/spoon_loader.dart';

class GroupMenuPickerScreen extends StatefulWidget {
  final String groupCode;

  const GroupMenuPickerScreen({super.key, required this.groupCode});

  @override
  State<GroupMenuPickerScreen> createState() => _GroupMenuPickerScreenState();
}

class _GroupMenuPickerScreenState extends State<GroupMenuPickerScreen> {
  static const _maroon = Color(0xFF8B1C28);
  static const _darkText = Color(0xFF4A0E13);
  static const _bg = Color(0xFFFCF9F5);

  final _menuService = MenuService();
  final _groupService = GroupService();
  final _searchController = TextEditingController();

  List<FoodItem> _allItems = [];
  List<FoodItem> _filtered = [];
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    _loadMenu();
    _searchController.addListener(_onSearch);
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  Future<void> _loadMenu() async {
    try {
      final universityId = await TokenStorage.getUniversityId();
      if (universityId == null || !mounted) return;
      final items = await _menuService.getMenuItems(universityId);
      if (!mounted) return;
      setState(() {
        // Keep all items but sort available ones first
        _allItems = items
          ..sort((a, b) => (b.actuallyAvailable ? 1 : 0).compareTo(a.actuallyAvailable ? 1 : 0));
        _filtered = _allItems;
        _isLoading = false;
      });
    } catch (e) {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  void _onSearch() {
    final query = _searchController.text.toLowerCase().trim();
    setState(() {
      if (query.isEmpty) {
        _filtered = _allItems;
      } else {
        _filtered = _allItems
            .where((item) =>
                item.name.toLowerCase().contains(query) ||
                item.category.toLowerCase().contains(query))
            .toList();
      }
    });
  }

  Future<void> _addItem(FoodItem item) async {
    try {
      await _groupService.addItem(widget.groupCode, item.id, 1);
      if (mounted) {
        CustomToast.showSuccessToast(context, '${item.name} added to pile!');
        Navigator.pop(context);
      }
    } catch (e) {
      if (mounted) CustomToast.showErrorToast(context, 'Failed to add item');
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: _bg,
      resizeToAvoidBottomInset: true,
      body: SafeArea(
        child: Column(
          children: [
            // ─── Header ───
            Padding(
              padding: const EdgeInsets.fromLTRB(8, 8, 20, 0),
              child: Row(
                children: [
                  IconButton(
                    icon: const Icon(Icons.arrow_back_ios_rounded, color: _darkText, size: 22),
                    onPressed: () => Navigator.pop(context),
                  ),
                  Expanded(
                    child: Text(
                      'Add to Group Pile',
                      style: GoogleFonts.poppins(fontSize: 20, fontWeight: FontWeight.w800, color: _darkText),
                    ),
                  ),
                ],
              ),
            ),

            const SizedBox(height: 12),

            // ─── Search Bar ───
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 20),
              child: Container(
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(18),
                  border: Border.all(color: _maroon.withValues(alpha: 0.1)),
                  boxShadow: [
                    BoxShadow(color: _maroon.withValues(alpha: 0.05), blurRadius: 16, offset: const Offset(0, 4)),
                  ],
                ),
                child: TextField(
                  controller: _searchController,
                  style: GoogleFonts.poppins(fontSize: 15, fontWeight: FontWeight.w500, color: _darkText),
                  decoration: InputDecoration(
                    hintText: 'Search food items...',
                    hintStyle: GoogleFonts.poppins(color: _darkText.withValues(alpha: 0.3)),
                    prefixIcon: Icon(Icons.search_rounded, color: _maroon.withValues(alpha: 0.5)),
                    suffixIcon: _searchController.text.isNotEmpty
                        ? IconButton(
                            icon: Icon(Icons.close_rounded, color: _darkText.withValues(alpha: 0.4), size: 20),
                            onPressed: () {
                              _searchController.clear();
                            },
                          )
                        : null,
                    border: InputBorder.none,
                    contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                  ),
                ),
              ),
            ).animate().fadeIn(duration: 300.ms),

            const SizedBox(height: 16),

            // ─── Trending Label ───
            if (_searchController.text.isEmpty)
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 24),
                child: Row(
                  children: [
                    const Icon(Icons.local_fire_department_rounded, size: 18, color: Colors.orange),
                    const SizedBox(width: 6),
                    Text(
                      'Trending Items',
                      style: GoogleFonts.poppins(fontSize: 16, fontWeight: FontWeight.w800, color: _darkText),
                    ),
                  ],
                ),
              ).animate().fadeIn(delay: 200.ms),

            const SizedBox(height: 8),

            // ─── Food Grid ───
            Expanded(
              child: _isLoading
                  ? Center(child: SpoonLoader(size: 50))
                  : _filtered.isEmpty
                      ? Center(
                          child: Column(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              const Icon(Icons.restaurant_menu_rounded, size: 48, color: _maroon),
                              const SizedBox(height: 8),
                              Text('No items found', style: GoogleFonts.poppins(color: _darkText.withValues(alpha: 0.4), fontWeight: FontWeight.w600)),
                            ],
                          ),
                        )
                      : ListView.builder(
                          padding: const EdgeInsets.symmetric(horizontal: 16),
                          itemCount: _filtered.length,
                          itemBuilder: (_, i) {
                            final item = _filtered[i];
                            return _buildFoodCard(item, i);
                          },
                        ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildFoodCard(FoodItem item, int index) {
    final isAvailable = item.actuallyAvailable;

    return GestureDetector(
      onTap: isAvailable ? () => _addItem(item) : null,
      child: Opacity(
        opacity: isAvailable ? 1.0 : 0.5,
        child: Container(
          margin: const EdgeInsets.only(bottom: 12),
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(
            color: isAvailable ? Colors.white : Colors.grey.shade100,
            borderRadius: BorderRadius.circular(18),
            border: Border.all(color: isAvailable ? _maroon.withValues(alpha: 0.06) : Colors.grey.shade300),
            boxShadow: isAvailable
                ? [BoxShadow(color: _maroon.withValues(alpha: 0.04), blurRadius: 12, offset: const Offset(0, 4))]
                : [],
          ),
          child: Row(
            children: [
              // Food image in circular dish style
              Container(
                width: 60,
                height: 60,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  border: Border.all(
                    color: isAvailable ? _getDishColor(index) : Colors.grey.shade400,
                    width: 3,
                  ),
                  boxShadow: isAvailable
                      ? [BoxShadow(color: _getDishColor(index).withValues(alpha: 0.2), blurRadius: 8, offset: const Offset(0, 3))]
                      : [],
                ),
                child: ClipOval(
                  child: item.imageUrl.isNotEmpty
                      ? CachedNetworkImage(
                          imageUrl: item.imageUrl,
                          fit: BoxFit.cover,
                          placeholder: (_, __) => Container(color: Colors.grey[100], child: Center(child: SpoonLoader(size: 20))),
                          errorWidget: (_, __, ___) => Container(color: Colors.grey[100], child: const Icon(Icons.fastfood_rounded, color: Colors.grey)),
                        )
                      : Container(color: Colors.grey[100], child: const Icon(Icons.fastfood_rounded, color: Colors.grey)),
                ),
              ),

              const SizedBox(width: 14),

              // Item details
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      item.name,
                      style: GoogleFonts.poppins(fontWeight: FontWeight.w700, fontSize: 15, color: isAvailable ? _darkText : Colors.grey),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                    const SizedBox(height: 2),
                    Row(
                      children: [
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 1),
                          decoration: BoxDecoration(
                            color: isAvailable ? _maroon.withValues(alpha: 0.08) : Colors.grey.shade200,
                            borderRadius: BorderRadius.circular(6),
                          ),
                          child: Text(
                            item.category,
                            style: GoogleFonts.poppins(fontSize: 10, fontWeight: FontWeight.w600, color: isAvailable ? _maroon : Colors.grey),
                          ),
                        ),
                        const SizedBox(width: 6),
                        Text(
                          '${item.calories} cal',
                          style: GoogleFonts.poppins(fontSize: 11, color: _darkText.withValues(alpha: 0.4)),
                        ),
                      ],
                    ),
                  ],
                ),
              ),

              // Price + Add button or Unavailable chip
              Column(
                children: [
                  Text(
                    '₹${item.price.toStringAsFixed(0)}',
                    style: GoogleFonts.poppins(fontWeight: FontWeight.w900, fontSize: 16, color: isAvailable ? _maroon : Colors.grey),
                  ),
                  const SizedBox(height: 4),
                  if (isAvailable)
                    Container(
                      padding: const EdgeInsets.all(6),
                      decoration: BoxDecoration(
                        color: _maroon,
                        borderRadius: BorderRadius.circular(10),
                      ),
                      child: const Icon(Icons.add_rounded, color: Colors.white, size: 18),
                    )
                  else
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                      decoration: BoxDecoration(
                        color: Colors.grey.shade300,
                        borderRadius: BorderRadius.circular(10),
                      ),
                      child: Text(
                        'Closed',
                        style: GoogleFonts.poppins(fontSize: 9, fontWeight: FontWeight.w700, color: Colors.grey.shade600),
                      ),
                    ),
                ],
              ),
            ],
          ),
        ),
      ),
    ).animate().fadeIn(delay: Duration(milliseconds: 50 * index), duration: 300.ms).slideX(begin: 0.05);
  }

  Color _getDishColor(int index) {
    const colors = [
      Color(0xFF4285F4), // Blue
      Color(0xFFC8E02A), // Lime green
      Color(0xFFFFB800), // Gold
      Color(0xFFE91E63), // Pink
      Color(0xFF9C27B0), // Purple
      Color(0xFF00BCD4), // Cyan
      Color(0xFFFF5722), // Deep orange
      Color(0xFF4CAF50), // Green
    ];
    return colors[index % colors.length];
  }
}
