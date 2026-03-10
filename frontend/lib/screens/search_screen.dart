import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import '../models/food_item.dart';
import '../widgets/food_card.dart';
import '../widgets/filter_bottom_sheet.dart';
import 'package:provider/provider.dart';
import '../models/cart_model.dart';
import '../utils/animation_utils.dart';
import '../services/menu_service.dart';
import '../utils/token_storage.dart';
import 'cart_screen.dart';

class SearchScreen extends StatefulWidget {
  final String? initialQuery;
  final String? initialCategory;
  final SearchFilters? initialFilters;

  const SearchScreen({
    super.key,
    this.initialQuery,
    this.initialCategory,
    this.initialFilters,
  });

  @override
  State<SearchScreen> createState() => _SearchScreenState();
}

class _SearchScreenState extends State<SearchScreen> {
  final TextEditingController _searchController = TextEditingController();
  final ScrollController _scrollController = ScrollController();
  final GlobalKey _cartKey = GlobalKey();
  String _selectedCategory = 'All';
  late SearchFilters _filters;

  // Categories aligned with Home Screen Cravings
  final List<String> _categories = [
    'All',
    'Burger',
    'Healthy',
    'Coffee',
    'Snacks',
    'Drinks',
    'Pizza',
    'Desserts',
    'Chicken',
  ];

  // Loaded from API
  List<FoodItem> _allMeals = [];
  bool _isLoadingMeals = true;

  // Pagination
  static const int _pageSize = 8;
  int _currentPage = 0;
  List<FoodItem> _displayedMeals = [];
  List<FoodItem> _filteredMeals = [];
  bool _hasMore = true;

  @override
  void initState() {
    super.initState();
    _filters = widget.initialFilters ?? const SearchFilters();
    _searchController.text = widget.initialQuery ?? '';
    _selectedCategory = widget.initialCategory ?? _filters.category;

    _fetchMenuItems();
    _searchController.addListener(_filterResults);
    _scrollController.addListener(_onScroll);
  }

  Future<void> _fetchMenuItems() async {
    try {
      final uniId = await TokenStorage.getUniversityId();
      if (uniId != null) {
        final menuService = MenuService();
        final items = await menuService.getMenuItems(uniId);
        if (mounted) {
          setState(() {
            _allMeals = items;
            _isLoadingMeals = false;
          });
          _filterResults();
        }
      } else {
        if (mounted) setState(() => _isLoadingMeals = false);
      }
    } catch (e) {
      if (mounted) setState(() => _isLoadingMeals = false);
    }
  }

  @override
  void dispose() {
    _searchController.dispose();
    _scrollController.dispose();
    super.dispose();
  }

  void _onScroll() {
    if (_scrollController.position.pixels >=
            _scrollController.position.maxScrollExtent - 100 &&
        _hasMore) {
      _loadMore();
    }
  }

  void _filterResults() {
    final query = _searchController.text.toLowerCase();
    var results = _allMeals.where((meal) {
      final matchesQuery =
          query.isEmpty || meal.name.toLowerCase().contains(query);
      final matchesCategory =
          _selectedCategory == 'All' || meal.category == _selectedCategory;
      final matchesPrice =
          _filters.maxPrice == null || meal.price <= _filters.maxPrice!;
      // vegOnly filter: only items in Healthy category (simplified for dummy data)
      final matchesVeg = !_filters.vegOnly ||
          meal.category == 'Healthy' ||
          meal.name.toLowerCase().contains('veggie') ||
          meal.name.toLowerCase().contains('salad');
      return matchesQuery && matchesCategory && matchesPrice && matchesVeg;
    }).toList();

    // Apply sorting
    switch (_filters.sortBy) {
      case 'price_low':
        results.sort((a, b) => a.price.compareTo(b.price));
        break;
      case 'price_high':
        results.sort((a, b) => b.price.compareTo(a.price));
        break;
      case 'calories':
        results.sort((a, b) => a.calories.compareTo(b.calories));
        break;
      default:
        break; // relevance = default order
    }

    _filteredMeals = results;
    _currentPage = 0;
    _displayedMeals = _filteredMeals.take(_pageSize).toList();
    _hasMore = _displayedMeals.length < _filteredMeals.length;
    setState(() {});
  }

  void _loadMore() {
    _currentPage++;
    final start = _currentPage * _pageSize;
    final end = start + _pageSize;
    if (start < _filteredMeals.length) {
      setState(() {
        _displayedMeals.addAll(
          _filteredMeals.sublist(
            start,
            end > _filteredMeals.length ? _filteredMeals.length : end,
          ),
        );
        _hasMore = _displayedMeals.length < _filteredMeals.length;
      });
    }
  }

  void _showFilterPopup() async {
    final result = await showModalBottomSheet<SearchFilters>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (context) => DraggableScrollableSheet(
        initialChildSize: 0.75,
        maxChildSize: 0.92,
        minChildSize: 0.5,
        builder: (_, controller) => FilterBottomSheet(
          currentFilters: _filters.copyWith(category: _selectedCategory),
          categories: _categories,
        ),
      ),
    );
    if (result != null) {
      setState(() {
        _filters = result;
        _selectedCategory = result.category;
      });
      _filterResults();
    }
  }

  void _runAddToCartAnimation(GlobalKey widgetKey, String imageUrl) {
    AnimationUtils.runFlyAnimation(
      context,
      widgetKey,
      _cartKey,
      imageUrl,
    );
  }

  @override
  Widget build(BuildContext context) {
    final int activeFilterCount = (_filters.sortBy != 'relevance' ? 1 : 0) +
        (_filters.maxPrice != null ? 1 : 0) +
        (_filters.vegOnly ? 1 : 0);

    return Scaffold(
      backgroundColor: const Color(0xFFFCF9F5),
      body: SafeArea(
        child: Column(
          children: [
            // Search Header
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 14),
              decoration: BoxDecoration(
                color: Colors.white,
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withValues(alpha: 0.04),
                    blurRadius: 8,
                    offset: const Offset(0, 2),
                  ),
                ],
              ),
              child: Row(
                children: [
                  GestureDetector(
                    onTap: () => Navigator.pop(context),
                    child: Container(
                      padding: const EdgeInsets.all(10),
                      decoration: BoxDecoration(
                        color: const Color(0xFFFDF0F0),
                        borderRadius: BorderRadius.circular(14),
                      ),
                      child: const Icon(Icons.arrow_back_ios_new_rounded,
                          color: Color(0xFF8B1C28), size: 18),
                    ),
                  ),
                  const SizedBox(width: 14),
                  Expanded(
                    child: Container(
                      height: 50,
                      decoration: BoxDecoration(
                        color: const Color(0xFFFCF9F5),
                        borderRadius: BorderRadius.circular(22),
                        border: Border.all(
                            color: const Color(0xFFE5D5D5), width: 1.2),
                      ),
                      child: TextField(
                        controller: _searchController,
                        autofocus: widget.initialQuery != null &&
                            widget.initialQuery!.isNotEmpty,
                        style: const TextStyle(
                          fontSize: 15,
                          fontWeight: FontWeight.w600,
                          color: Color(0xFF4A0E13),
                        ),
                        decoration: InputDecoration(
                          hintText: 'Search for food...',
                          hintStyle: TextStyle(
                            color: const Color(0xFF8B1C28)
                                .withValues(alpha: 0.35),
                            fontWeight: FontWeight.w500,
                          ),
                          prefixIcon: Icon(Icons.search_rounded,
                              color: const Color(0xFF8B1C28)
                                  .withValues(alpha: 0.5)),
                          border: InputBorder.none,
                          contentPadding: const EdgeInsets.symmetric(
                              horizontal: 16, vertical: 14),
                          suffixIcon: _searchController.text.isNotEmpty
                              ? GestureDetector(
                                  onTap: () {
                                    _searchController.clear();
                                  },
                                  child: Icon(Icons.close_rounded,
                                      color: const Color(0xFF8B1C28)
                                          .withValues(alpha: 0.5)),
                                )
                              : null,
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(width: 10),
                  // Filter button
                  GestureDetector(
                    onTap: _showFilterPopup,
                    child: Stack(
                      clipBehavior: Clip.none,
                      children: [
                        Container(
                          width: 44,
                          height: 44,
                          decoration: BoxDecoration(
                            color: activeFilterCount > 0
                                ? const Color(0xFF8B1C28)
                                : const Color(0xFFFDF0F0),
                            borderRadius: BorderRadius.circular(14),
                            border: Border.all(
                              color: activeFilterCount > 0
                                  ? const Color(0xFF8B1C28)
                                  : const Color(0xFFE5D5D5),
                              width: 1.2,
                            ),
                          ),
                          child: Icon(
                            Icons.tune_rounded,
                            color: activeFilterCount > 0
                                ? Colors.white
                                : const Color(0xFF8B1C28),
                            size: 20,
                          ),
                        ),
                        if (activeFilterCount > 0)
                          Positioned(
                            top: -4,
                            right: -4,
                            child: Container(
                              width: 18,
                              height: 18,
                              decoration: const BoxDecoration(
                                color: Color(0xFFF4B3B3),
                                shape: BoxShape.circle,
                              ),
                              child: Center(
                                child: Text(
                                  '$activeFilterCount',
                                  style: const TextStyle(
                                    color: Color(0xFF8B1C28),
                                    fontSize: 10,
                                    fontWeight: FontWeight.w800,
                                  ),
                                ),
                              ),
                            ),
                          ),
                      ],
                    ),
                  ),
                  const SizedBox(width: 10),
                  // Cart button
                  Consumer<CartProvider>(
                    builder: (context, cart, child) => GestureDetector(
                      onTap: () {
                        Navigator.push(
                          context,
                          MaterialPageRoute(
                            builder: (context) => const CartScreen(),
                          ),
                        );
                      },
                      child: Stack(
                        clipBehavior: Clip.none,
                        children: [
                          Container(
                            key: _cartKey,
                            width: 44,
                            height: 44,
                            decoration: BoxDecoration(
                              color: const Color(0xFFFDF0F0),
                              borderRadius: BorderRadius.circular(14),
                              border: Border.all(
                                color: const Color(0xFFE5D5D5),
                                width: 1.2,
                              ),
                            ),
                            child: const Icon(
                              Icons.shopping_bag_outlined,
                              color: Color(0xFF8B1C28),
                              size: 20,
                            ),
                          ),
                          if (cart.itemCount > 0)
                            Positioned(
                              top: -4,
                              right: -4,
                              child: Container(
                                width: 18,
                                height: 18,
                                decoration: const BoxDecoration(
                                  color: Color(0xFF8B1C28),
                                  shape: BoxShape.circle,
                                ),
                                child: Center(
                                  child: Text(
                                    '${cart.itemCount}',
                                    style: const TextStyle(
                                      color: Colors.white,
                                      fontSize: 10,
                                      fontWeight: FontWeight.w800,
                                    ),
                                  ),
                                ),
                              ),
                            ),
                        ],
                      ),
                    ),
                  ),
                ],
              ),
            ),

            // Horizontal Category Filters
            Container(
              height: 56,
              decoration: BoxDecoration(
                color: Colors.white,
                border: Border(
                  bottom: BorderSide(
                    color: Colors.grey.withValues(alpha: 0.1),
                  ),
                ),
              ),
              child: ListView.builder(
                scrollDirection: Axis.horizontal,
                padding:
                    const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                physics: const BouncingScrollPhysics(),
                itemCount: _categories.length,
                itemBuilder: (context, index) {
                  final cat = _categories[index];
                  final isSelected = cat == _selectedCategory;
                  return GestureDetector(
                    onTap: () {
                      setState(() {
                        _selectedCategory = cat;
                      });
                      _filterResults();
                    },
                    child: AnimatedContainer(
                      duration: const Duration(milliseconds: 250),
                      curve: Curves.easeOutCubic,
                      margin: const EdgeInsets.symmetric(horizontal: 5),
                      padding: const EdgeInsets.symmetric(
                          horizontal: 20, vertical: 8),
                      decoration: BoxDecoration(
                        color: isSelected
                            ? const Color(0xFF8B1C28)
                            : Colors.transparent,
                        borderRadius: BorderRadius.circular(18),
                        border: Border.all(
                          color: isSelected
                              ? const Color(0xFF8B1C28)
                              : const Color(0xFF8B1C28)
                                  .withValues(alpha: 0.15),
                        ),
                        boxShadow: isSelected
                            ? [
                                BoxShadow(
                                  color: const Color(0xFF8B1C28)
                                      .withValues(alpha: 0.25),
                                  blurRadius: 6,
                                  offset: const Offset(0, 3),
                                )
                              ]
                            : null,
                      ),
                      child: Center(
                        child: Text(
                          cat,
                          style: TextStyle(
                            color: isSelected
                                ? Colors.white
                                : const Color(0xFF8B1C28),
                            fontWeight:
                                isSelected ? FontWeight.w800 : FontWeight.w600,
                            fontSize: 13,
                          ),
                        ),
                      ),
                    ),
                  );
                },
              ),
            ),

            // Active filters summary + Results count
            Padding(
              padding:
                  const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
              child: Row(
                children: [
                  Text(
                    '${_filteredMeals.length} items found',
                    style: TextStyle(
                      color:
                          const Color(0xFF8B1C28).withValues(alpha: 0.5),
                      fontSize: 13,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                  const Spacer(),
                  if (_filters.hasActiveFilters || _selectedCategory != 'All')
                    GestureDetector(
                      onTap: () {
                        setState(() {
                          _filters = const SearchFilters();
                          _selectedCategory = 'All';
                        });
                        _filterResults();
                      },
                      child: Container(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 12, vertical: 6),
                        decoration: BoxDecoration(
                          color: const Color(0xFF8B1C28)
                              .withValues(alpha: 0.08),
                          borderRadius: BorderRadius.circular(12),
                        ),
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Icon(Icons.close_rounded,
                                size: 14,
                                color: const Color(0xFF8B1C28)
                                    .withValues(alpha: 0.7)),
                            const SizedBox(width: 4),
                            Text(
                              'Clear filters',
                              style: TextStyle(
                                color: const Color(0xFF8B1C28)
                                    .withValues(alpha: 0.7),
                                fontSize: 12,
                                fontWeight: FontWeight.w600,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                ],
              ),
            ),

            // Results Grid
            Expanded(
              child: _isLoadingMeals
                  ? const Center(
                      child: CircularProgressIndicator(
                        color: Color(0xFF8B1C28),
                        strokeWidth: 2,
                      ),
                    )
                  : _filteredMeals.isEmpty
                  ? Center(
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Icon(Icons.search_off_rounded,
                              size: 72,
                              color: const Color(0xFF8B1C28)
                                  .withValues(alpha: 0.2)),
                          const SizedBox(height: 16),
                          Text(
                            _searchController.text.isNotEmpty
                                ? 'No results for "${_searchController.text}"'
                                : 'No items match your filters',
                            style: TextStyle(
                              color: const Color(0xFF8B1C28)
                                  .withValues(alpha: 0.5),
                              fontSize: 16,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                          const SizedBox(height: 8),
                          Text(
                            'Try adjusting your search or filters',
                            style: TextStyle(
                              color: const Color(0xFF8B1C28)
                                  .withValues(alpha: 0.3),
                              fontSize: 13,
                            ),
                          ),
                        ],
                      ).animate().fadeIn(duration: 300.ms),
                    )
                  : GridView.builder(
                      controller: _scrollController,
                      padding: const EdgeInsets.symmetric(horizontal: 20),
                      physics: const BouncingScrollPhysics(),
                      gridDelegate:
                          const SliverGridDelegateWithFixedCrossAxisCount(
                        crossAxisCount: 2,
                        childAspectRatio: 0.72,
                        crossAxisSpacing: 14,
                        mainAxisSpacing: 14,
                      ),
                      itemCount:
                          _displayedMeals.length + (_hasMore ? 1 : 0),
                      itemBuilder: (context, index) {
                        if (index >= _displayedMeals.length) {
                          return const Center(
                            child: Padding(
                              padding: EdgeInsets.all(16),
                              child: CircularProgressIndicator(
                                color: Color(0xFF8B1C28),
                                strokeWidth: 2,
                              ),
                            ),
                          );
                        }
                        return FoodCard(
                          food: _displayedMeals[index],
                          onTap: () {
                            // Later: Navigate to food detail
                          },
                          onAddTap: (key) {
                            Provider.of<CartProvider>(context, listen: false).addItem(_displayedMeals[index]);
                            _runAddToCartAnimation(key, _displayedMeals[index].imageUrl);
                          },
                        ).animate().fadeIn(
                              delay: (50 * (index % _pageSize)).ms,
                              duration: 300.ms,
                            );
                      },
                    ),
            ),
          ],
        ),
      ),
    );
  }
}
