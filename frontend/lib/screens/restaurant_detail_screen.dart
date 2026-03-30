import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:lottie/lottie.dart';
import '../widgets/spoon_loader.dart';
import '../models/restaurant_model.dart';
import '../models/food_item.dart';
import '../models/cart_model.dart';
import '../widgets/food_card.dart';
import 'detail_screen.dart';
import 'cart_screen.dart';

import '../services/menu_service.dart';
import '../utils/token_storage.dart';
import '../utils/animation_utils.dart'; // Add utils import
import '../utils/availability_helper.dart';

class RestaurantDetailScreen extends StatefulWidget {
  final Restaurant restaurant;

  const RestaurantDetailScreen({super.key, required this.restaurant});

  @override
  State<RestaurantDetailScreen> createState() => _RestaurantDetailScreenState();
}

class _RestaurantDetailScreenState extends State<RestaurantDetailScreen> {
  final GlobalKey _cartKey = GlobalKey();
  
  List<FoodItem> _menuItems = [];
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    _fetchMenu();
  }

  Future<void> _fetchMenu() async {
    try {
      final uniId = await TokenStorage.getUniversityId() ?? '';
      final items = await MenuService().getMenuItems(uniId, restaurantId: widget.restaurant.id);
      if (mounted) {
        setState(() {
          _menuItems = items;
          _isLoading = false;
        });
      }
    } catch (e) {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  void _runAddToCartAnimation(GlobalKey widgetKey, String imageUrl) {
    AnimationUtils.runFlyAnimation(
      context,
      widgetKey,
      _cartKey,
      imageUrl,
      onComplete: () {},
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFFAFAFA),
      body: CustomScrollView(
        slivers: [
          // App Bar with Image
          SliverAppBar(
            expandedHeight: 250,
            pinned: true,
            backgroundColor: const Color(0xFFFAFAFA),
            iconTheme: const IconThemeData(color: Color(0xFF4A0E13)),
            actions: [
              Padding(
                padding: const EdgeInsets.only(right: 16),
                child: Container(
                  decoration: BoxDecoration(
                    color: Colors.white.withValues(alpha: 0.8),
                    shape: BoxShape.circle,
                  ),
                  child: Consumer<CartProvider>(
                    builder: (context, cart, child) {
                      return Stack(
                        clipBehavior: Clip.none,
                        children: [
                          IconButton(
                            key: _cartKey,
                            icon: const Icon(Icons.shopping_bag_outlined),
                            color: const Color(0xFF8B1C28),
                            onPressed: () {
                              Navigator.push(
                                context,
                                MaterialPageRoute(
                                  builder: (context) => const CartScreen(),
                                ),
                              );
                            },
                          ),
                          if (cart.itemCount > 0)
                            Positioned(
                              right: 8,
                              top: 8,
                              child: Container(
                                padding: const EdgeInsets.all(4),
                                decoration: const BoxDecoration(
                                  color: Color(0xFF8B1C28),
                                  shape: BoxShape.circle,
                                ),
                                constraints: const BoxConstraints(
                                  minWidth: 16,
                                  minHeight: 16,
                                ),
                                child: Text(
                                  '${cart.itemCount}',
                                  style: const TextStyle(
                                    color: Colors.white,
                                    fontSize: 10,
                                    fontWeight: FontWeight.bold,
                                  ),
                                  textAlign: TextAlign.center,
                                ),
                              ),
                            ),
                        ],
                      );
                    },
                  ),
                ),
              ),
            ],
            flexibleSpace: FlexibleSpaceBar(
              title: Text(
                widget.restaurant.name,
                style: const TextStyle(
                  color: Colors.white,
                  fontWeight: FontWeight.w900,
                  shadows: [
                    Shadow(
                      offset: Offset(0, 2),
                      blurRadius: 10.0,
                      color: Colors.black54,
                    ),
                  ],
                ),
              ),
              background: Container(
                foregroundDecoration: BoxDecoration(
                  gradient: LinearGradient(
                    colors: [Colors.black.withValues(alpha: 0.7), Colors.transparent],
                    begin: Alignment.bottomCenter,
                    end: Alignment.topCenter,
                  ),
                ),
                child: CachedNetworkImage(
                  imageUrl: widget.restaurant.coverUrl ?? widget.restaurant.imageUrl,
                  fit: BoxFit.cover,
                  width: double.infinity,
                  height: double.infinity,
                  placeholder: (context, url) => Container(
                    color: Colors.grey[200],
                    child: const Center(
                      child: SpoonLoader(size: 40),
                    ),
                  ),
                  errorWidget: (context, url, error) {
                    return Container(
                      color: Colors.grey[300],
                      child: const Icon(Icons.restaurant, size: 50),
                    );
                  },
                ),
              ),
            ),
          ),

          // Restaurant Info
          SliverToBoxAdapter(
            child: Stack(
              clipBehavior: Clip.none,
              children: [
                // Main content
                Padding(
                  padding: const EdgeInsets.all(24.0),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      // Push content down if closed to make room for Lottie
                      if (!widget.restaurant.isCurrentlyOpen)
                        const SizedBox(height: 80),

                      // Rating & Delivery Info Row
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                        decoration: BoxDecoration(
                          color: Colors.white,
                          borderRadius: BorderRadius.circular(16),
                          boxShadow: [
                            BoxShadow(
                              color: Colors.black.withValues(alpha: 0.04),
                              blurRadius: 12,
                              offset: const Offset(0, 4),
                            ),
                          ],
                        ),
                        child: Row(
                          children: [
                            // Rating chip
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                              decoration: BoxDecoration(
                                color: const Color(0xFFFFF8E1),
                                borderRadius: BorderRadius.circular(10),
                              ),
                              child: Row(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  const Icon(Icons.star_rounded, color: Color(0xFFFFA726), size: 18),
                                  const SizedBox(width: 4),
                                  Text(
                                    '${widget.restaurant.rating}',
                                    style: const TextStyle(
                                      fontSize: 14,
                                      fontWeight: FontWeight.w800,
                                      color: Color(0xFF1E1E1E),
                                    ),
                                  ),
                                ],
                              ),
                            ),
                            const SizedBox(width: 16),
                            // Prep time
                            Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                const Icon(Icons.schedule_rounded, color: Color(0xFF8B1C28), size: 18),
                                const SizedBox(width: 6),
                                Text(
                                  widget.restaurant.deliveryTime,
                                  style: const TextStyle(
                                    fontSize: 14,
                                    fontWeight: FontWeight.w600,
                                    color: Color(0xFF555555),
                                  ),
                                ),
                              ],
                            ),
                            const Spacer(),
                            // Status indicator
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                              decoration: BoxDecoration(
                                color: widget.restaurant.isCurrentlyOpen
                                    ? const Color(0xFF10B981).withValues(alpha: 0.1)
                                    : const Color(0xFFEF4444).withValues(alpha: 0.1),
                                borderRadius: BorderRadius.circular(20),
                              ),
                              child: Row(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  Container(
                                    width: 7,
                                    height: 7,
                                    decoration: BoxDecoration(
                                      color: widget.restaurant.isCurrentlyOpen
                                          ? const Color(0xFF10B981)
                                          : const Color(0xFFEF4444),
                                      shape: BoxShape.circle,
                                    ),
                                  ),
                                  const SizedBox(width: 6),
                                  Text(
                                    widget.restaurant.isCurrentlyOpen ? 'Open' : 'Closed',
                                    style: TextStyle(
                                      color: widget.restaurant.isCurrentlyOpen
                                          ? const Color(0xFF10B981)
                                          : const Color(0xFFEF4444),
                                      fontSize: 12,
                                      fontWeight: FontWeight.w700,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ],
                        ),
                      ),

                      // Operating Hours
                      if (widget.restaurant.hoursDisplay.isNotEmpty)
                        Padding(
                          padding: const EdgeInsets.only(top: 12),
                          child: Row(
                            children: [
                              Icon(Icons.access_time_rounded, size: 15, color: const Color(0xFF1E1E1E).withValues(alpha: 0.4)),
                              const SizedBox(width: 6),
                              Text(
                                'Hours: ${widget.restaurant.hoursDisplay}',
                                style: TextStyle(
                                  color: const Color(0xFF1E1E1E).withValues(alpha: 0.5),
                                  fontSize: 13,
                                  fontWeight: FontWeight.w600,
                                ),
                              ),
                            ],
                          ),
                        ),

                      // Tags
                      if (widget.restaurant.tags.isNotEmpty)
                        Padding(
                          padding: const EdgeInsets.only(top: 14),
                          child: Wrap(
                            spacing: 8,
                            runSpacing: 8,
                            children: widget.restaurant.tags.map((tag) {
                              return Container(
                                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                                decoration: BoxDecoration(
                                  color: const Color(0xFF8B1C28).withValues(alpha: 0.06),
                                  borderRadius: BorderRadius.circular(20),
                                  border: Border.all(
                                    color: const Color(0xFF8B1C28).withValues(alpha: 0.1),
                                  ),
                                ),
                                child: Text(
                                  tag,
                                  style: const TextStyle(
                                    fontSize: 12,
                                    fontWeight: FontWeight.w600,
                                    color: Color(0xFF8B1C28),
                                  ),
                                ),
                              );
                            }).toList(),
                          ),
                        ),

                      const SizedBox(height: 28),

                      // Menu Section Header
                      Row(
                        children: [
                          Container(
                            width: 4,
                            height: 22,
                            decoration: BoxDecoration(
                              color: const Color(0xFF8B1C28),
                              borderRadius: BorderRadius.circular(2),
                            ),
                          ),
                          const SizedBox(width: 10),
                          const Text(
                            'Full Menu',
                            style: TextStyle(
                              fontSize: 20,
                              fontWeight: FontWeight.w900,
                              color: Color(0xFF1E1E1E),
                              letterSpacing: -0.3,
                            ),
                          ),
                          const SizedBox(width: 8),
                          if (!_isLoading)
                            Text(
                              '${_menuItems.length} items',
                              style: TextStyle(
                                fontSize: 14,
                                fontWeight: FontWeight.w600,
                                color: const Color(0xFF1E1E1E).withValues(alpha: 0.35),
                              ),
                            ),
                        ],
                      ),
                    ],
                  ),
                ),

                // Overlapping Lottie Closed Banner
                if (!widget.restaurant.isCurrentlyOpen)
                  Positioned(
                    top: -20,
                    left: 0,
                    right: 0,
                    child: IgnorePointer(
                      child: Container(
                        height: 140,
                        decoration: BoxDecoration(
                          gradient: LinearGradient(
                            begin: Alignment.topCenter,
                            end: Alignment.bottomCenter,
                            colors: [
                              const Color(0xFFEF4444).withValues(alpha: 0.08),
                              Colors.transparent,
                            ],
                          ),
                        ),
                        child: Center(
                          child: Lottie.asset(
                            'assets/lottie/Closed tag.json',
                            height: 120,
                            fit: BoxFit.contain,
                          ),
                        ),
                      ),
                    ),
                  ),
              ],
            ),
          ),

          // Menu Grid
          _isLoading 
            ? const SliverToBoxAdapter(
                child: Padding(
                  padding: EdgeInsets.all(40),
                  child: Center(child: SpoonLoader(size: 50)),
                )
              )
            : _menuItems.isEmpty
              ? const SliverToBoxAdapter(
                  child: Padding(
                    padding: EdgeInsets.all(40),
                    child: Center(child: Text("No menu items available currently.", style: TextStyle(color: Colors.grey, fontSize: 16))),
                  )
                )
              : SliverPadding(
                  padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 8),
                  sliver: SliverGrid(
                    gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                      crossAxisCount: 2,
                      childAspectRatio: 0.65, // Adjusted to fit new taller cards
                      crossAxisSpacing: 16,
                      mainAxisSpacing: 16,
                    ),
                    delegate: SliverChildBuilderDelegate((context, index) {
                      FoodItem food = _menuItems[index];
                      final availability = AvailabilityHelper.getAvailability(
                        food,
                        [widget.restaurant],
                      );
                      return FoodCard(
                        food: food,
                        availability: availability,
                        onTap: () {
                          Navigator.push(
                            context,
                            MaterialPageRoute(
                              builder: (context) => DetailScreen(
                                food: food,
                                restaurants: [widget.restaurant],
                              ),
                            ),
                          );
                        },
                        onAddTap: availability.isAvailable
                            ? (key) {
                                Provider.of<CartProvider>(
                                  context,
                                  listen: false,
                                ).addItem(food);
                                _runAddToCartAnimation(key, food.imageUrl);
                              }
                            : null,
                      );
                    }, childCount: _menuItems.length),
                  ),
                ),

          // Bottom padding
          const SliverToBoxAdapter(child: SizedBox(height: 40)),
        ],
      ),
    );
  }
}

