import 'package:flutter/material.dart';

/// Filter data model to pass between screens
class SearchFilters {
  final String category;
  final String sortBy; // 'relevance', 'price_low', 'price_high', 'calories'
  final double? maxPrice;
  final bool vegOnly;

  const SearchFilters({
    this.category = 'All',
    this.sortBy = 'relevance',
    this.maxPrice,
    this.vegOnly = false,
  });

  bool get hasActiveFilters =>
      category != 'All' || sortBy != 'relevance' || maxPrice != null || vegOnly;

  SearchFilters copyWith({
    String? category,
    String? sortBy,
    double? maxPrice,
    bool? vegOnly,
    bool clearMaxPrice = false,
  }) {
    return SearchFilters(
      category: category ?? this.category,
      sortBy: sortBy ?? this.sortBy,
      maxPrice: clearMaxPrice ? null : (maxPrice ?? this.maxPrice),
      vegOnly: vegOnly ?? this.vegOnly,
    );
  }
}

/// A stylish glassmorphic filter bottom sheet
class FilterBottomSheet extends StatefulWidget {
  final SearchFilters currentFilters;
  final List<String> categories;

  const FilterBottomSheet({
    super.key,
    required this.currentFilters,
    required this.categories,
  });

  @override
  State<FilterBottomSheet> createState() => _FilterBottomSheetState();
}

class _FilterBottomSheetState extends State<FilterBottomSheet> {
  late String _selectedCategory;
  late String _selectedSort;
  late double _maxPrice;
  late bool _vegOnly;
  bool _hasPriceFilter = false;

  static const _maroon = Color(0xFF8B1C28);
  static const _darkText = Color(0xFF4A0E13);

  final List<Map<String, dynamic>> _sortOptions = [
    {'value': 'relevance', 'label': 'Relevance', 'icon': Icons.auto_awesome_rounded},
    {'value': 'price_low', 'label': 'Price: Low to High', 'icon': Icons.arrow_upward_rounded},
    {'value': 'price_high', 'label': 'Price: High to Low', 'icon': Icons.arrow_downward_rounded},
    {'value': 'calories', 'label': 'Lowest Calories', 'icon': Icons.local_fire_department_rounded},
  ];

  @override
  void initState() {
    super.initState();
    _selectedCategory = widget.currentFilters.category;
    _selectedSort = widget.currentFilters.sortBy;
    _maxPrice = widget.currentFilters.maxPrice ?? 500;
    _hasPriceFilter = widget.currentFilters.maxPrice != null;
    _vegOnly = widget.currentFilters.vegOnly;
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: const BoxDecoration(
        color: Color(0xFFFDF0F0),
        borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          // Handle bar
          Center(
            child: Container(
              margin: const EdgeInsets.only(top: 12),
              width: 40,
              height: 4,
              decoration: BoxDecoration(
                color: _maroon.withValues(alpha: 0.2),
                borderRadius: BorderRadius.circular(2),
              ),
            ),
          ),

          // Title row
          Padding(
            padding: const EdgeInsets.fromLTRB(24, 20, 24, 4),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Text(
                  'Filters',
                  style: TextStyle(
                    fontSize: 24,
                    fontWeight: FontWeight.w800,
                    color: _darkText,
                  ),
                ),
                TextButton(
                  onPressed: () {
                    setState(() {
                      _selectedCategory = 'All';
                      _selectedSort = 'relevance';
                      _maxPrice = 500;
                      _hasPriceFilter = false;
                      _vegOnly = false;
                    });
                  },
                  child: Text(
                    'Reset All',
                    style: TextStyle(
                      color: _maroon.withValues(alpha: 0.7),
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ),
              ],
            ),
          ),

          Flexible(
            child: SingleChildScrollView(
              padding: const EdgeInsets.symmetric(horizontal: 24),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const SizedBox(height: 16),

                  // --- CATEGORY ---
                  _buildSectionTitle('Category'),
                  const SizedBox(height: 12),
                  Wrap(
                    spacing: 10,
                    runSpacing: 10,
                    children: widget.categories.map((cat) {
                      final isSelected = cat == _selectedCategory;
                      return GestureDetector(
                        onTap: () => setState(() => _selectedCategory = cat),
                        child: AnimatedContainer(
                          duration: const Duration(milliseconds: 200),
                          padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 10),
                          decoration: BoxDecoration(
                            color: isSelected ? _maroon : Colors.white,
                            borderRadius: BorderRadius.circular(20),
                            border: Border.all(
                              color: isSelected ? _maroon : _maroon.withValues(alpha: 0.15),
                              width: 1.5,
                            ),
                            boxShadow: isSelected
                                ? [
                                    BoxShadow(
                                      color: _maroon.withValues(alpha: 0.25),
                                      blurRadius: 8,
                                      offset: const Offset(0, 3),
                                    )
                                  ]
                                : null,
                          ),
                          child: Text(
                            cat,
                            style: TextStyle(
                              color: isSelected ? Colors.white : _darkText,
                              fontWeight: isSelected ? FontWeight.w700 : FontWeight.w500,
                              fontSize: 14,
                            ),
                          ),
                        ),
                      );
                    }).toList(),
                  ),

                  const SizedBox(height: 28),

                  // --- SORT BY ---
                  _buildSectionTitle('Sort By'),
                  const SizedBox(height: 12),
                  ...List.generate(_sortOptions.length, (index) {
                    final option = _sortOptions[index];
                    final isSelected = option['value'] == _selectedSort;
                    return GestureDetector(
                      onTap: () => setState(() => _selectedSort = option['value']),
                      child: AnimatedContainer(
                        duration: const Duration(milliseconds: 200),
                        margin: const EdgeInsets.only(bottom: 8),
                        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                        decoration: BoxDecoration(
                          color: isSelected ? _maroon.withValues(alpha: 0.08) : Colors.white,
                          borderRadius: BorderRadius.circular(16),
                          border: Border.all(
                            color: isSelected ? _maroon : Colors.grey.withValues(alpha: 0.15),
                            width: isSelected ? 1.5 : 1,
                          ),
                        ),
                        child: Row(
                          children: [
                            Icon(
                              option['icon'] as IconData,
                              color: isSelected ? _maroon : _darkText.withValues(alpha: 0.5),
                              size: 20,
                            ),
                            const SizedBox(width: 14),
                            Text(
                              option['label'] as String,
                              style: TextStyle(
                                color: isSelected ? _maroon : _darkText,
                                fontWeight: isSelected ? FontWeight.w700 : FontWeight.w500,
                                fontSize: 15,
                              ),
                            ),
                            const Spacer(),
                            if (isSelected)
                              Container(
                                width: 22,
                                height: 22,
                                decoration: const BoxDecoration(
                                  color: _maroon,
                                  shape: BoxShape.circle,
                                ),
                                child: const Icon(Icons.check, color: Colors.white, size: 14),
                              ),
                          ],
                        ),
                      ),
                    );
                  }),

                  const SizedBox(height: 20),

                  // --- PRICE RANGE ---
                  Row(
                    children: [
                      _buildSectionTitle('Max Price'),
                      const Spacer(),
                      Switch(
                        value: _hasPriceFilter,
                        onChanged: (v) => setState(() => _hasPriceFilter = v),
                        activeThumbColor: _maroon,
                      ),
                    ],
                  ),
                  if (_hasPriceFilter) ...[
                    const SizedBox(height: 8),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text(
                          '\u{20B9}50',
                          style: TextStyle(
                            color: _darkText.withValues(alpha: 0.5),
                            fontSize: 13,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                        Text(
                          '\u{20B9}${_maxPrice.toInt()}',
                          style: const TextStyle(
                            color: _maroon,
                            fontSize: 18,
                            fontWeight: FontWeight.w800,
                          ),
                        ),
                        Text(
                          '\u{20B9}500',
                          style: TextStyle(
                            color: _darkText.withValues(alpha: 0.5),
                            fontSize: 13,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ],
                    ),
                    SliderTheme(
                      data: SliderThemeData(
                        activeTrackColor: _maroon,
                        inactiveTrackColor: _maroon.withValues(alpha: 0.15),
                        thumbColor: _maroon,
                        overlayColor: _maroon.withValues(alpha: 0.1),
                        trackHeight: 4,
                      ),
                      child: Slider(
                        value: _maxPrice,
                        min: 50,
                        max: 500,
                        divisions: 18,
                        onChanged: (v) => setState(() => _maxPrice = v),
                      ),
                    ),
                  ],

                  const SizedBox(height: 16),

                  // --- VEG ONLY ---
                  GestureDetector(
                    onTap: () => setState(() => _vegOnly = !_vegOnly),
                    child: AnimatedContainer(
                      duration: const Duration(milliseconds: 200),
                      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                      decoration: BoxDecoration(
                        color: _vegOnly ? Colors.green.withValues(alpha: 0.08) : Colors.white,
                        borderRadius: BorderRadius.circular(16),
                        border: Border.all(
                          color: _vegOnly ? Colors.green : Colors.grey.withValues(alpha: 0.15),
                          width: _vegOnly ? 1.5 : 1,
                        ),
                      ),
                      child: Row(
                        children: [
                          Icon(
                            Icons.eco_rounded,
                            color: _vegOnly ? Colors.green : _darkText.withValues(alpha: 0.5),
                            size: 20,
                          ),
                          const SizedBox(width: 14),
                          Text(
                            'Veg Only',
                            style: TextStyle(
                              color: _vegOnly ? Colors.green.shade800 : _darkText,
                              fontWeight: _vegOnly ? FontWeight.w700 : FontWeight.w500,
                              fontSize: 15,
                            ),
                          ),
                          const Spacer(),
                          if (_vegOnly)
                            Container(
                              width: 22,
                              height: 22,
                              decoration: const BoxDecoration(
                                color: Colors.green,
                                shape: BoxShape.circle,
                              ),
                              child: const Icon(Icons.check, color: Colors.white, size: 14),
                            ),
                        ],
                      ),
                    ),
                  ),

                  const SizedBox(height: 28),
                ],
              ),
            ),
          ),

          // --- APPLY BUTTON ---
          Container(
            padding: const EdgeInsets.fromLTRB(24, 12, 24, 24),
            decoration: BoxDecoration(
              color: Colors.white,
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withValues(alpha: 0.05),
                  blurRadius: 10,
                  offset: const Offset(0, -4),
                ),
              ],
            ),
            child: SizedBox(
              width: double.infinity,
              height: 54,
              child: ElevatedButton(
                onPressed: () {
                  Navigator.pop(
                    context,
                    SearchFilters(
                      category: _selectedCategory,
                      sortBy: _selectedSort,
                      maxPrice: _hasPriceFilter ? _maxPrice : null,
                      vegOnly: _vegOnly,
                    ),
                  );
                },
                style: ElevatedButton.styleFrom(
                  backgroundColor: _maroon,
                  foregroundColor: Colors.white,
                  elevation: 6,
                  shadowColor: _maroon.withValues(alpha: 0.4),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(22),
                  ),
                ),
                child: const Text(
                  'Apply Filters',
                  style: TextStyle(
                    fontSize: 17,
                    fontWeight: FontWeight.w800,
                    letterSpacing: 0.5,
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildSectionTitle(String title) {
    return Text(
      title,
      style: const TextStyle(
        fontSize: 16,
        fontWeight: FontWeight.w700,
        color: _darkText,
      ),
    );
  }
}
