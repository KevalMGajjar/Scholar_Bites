import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../models/food_item.dart';
import '../models/favorites_model.dart';
import '../models/cart_model.dart';
import '../widgets/favorite_button.dart';
import '../utils/animation_utils.dart';
import 'cart_screen.dart';

class DetailScreen extends StatefulWidget {
  final FoodItem food;

  const DetailScreen({super.key, required this.food});

  @override
  State<DetailScreen> createState() => _DetailScreenState();
}

class _DetailScreenState extends State<DetailScreen> {
  final GlobalKey _cartKey = GlobalKey();
  final GlobalKey _addBtnKey = GlobalKey();

  @override
  Widget build(BuildContext context) {
    // We need a key for the image to fly from.
    final GlobalKey imageKey = GlobalKey();

    return Scaffold(
      backgroundColor: const Color(0xFFFDF0F0),
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        elevation: 0,
        leading: Padding(
          padding: const EdgeInsets.only(left: 16),
          child: Container(
            decoration: BoxDecoration(
              color: Colors.white.withValues(alpha: 0.8),
              shape: BoxShape.circle,
            ),
            child: IconButton(
              icon: const Icon(
                Icons.arrow_back_ios,
                color: Color(0xFF4A0E13),
                size: 20,
              ),
              onPressed: () => Navigator.pop(context),
            ),
          ),
        ),
        actions: [
          Padding(
            padding: const EdgeInsets.only(right: 16),
            child: Container(
              width: 40,
              height: 40,
              decoration: BoxDecoration(
                color: Colors.white.withValues(alpha: 0.8),
                shape: BoxShape.circle,
              ),
              child: Consumer<CartProvider>(
                builder: (context, cart, child) {
                  return Stack(
                    clipBehavior: Clip.none,
                    children: [
                      Center(
                        child: IconButton(
                          key: _cartKey,
                          icon: const Icon(
                            Icons.shopping_bag_outlined,
                            color: Color(0xFF4A0E13),
                            size: 20,
                          ),
                          onPressed: () {
                            Navigator.push(
                              context,
                              MaterialPageRoute(
                                builder: (context) => const CartScreen(),
                              ),
                            );
                          },
                          padding: EdgeInsets.zero,
                          constraints: const BoxConstraints(),
                        ),
                      ),
                      if (cart.itemCount > 0)
                        Positioned(
                          right: -2,
                          top: -2,
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
          Padding(
            padding: const EdgeInsets.only(right: 16),
            child: Consumer<FavoritesProvider>(
              builder: (context, favorites, child) {
                final isFavorite = favorites.isFavorite(widget.food.id);
                return Container(
                  width: 40,
                  height: 40,
                  decoration: BoxDecoration(
                    color: Colors.white.withValues(alpha: 0.8),
                    shape: BoxShape.circle,
                  ),
                  child: Center(
                    child: FavoriteButton(
                      isFavorite: isFavorite,
                      onTap: () {
                        favorites.toggleFavorite(widget.food.id, widget.food);
                      },
                      size: 20,
                    ),
                  ),
                );
              },
            ),
          ),
        ],
      ),
      extendBodyBehindAppBar:
          true, // Make body go behind app bar for the hero image
      body: Stack(
        children: [
          // Background Image / Hero
          Positioned(
            top: 0,
            left: 0,
            right: 0,
            height: MediaQuery.of(context).size.height * 0.55,
            child: Hero(
              tag: 'food-image-${widget.food.id}',
              key: imageKey, // Add key to Hero
              child: Image.network(
                widget.food.imageUrl,
                fit: BoxFit.cover,
                loadingBuilder: (context, child, loadingProgress) {
                  if (loadingProgress == null) return child;
                  return Center(
                    child: CircularProgressIndicator(
                      value: loadingProgress.expectedTotalBytes != null
                          ? loadingProgress.cumulativeBytesLoaded /
                                loadingProgress.expectedTotalBytes!
                          : null,
                      color: const Color(0xFF8B1C28),
                    ),
                  );
                },
                errorBuilder: (context, error, stackTrace) {
                  return Container(
                    color: const Color(0xFFFDF0F0),
                    child: const Center(
                      child: Icon(
                        Icons.fastfood,
                        color: Color(0xFF8B1C28),
                        size: 60,
                      ),
                    ),
                  );
                },
              ),
            ),
          ),

          // Floating Leaf Elements (Simulated)
          Positioned(
            top: 100,
            right: -20,
            child: Opacity(
              opacity: 0.6,
              child: Transform.rotate(
                angle: 0.5,
                child: Icon(
                  Icons.eco,
                  color: const Color(0xFF8B1C28).withValues(alpha: 0.4),
                  size: 100,
                ),
              ),
            ),
          ),
          Positioned(
            top: 250,
            left: -30,
            child: Opacity(
              opacity: 0.4,
              child: Transform.rotate(
                angle: -0.5,
                child: Icon(
                  Icons.eco,
                  color: const Color(0xFF8B1C28).withValues(alpha: 0.3),
                  size: 150,
                ),
              ),
            ),
          ),

          // Content Sheet
          Positioned(
            top: MediaQuery.of(context).size.height * 0.5,
            left: 0,
            right: 0,
            bottom: 0,
            child: Container(
              padding: const EdgeInsets.all(32),
              decoration: BoxDecoration(
                color: const Color(0xFFFDF0F0),
                borderRadius: const BorderRadius.vertical(
                  top: Radius.circular(40),
                ),
                boxShadow: [
                  BoxShadow(
                    color: const Color(0xFF8B1C28).withValues(alpha: 0.1),
                    blurRadius: 30,
                    offset: const Offset(0, -10),
                  ),
                ],
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Title
                  Text(
                    widget.food.name,
                    style: const TextStyle(
                      color: Color(0xFF4A0E13),
                      fontSize: 32,
                      fontWeight: FontWeight.bold,
                      height: 1.1,
                    ),
                  ),
                  const SizedBox(height: 16),

                  // Metadata
                  Row(
                    children: [
                      _buildMetadataChip(
                        Icons.local_fire_department_rounded,
                        '${widget.food.calories} cal',
                      ),
                      const SizedBox(width: 16),
                      _buildMetadataChip(
                        Icons.scale_rounded,
                        '${widget.food.weight}g',
                      ),
                      const SizedBox(width: 16),
                      _buildMetadataChip(Icons.star_rounded, '4.8'),
                    ],
                  ),
                  const SizedBox(height: 24),

                  // Description
                  Text(
                    'Description',
                    style: TextStyle(
                      color: Color(0xFF4A0E13),
                      fontSize: 18,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    widget.food.description,
                    style: TextStyle(
                      color: const Color(0xFF4A0E13).withValues(alpha: 0.7),
                      fontSize: 14,
                      height: 1.6,
                    ),
                  ),

                  const Spacer(),

                  // Bottom Action Bar
                  Row(
                    children: [
                      // Price
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'Price',
                            style: TextStyle(
                              color: const Color(0xFF4A0E13).withValues(alpha: 0.7),
                              fontSize: 14,
                            ),
                          ),
                          Text(
                            '\u{20B9}${widget.food.price.toStringAsFixed(2)}',
                            style: const TextStyle(
                              color: Color(0xFF8B1C28),
                              fontSize: 28,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(width: 32),

                      // Add to Cart Button
                      Expanded(
                        child: ElevatedButton(
                          onPressed: () {
                            context.read<CartProvider>().addItem(widget.food);
                            AnimationUtils.runFlyAnimation(
                              context,
                              _addBtnKey,
                              _cartKey,
                              widget.food.imageUrl,
                            );
                          },
                          style: ElevatedButton.styleFrom(
                            backgroundColor: const Color(0xFF8B1C28),
                            foregroundColor: Colors.white,
                            padding: const EdgeInsets.symmetric(vertical: 16),
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(16),
                            ),
                            elevation: 0,
                          ),
                          child: const Row(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              Icon(Icons.shopping_bag_outlined, size: 20),
                              SizedBox(width: 8),
                              Text(
                                'Add to Cart',
                                style: TextStyle(
                                  fontSize: 18,
                                  fontWeight: FontWeight.bold,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ),
          // Invisible key anchor for fly-from position on the Add to Cart button
          Positioned(
            bottom: 50,
            left: MediaQuery.of(context).size.width * 0.55,
            child: SizedBox(key: _addBtnKey, width: 1, height: 1),
          ),
        ],
      ),
    );
  }

  Widget _buildMetadataChip(IconData icon, String label) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      decoration: BoxDecoration(
        color: const Color(0xFF8B1C28).withValues(alpha: 0.05),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: const Color(0xFF8B1C28).withValues(alpha: 0.1)),
      ),
      child: Row(
        children: [
          Icon(icon, color: const Color(0xFF8B1C28), size: 16),
          const SizedBox(width: 6),
          Text(
            label,
            style: TextStyle(
              color: const Color(0xFF4A0E13).withValues(alpha: 0.8),
              fontSize: 12,
              fontWeight: FontWeight.w500,
            ),
          ),
        ],
      ),
    );
  }
}

