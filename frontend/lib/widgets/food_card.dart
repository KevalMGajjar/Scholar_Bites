import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:cached_network_image/cached_network_image.dart';
import '../models/food_item.dart';
import '../models/favorites_model.dart';
import '../utils/availability_helper.dart';
import '../widgets/favorite_button.dart';
import '../widgets/heart_overlay.dart';

import '../widgets/spoon_loader.dart';

class FoodCard extends StatefulWidget {
  final FoodItem food;
  final VoidCallback onTap;
  final Function(GlobalKey)? onAddTap;
  final VoidCallback? onInteraction;
  final FoodItemAvailability availability;

  const FoodCard({
    super.key,
    required this.food,
    required this.onTap,
    this.onAddTap,
    this.onInteraction,
    this.availability = FoodItemAvailability.available,
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

  bool get _isAvailable => widget.availability.isAvailable;

  // ─── Overlay & Badge Styling per State ──────────────────────

  Color get _overlayColor {
    switch (widget.availability) {
      case FoodItemAvailability.available:
        return Colors.transparent;
      case FoodItemAvailability.outOfStock:
        return Colors.black.withValues(alpha: 0.40);
      case FoodItemAvailability.unavailable:
        return const Color(0xFFFF8F00).withValues(alpha: 0.18);
      case FoodItemAvailability.restaurantClosed:
        return Colors.black.withValues(alpha: 0.55);
    }
  }

  Color get _badgeBgColor {
    switch (widget.availability) {
      case FoodItemAvailability.available:
        return Colors.transparent;
      case FoodItemAvailability.outOfStock:
        return const Color(0xFF8B1C28).withValues(alpha: 0.85);
      case FoodItemAvailability.unavailable:
        return const Color(0xFFF59E0B).withValues(alpha: 0.90);
      case FoodItemAvailability.restaurantClosed:
        return Colors.black.withValues(alpha: 0.70);
    }
  }

  Color get _badgeTextColor {
    switch (widget.availability) {
      case FoodItemAvailability.available:
        return Colors.transparent;
      case FoodItemAvailability.outOfStock:
        return Colors.white;
      case FoodItemAvailability.unavailable:
        return const Color(0xFF4A2800);
      case FoodItemAvailability.restaurantClosed:
        return Colors.white;
    }
  }

  IconData get _badgeIcon {
    switch (widget.availability) {
      case FoodItemAvailability.available:
        return Icons.check;
      case FoodItemAvailability.outOfStock:
        return Icons.inventory_2_outlined;
      case FoodItemAvailability.unavailable:
        return Icons.schedule_rounded;
      case FoodItemAvailability.restaurantClosed:
        return Icons.storefront_rounded;
    }
  }

  // ─── Bottom Pill Styling ───────────────────────────────────

  Color get _pillBgColor {
    switch (widget.availability) {
      case FoodItemAvailability.available:
        return Colors.transparent;
      case FoodItemAvailability.outOfStock:
        return Colors.grey.shade200;
      case FoodItemAvailability.unavailable:
        return const Color(0xFFFFF3E0);
      case FoodItemAvailability.restaurantClosed:
        return const Color(0xFFFFEBEE);
    }
  }

  Color get _pillTextColor {
    switch (widget.availability) {
      case FoodItemAvailability.available:
        return Colors.transparent;
      case FoodItemAvailability.outOfStock:
        return const Color(0xFF8B1C28);
      case FoodItemAvailability.unavailable:
        return const Color(0xFFE65100);
      case FoodItemAvailability.restaurantClosed:
        return const Color(0xFFC62828);
    }
  }

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: widget.onTap, // Always allow tap to view details
      child: Opacity(
        opacity: _isAvailable ? 1.0 : 0.92,
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
                  onDoubleTap: _isAvailable ? () {
                    final favorites = Provider.of<FavoritesProvider>(context, listen: false);
                    _handleDoubleTap(favorites);
                  } : null,
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
                                  child: SpoonLoader(size: 24),
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

                      // ─── Unavailability Overlay ─────────────────
                      if (!_isAvailable)
                        Positioned.fill(
                          child: ClipRRect(
                            borderRadius: const BorderRadius.vertical(top: Radius.circular(32)),
                            child: Container(
                              color: _overlayColor,
                              child: Center(
                                child: Container(
                                  padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 7),
                                  decoration: BoxDecoration(
                                    color: _badgeBgColor,
                                    borderRadius: BorderRadius.circular(20),
                                  ),
                                  child: Row(
                                    mainAxisSize: MainAxisSize.min,
                                    children: [
                                      Icon(_badgeIcon, color: _badgeTextColor, size: 14),
                                      const SizedBox(width: 6),
                                      Flexible(
                                        child: Text(
                                          widget.availability.label,
                                          style: TextStyle(
                                            color: _badgeTextColor,
                                            fontSize: 11,
                                            fontWeight: FontWeight.w700,
                                            letterSpacing: 0.3,
                                          ),
                                          overflow: TextOverflow.ellipsis,
                                        ),
                                      ),
                                    ],
                                  ),
                                ),
                              ),
                            ),
                          ),
                        ),

                      // ─── Favourite Button (available only) ──────
                      if (_isAvailable)
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
                          iconData: Icons.favorite_rounded,
                          color: const Color(0xFFED4956),
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
                    Row(
                      crossAxisAlignment: CrossAxisAlignment.center,
                      children: [
                        Container(
                          width: 14,
                          height: 14,
                          decoration: BoxDecoration(
                            border: Border.all(
                              color: widget.food.isVeg ? const Color(0xFF2E7D32) : const Color(0xFFD32F2F),
                              width: 1.5,
                            ),
                            borderRadius: BorderRadius.circular(3),
                          ),
                          child: Center(
                            child: Container(
                              width: 6,
                              height: 6,
                              decoration: BoxDecoration(
                                color: widget.food.isVeg ? const Color(0xFF2E7D32) : const Color(0xFFD32F2F),
                                shape: BoxShape.circle,
                              ),
                            ),
                          ),
                        ),
                        const SizedBox(width: 8),
                        Expanded(
                          child: Text(
                            widget.food.name,
                            style: TextStyle(
                              color: _isAvailable
                                  ? const Color(0xFF4A0E13)
                                  : const Color(0xFF4A0E13).withValues(alpha: 0.5),
                              fontSize: 18,
                              fontWeight: FontWeight.w800,
                            ),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 6),
                    Text(
                      '${widget.food.calories} cal \u{2022} ${widget.food.weight}${widget.food.unit}',
                      style: TextStyle(
                        color: const Color(0xFF8B1C28).withValues(alpha: _isAvailable ? 0.6 : 0.35),
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
                          style: TextStyle(
                            color: _isAvailable
                                ? const Color(0xFF4A0E13)
                                : const Color(0xFF4A0E13).withValues(alpha: 0.45),
                            fontSize: 20,
                            fontWeight: FontWeight.w900,
                          ),
                        ),
                        if (_isAvailable)
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
                          Flexible(
                            child: Container(
                              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                              decoration: BoxDecoration(
                                color: _pillBgColor,
                                borderRadius: BorderRadius.circular(20),
                              ),
                              child: Text(
                                widget.availability.label,
                                style: TextStyle(
                                  color: _pillTextColor,
                                  fontSize: 11,
                                  fontWeight: FontWeight.w700,
                                ),
                                overflow: TextOverflow.ellipsis,
                                maxLines: 1,
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
