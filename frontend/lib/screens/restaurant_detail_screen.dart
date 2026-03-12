import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:cached_network_image/cached_network_image.dart';
import '../models/restaurant_model.dart';
import '../models/food_item.dart';
import '../models/cart_model.dart';
import '../widgets/food_card.dart';
import 'detail_screen.dart';
import 'cart_screen.dart';

import '../services/menu_service.dart';
import '../utils/token_storage.dart';
import '../utils/animation_utils.dart'; // Add utils import

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
                      child: CircularProgressIndicator(color: Color(0xFF8B1C28)),
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
            child: Padding(
              padding: const EdgeInsets.all(24.0),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      const Icon(
                        Icons.star_rounded,
                        color: Colors.orangeAccent,
                        size: 24,
                      ),
                      const SizedBox(width: 4),
                      Text(
                        '${widget.restaurant.rating} Rating',
                        style: const TextStyle(
                          fontSize: 15,
                          fontWeight: FontWeight.w800,
                          color: Color(0xFF1E1E1E),
                        ),
                      ),
                      const SizedBox(width: 20),
                      const Icon(
                        Icons.schedule_rounded,
                        color: Color(0xFF8B1C28),
                        size: 20,
                      ),
                      const SizedBox(width: 6),
                      Text(
                        widget.restaurant.deliveryTime,
                        style: const TextStyle(
                          fontSize: 15,
                          fontWeight: FontWeight.w600,
                          color: Color(0xFF1E1E1E),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 16),
                  Wrap(
                    spacing: 8,
                    children: widget.restaurant.tags.map((tag) {
                      return Container(
                        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                        decoration: BoxDecoration(
                          color: const Color(0xFF8B1C28).withValues(alpha: 0.1),
                          borderRadius: BorderRadius.circular(16),
                        ),
                        child: Text(
                          tag,
                          style: const TextStyle(
                            fontSize: 13,
                            fontWeight: FontWeight.w700,
                            color: Color(0xFF8B1C28),
                          ),
                        ),
                      );
                    }).toList(),
                  ),
                  const SizedBox(height: 32),
                  const Text(
                    'Full Menu \u{1F9FE}',
                    style: TextStyle(
                      fontSize: 22,
                      fontWeight: FontWeight.w900,
                      color: Color(0xFF1E1E1E),
                    ),
                  ),
                ],
              ),
            ),
          ),

          // Menu Grid
          _isLoading 
            ? const SliverToBoxAdapter(
                child: Padding(
                  padding: EdgeInsets.all(40),
                  child: Center(child: CircularProgressIndicator(color: Color(0xFF8B1C28))),
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
                      return FoodCard(
                        food: food,
                        onTap: () {
                          Navigator.push(
                            context,
                            MaterialPageRoute(
                              builder: (context) => DetailScreen(food: food),
                            ),
                          );
                        },
                        onAddTap: (key) {
                          Provider.of<CartProvider>(
                            context,
                            listen: false,
                          ).addItem(food);
                          _runAddToCartAnimation(key, food.imageUrl);
                        },
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

