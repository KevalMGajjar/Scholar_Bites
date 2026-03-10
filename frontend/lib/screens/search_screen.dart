import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import '../models/food_item.dart';
import '../widgets/food_card.dart';
import '../widgets/filter_bottom_sheet.dart';
import 'package:provider/provider.dart';
import '../models/cart_model.dart';
import '../utils/animation_utils.dart';
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
    'Burgers',
    'Healthy',
    'Coffee',
    'Snacks',
    'Drinks',
    'Pizza',
    'Desserts',
    'Chicken',
  ];

  // Large dummy dataset so filtering feels real
  final List<FoodItem> _allMeals = [
    // Burgers
    FoodItem(id: '1', name: 'Classic Cheeseburger', price: 149.0, imageUrl: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=400', category: 'Burgers', calories: 450, weight: 200, description: 'Juicy beef patty with melted cheese'),
    FoodItem(id: '2', name: 'Spicy Chicken Burger', price: 169.0, imageUrl: 'https://images.unsplash.com/photo-1553979459-d2229ba7433b?w=400', category: 'Burgers', calories: 480, weight: 220, description: 'Crispy chicken with hot sauce'),
    FoodItem(id: '3', name: 'Veggie Burger', price: 129.0, imageUrl: 'https://images.unsplash.com/photo-1525059696034-4967a8e1dca2?w=400', category: 'Burgers', calories: 350, weight: 180, description: 'Plant-based patty with fresh veggies'),
    // Pizza
    FoodItem(id: '4', name: 'Margherita Pizza', price: 299.0, imageUrl: 'https://images.unsplash.com/photo-1604068549290-dea0e4a30536?w=400', category: 'Pizza', calories: 800, weight: 400, description: 'Classic mozzarella and tomato base'),
    FoodItem(id: '5', name: 'BBQ Chicken Pizza', price: 349.0, imageUrl: 'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=400', category: 'Pizza', calories: 950, weight: 450, description: 'Topped with BBQ chicken pieces'),
    FoodItem(id: '6', name: 'Pepperoni Pizza', price: 329.0, imageUrl: 'https://images.unsplash.com/photo-1628840042765-356cda07504e?w=400', category: 'Pizza', calories: 900, weight: 420, description: 'Loaded with pepperoni slices'),
    // Healthy
    FoodItem(id: '7', name: 'Quinoa Salad', price: 199.0, imageUrl: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=400', category: 'Healthy', calories: 250, weight: 300, description: 'Fresh quinoa mixed with vegetables'),
    FoodItem(id: '8', name: 'Acai Bowl', price: 249.0, imageUrl: 'https://images.unsplash.com/photo-1590301157890-4810ed352733?w=400', category: 'Healthy', calories: 320, weight: 350, description: 'Blended acai with fresh toppings'),
    FoodItem(id: '9', name: 'Green Smoothie Bowl', price: 219.0, imageUrl: 'https://images.unsplash.com/photo-1511690743698-d9d18f7e20f1?w=400', category: 'Healthy', calories: 200, weight: 280, description: 'Spinach and banana smoothie base'),
    // Coffee
    FoodItem(id: '10', name: 'Iced Latte', price: 120.0, imageUrl: 'https://images.unsplash.com/photo-1461023058943-07fcbe16d735?w=400', category: 'Coffee', calories: 120, weight: 250, description: 'Chilled espresso with fresh milk'),
    FoodItem(id: '11', name: 'Cappuccino', price: 140.0, imageUrl: 'https://images.unsplash.com/photo-1572442388796-11668a67e53d?w=400', category: 'Coffee', calories: 100, weight: 200, description: 'Rich espresso with steamed foam'),
    FoodItem(id: '12', name: 'Cold Brew', price: 150.0, imageUrl: 'https://images.unsplash.com/photo-1517701604599-bb29b565090c?w=400', category: 'Coffee', calories: 80, weight: 300, description: 'Slow-steeped for smooth flavor'),
    // Drinks
    FoodItem(id: '13', name: 'Mango Smoothie', price: 110.0, imageUrl: 'https://images.unsplash.com/photo-1623065422900-0320e832f915?w=400', category: 'Drinks', calories: 150, weight: 300, description: 'Refreshing sweet mango blend'),
    FoodItem(id: '14', name: 'Fresh Lemonade', price: 80.0, imageUrl: 'https://images.unsplash.com/photo-1621263764928-df1444c5e859?w=400', category: 'Drinks', calories: 90, weight: 350, description: 'Tangy fresh-squeezed lemonade'),
    FoodItem(id: '15', name: 'Berry Blast Shake', price: 160.0, imageUrl: 'https://images.unsplash.com/photo-1553530666-ba11a7da3888?w=400', category: 'Drinks', calories: 220, weight: 400, description: 'Mixed berries blended to perfection'),
    // Desserts
    FoodItem(id: '16', name: 'Chocolate Lava Cake', price: 180.0, imageUrl: 'https://images.unsplash.com/photo-1606890737304-57a1ca8a5b62?w=400', category: 'Desserts', calories: 550, weight: 150, description: 'Warm chocolate cake with molten center'),
    FoodItem(id: '17', name: 'Tiramisu', price: 220.0, imageUrl: 'https://images.unsplash.com/photo-1571877227200-a0d98ea607e9?w=400', category: 'Desserts', calories: 450, weight: 180, description: 'Classic Italian coffee-flavored treat'),
    FoodItem(id: '18', name: 'Cheesecake Slice', price: 199.0, imageUrl: 'https://images.unsplash.com/photo-1524351199678-941a58a3df50?w=400', category: 'Desserts', calories: 400, weight: 160, description: 'Creamy New York cheesecake'),
    // Chicken
    FoodItem(id: '19', name: 'Fried Chicken Wings', price: 249.0, imageUrl: 'https://images.unsplash.com/photo-1569695584173-ee78ce8f5ea0?w=400', category: 'Chicken', calories: 600, weight: 350, description: 'Crispy deep-fried chicken wings'),
    FoodItem(id: '20', name: 'Grilled Chicken Wrap', price: 189.0, imageUrl: 'https://images.unsplash.com/photo-1626700051175-6818013e1d4f?w=400', category: 'Chicken', calories: 420, weight: 280, description: 'Grilled chicken with fresh veggies'),
    FoodItem(id: '21', name: 'Chicken Tikka', price: 269.0, imageUrl: 'https://images.unsplash.com/photo-1599487488170-d11ec9c172f0?w=400', category: 'Chicken', calories: 500, weight: 300, description: 'Tender marinated chicken pieces'),
    // Snacks
    FoodItem(id: '22', name: 'French Fries', price: 99.0, imageUrl: 'https://images.unsplash.com/photo-1573080496219-bb080dd4f877?w=400', category: 'Snacks', calories: 380, weight: 200, description: 'Crispy golden potato fries'),
    FoodItem(id: '23', name: 'Nachos Supreme', price: 179.0, imageUrl: 'https://images.unsplash.com/photo-1513456852971-30c0b8199d4d?w=400', category: 'Snacks', calories: 450, weight: 250, description: 'Loaded nachos with cheese and salsa'),
    FoodItem(id: '24', name: 'Spring Rolls', price: 139.0, imageUrl: 'https://images.unsplash.com/photo-1548507200-e4e56289e4df?w=400', category: 'Snacks', calories: 280, weight: 180, description: 'Crispy vegetable spring rolls'),
  ];

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

    _filterResults();
    _searchController.addListener(_filterResults);
    _scrollController.addListener(_onScroll);
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
              child: _filteredMeals.isEmpty
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
