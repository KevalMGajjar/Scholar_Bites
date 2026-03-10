import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'dart:math';
import '../models/favorites_model.dart';
import '../models/cart_model.dart';
import '../widgets/food_card.dart';
import '../utils/animation_utils.dart';
import 'detail_screen.dart';
import 'cart_screen.dart';

class FavoritesScreen extends StatefulWidget {
  const FavoritesScreen({super.key});

  @override
  State<FavoritesScreen> createState() => _FavoritesScreenState();
}

class _FavoritesScreenState extends State<FavoritesScreen>
    with TickerProviderStateMixin {
  final GlobalKey _cartKey = GlobalKey();
  late AnimationController _heartsController;

  void _runAddToCartAnimation(GlobalKey widgetKey, String imageUrl) {
    AnimationUtils.runFlyAnimation(
      context,
      widgetKey,
      _cartKey,
      imageUrl,
    );
  }

  @override
  void initState() {
    super.initState();
    _heartsController = AnimationController(
      vsync: this,
      duration: const Duration(seconds: 20),
    )..repeat();
  }

  @override
  void dispose() {
    _heartsController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFFCF9F5),
      appBar: AppBar(
        title: const Text(
          'My Favorites',
          style: TextStyle(
            fontWeight: FontWeight.w800,
            fontSize: 22,
          ),
        ),
        backgroundColor: Colors.transparent,
        elevation: 0,
        foregroundColor: const Color(0xFF4A0E13),
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
      ),
      body: Stack(
        children: [
          // Floating hearts background
          ..._buildFloatingHearts(context),

          // Content
          Consumer<FavoritesProvider>(
            builder: (context, favoritesProvider, child) {
              final favoriteItems = favoritesProvider.favoriteItems;

              if (favoriteItems.isEmpty) {
                return Center(
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      // Animated heart icon
                      Container(
                        width: 120,
                        height: 120,
                        decoration: BoxDecoration(
                          color: const Color(0xFFFDF0F0),
                          shape: BoxShape.circle,
                          boxShadow: [
                            BoxShadow(
                              color: const Color(0xFF8B1C28).withValues(alpha: 0.1),
                              blurRadius: 30,
                              spreadRadius: 5,
                            ),
                          ],
                        ),
                        child: const Center(
                          child: Text(
                            '\u{1F494}',
                            style: TextStyle(fontSize: 48),
                          ),
                        ),
                      )
                          .animate(onPlay: (c) => c.repeat(reverse: true))
                          .scaleXY(begin: 1.0, end: 1.1, duration: 1200.ms, curve: Curves.easeInOut),
                      const SizedBox(height: 24),
                      const Text(
                        'No favorites yet',
                        style: TextStyle(
                          fontSize: 22,
                          color: Color(0xFF4A0E13),
                          fontWeight: FontWeight.w800,
                        ),
                      ),
                      const SizedBox(height: 8),
                      Text(
                        'Double-tap any food to add it here!',
                        style: TextStyle(
                          fontSize: 14,
                          color: const Color(0xFF8B1C28).withValues(alpha: 0.5),
                          fontWeight: FontWeight.w500,
                        ),
                      ),
                    ],
                  ),
                ).animate().fadeIn(duration: 500.ms);
              }

              return Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Count banner
                  Padding(
                    padding: const EdgeInsets.fromLTRB(24, 8, 24, 16),
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                      decoration: BoxDecoration(
                        gradient: LinearGradient(
                          colors: [
                            const Color(0xFF8B1C28).withValues(alpha: 0.08),
                            const Color(0xFF8B1C28).withValues(alpha: 0.03),
                          ],
                        ),
                        borderRadius: BorderRadius.circular(16),
                      ),
                      child: Row(
                        children: [
                          const Text(
                            '\u{2764}\u{FE0F}',
                            style: TextStyle(fontSize: 18),
                          ),
                          const SizedBox(width: 10),
                          Text(
                            '${favoriteItems.length} item${favoriteItems.length == 1 ? '' : 's'} you love',
                            style: const TextStyle(
                              color: Color(0xFF4A0E13),
                              fontSize: 14,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ).animate().fadeIn(duration: 400.ms).slideX(begin: -0.1, end: 0),

                  // Grid
                  Expanded(
                    child: GridView.builder(
                      padding: const EdgeInsets.symmetric(horizontal: 20),
                      physics: const BouncingScrollPhysics(),
                      gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                        crossAxisCount: 2,
                        childAspectRatio: 0.72,
                        crossAxisSpacing: 14,
                        mainAxisSpacing: 14,
                      ),
                      itemCount: favoriteItems.length,
                      itemBuilder: (context, index) {
                        final food = favoriteItems[index];
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
                        ).animate().fadeIn(
                              delay: (80 * index).ms,
                              duration: 400.ms,
                            ).slideY(begin: 0.15, end: 0, curve: Curves.easeOutCubic);
                      },
                    ),
                  ),
                ],
              );
            },
          ),
        ],
      ),
    );
  }

  /// Generate subtle floating heart decorations in the background
  List<Widget> _buildFloatingHearts(BuildContext context) {
    final size = MediaQuery.of(context).size;
    final random = Random(42); // Fixed seed for consistent positions

    final heartEmojis = ['\u{2764}\u{FE0F}', '\u{1F497}', '\u{1F496}', '\u{1F495}', '\u{1F49B}', '\u{1F49C}'];

    return List.generate(12, (i) {
      final left = random.nextDouble() * size.width;
      final top = random.nextDouble() * size.height;
      final fontSize = random.nextDouble() * 14 + 10;
      final emoji = heartEmojis[i % heartEmojis.length];
      final durationMs = (random.nextDouble() * 4000 + 3000).toInt();
      final delayMs = (random.nextDouble() * 2000).toInt();

      return Positioned(
        left: left,
        top: top,
        child: Opacity(
          opacity: random.nextDouble() * 0.08 + 0.04,
          child: Text(
            emoji,
            style: TextStyle(
              fontSize: fontSize,
              decoration: TextDecoration.none,
            ),
          ),
        )
            .animate(onPlay: (c) => c.repeat(reverse: true))
            .slideY(
              begin: 0,
              end: -0.5,
              duration: Duration(milliseconds: durationMs),
              delay: Duration(milliseconds: delayMs),
              curve: Curves.easeInOutSine,
            )
            .scaleXY(
              begin: 0.8,
              end: 1.2,
              duration: Duration(milliseconds: durationMs),
              delay: Duration(milliseconds: delayMs),
            ),
      );
    });
  }
}
