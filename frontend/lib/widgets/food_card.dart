import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:cached_network_image/cached_network_image.dart';
import '../models/food_item.dart';
import '../models/favorites_model.dart';
import '../widgets/favorite_button.dart';
import '../widgets/heart_overlay.dart';

class FoodCard extends StatefulWidget {
  final FoodItem food;
  final VoidCallback onTap;
  final Function(GlobalKey)? onAddTap;
  final VoidCallback? onInteraction;
  final bool isAvailable;

  const FoodCard({
    super.key,
    required this.food,
    required this.onTap,
    this.onAddTap,
    this.onInteraction,
    this.isAvailable = true,
  });

  @override
  State<FoodCard> createState() => _FoodCardState();
}

class _FoodCardState extends State<FoodCard> {
  final GlobalKey _imageKey = GlobalKey();
  bool _showHeart = false;

  @override
  void dispose() {
    super.dispose();
  }
  void _handleDoubleTap(FavoritesProvider favorites) {
    if (!favorites.isFavorite(widget.food.id)) {
      favorites.toggleFavorite(widget.food.id, widget.food);
    }
    setState(() => _showHeart = true);
  }

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: widget.isAvailable ? widget.onTap : null,
      child: Opacity(
        opacity: widget.isAvailable ? 1.0 : 0.55,
        child: Container(
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(32),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withValues(alpha: 0.06),
                blurRadius: 24,
                offset: const Offset(0, 12),
              ),
            ],
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: GestureDetector(
                  onDoubleTap: () {
                    final favorites = Provider.of<FavoritesProvider>(context, listen: false);
                    _handleDoubleTap(favorites);
                  },
                  child: Stack(
                    alignment: Alignment.center,
                    children: [
                      Hero(
                        key: _imageKey,
                        tag: 'food-image-${widget.food.id}',
                        child: ClipRRect(
                          borderRadius: const BorderRadius.vertical(
                            top: Radius.circular(32),
                          ),
                          child: CachedNetworkImage(
                            imageUrl: widget.food.imageUrl,
                            fit: BoxFit.cover,
                            width: double.infinity,
                            height: double.infinity,
                            placeholder: (context, url) => Container(
                              color: const Color(0xFFFDF0F0),
                              child: const Center(
                                child: SizedBox(
                                  width: 24, height: 24,
                                  child: CircularProgressIndicator(strokeWidth: 2, color: Color(0xFF8B1C28)),
                                ),
                              ),
                            ),
                            errorWidget: (context, url, error) {
                              return Container(
                                color: const Color(0xFFFDF0F0),
                                child: const Center(
                                  child: Icon(
                                    Icons.fastfood_rounded,
                                    color: Color(0xFF8B1C28),
                                    size: 40,
                                  ),
                                ),
                              );
                            },
                          ),
                        ),
                      ),
                      // Unavailable overlay
                      if (!widget.isAvailable)
                        Positioned.fill(
                          child: ClipRRect(
                            borderRadius: const BorderRadius.vertical(top: Radius.circular(32)),
                            child: Container(
                              color: Colors.black.withValues(alpha: 0.35),
                              child: Center(
                                child: Container(
                                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                                  decoration: BoxDecoration(
                                    color: Colors.black.withValues(alpha: 0.65),
                                    borderRadius: BorderRadius.circular(20),
                                  ),
                                  child: const Row(
                                    mainAxisSize: MainAxisSize.min,
                                    children: [
                                      Icon(Icons.access_time_rounded, color: Colors.white70, size: 14),
                                      SizedBox(width: 6),
                                      Text(
                                        'Unavailable',
                                        style: TextStyle(
                                          color: Colors.white,
                                          fontSize: 12,
                                          fontWeight: FontWeight.w700,
                                          letterSpacing: 0.5,
                                        ),
                                      ),
                                    ],
                                  ),
                                ),
                              ),
                            ),
                          ),
                        ),
                      if (widget.isAvailable)
                        Positioned(
                          top: 16,
                          right: 16,
                          child: Consumer<FavoritesProvider>(
                            builder: (context, favorites, child) {
                              bool isFavorite = favorites.isFavorite(widget.food.id);
                              return ClipRRect(
                                borderRadius: BorderRadius.circular(20),
                                child: Container(
                                  padding: const EdgeInsets.all(8),
                                  decoration: BoxDecoration(
                                    color: Colors.white.withValues(alpha: 0.85),
                                    shape: BoxShape.circle,
                                    boxShadow: [
                                      BoxShadow(
                                        color: Colors.black.withValues(alpha: 0.1),
                                        blurRadius: 8,
                                        offset: const Offset(0, 4),
                                      )
                                    ],
                                  ),
                                  child: FavoriteButton(
                                    isFavorite: isFavorite,
                                    onTap: () {
                                      favorites.toggleFavorite(widget.food.id, widget.food);
                                      widget.onInteraction?.call();
                                    },
                                    size: 20,
                                  ),
                                ),
                              );
                            },
                          ),
                        ),
                      if (_showHeart)
                        HeartOverlay(
                          emoji: '\u{2764}\u{FE0F}',
                          onComplete: () {
                            if (mounted) setState(() => _showHeart = false);
                          },
                        ),
                    ],
                  ),
                ),
              ),
              Padding(
                padding: const EdgeInsets.all(20),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      widget.food.name,
                      style: const TextStyle(
                        color: Color(0xFF4A0E13),
                        fontSize: 18,
                        fontWeight: FontWeight.w800,
                      ),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                    const SizedBox(height: 6),
                    Text(
                      '${widget.food.calories} cal \u{2022} ${widget.food.weight}g',
                      style: TextStyle(
                        color: const Color(0xFF8B1C28).withValues(alpha: 0.6),
                        fontSize: 13,
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                    const SizedBox(height: 16),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text(
                          '\u{20B9}${widget.food.price.toStringAsFixed(0)}',
                          style: const TextStyle(
                            color: Color(0xFF4A0E13),
                            fontSize: 20,
                            fontWeight: FontWeight.w900,
                          ),
                        ),
                        if (widget.isAvailable)
                          GestureDetector(
                            onTap: () {
                              if (widget.onAddTap != null) widget.onAddTap!(_imageKey);
                            },
                            child: Container(
                              padding: const EdgeInsets.all(10),
                              decoration: BoxDecoration(
                                gradient: const LinearGradient(
                                  colors: [Color(0xFF8B1C28), Color(0xFF6B151F)],
                                  begin: Alignment.topLeft,
                                  end: Alignment.bottomRight,
                                ),
                                shape: BoxShape.circle,
                                boxShadow: [
                                  BoxShadow(
                                    color: const Color(0xFF8B1C28).withValues(alpha: 0.4),
                                    blurRadius: 10,
                                    offset: const Offset(0, 4),
                                  )
                                ],
                              ),
                              child: const Icon(
                                Icons.add,
                                color: Colors.white,
                                size: 20,
                              ),
                            ),
                          )
                        else
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                            decoration: BoxDecoration(
                              color: Colors.grey.shade200,
                              borderRadius: BorderRadius.circular(20),
                            ),
                            child: Text(
                              'Closed',
                              style: TextStyle(
                                color: Colors.grey.shade500,
                                fontSize: 12,
                                fontWeight: FontWeight.w700,
                              ),
                            ),
                          ),
                      ],
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
