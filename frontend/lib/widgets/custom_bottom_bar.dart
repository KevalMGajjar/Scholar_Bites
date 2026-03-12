import 'dart:ui';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:flutter_animate/flutter_animate.dart';
import '../models/cart_model.dart';

class CustomBottomBar extends StatelessWidget {
  final int currentIndex;
  final Function(int) onTap;

  final GlobalKey? cartKey;
  final GlobalKey? favKey;

  const CustomBottomBar({
    super.key,
    this.currentIndex = 0,
    required this.onTap,
    this.cartKey,
    this.favKey,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(left: 24, right: 24, bottom: 32),
      height: 72,
      child: RepaintBoundary(
        child: ClipRRect(
          borderRadius: BorderRadius.circular(36),
          child: BackdropFilter(
            filter: ImageFilter.blur(sigmaX: 15, sigmaY: 15),
            child: Container(
              decoration: BoxDecoration(
                color: Colors.white.withValues(alpha: 0.85),
                borderRadius: BorderRadius.circular(36),
                border: Border.all(
                  color: Colors.white.withValues(alpha: 0.5),
                  width: 1.5,
                ),
                boxShadow: [
                  BoxShadow(
                    color: const Color(0xFF8B1C28).withValues(alpha: 0.15),
                    blurRadius: 30,
                    offset: const Offset(0, 10),
                  ),
                ],
              ),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                children: [
                  _buildNavItem(Icons.home_rounded, 0, context),
                  _buildNavItem(Icons.favorite_rounded, 1, context, key: favKey),
                  _buildNavItem(Icons.shopping_bag_rounded, 2, context, key: cartKey),
                  _buildNavItem(Icons.person_rounded, 3, context),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildNavItem(IconData icon, int index, BuildContext context, {GlobalKey? key}) {
    bool isActive = currentIndex == index;
    
    return GestureDetector(
      onTap: () => onTap(index),
      behavior: HitTestBehavior.opaque,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 300),
        curve: Curves.easeOutCubic,
        padding: EdgeInsets.symmetric(
          horizontal: isActive ? 20 : 12,
          vertical: 12,
        ),
        decoration: BoxDecoration(
          color: isActive ? const Color(0xFF8B1C28) : Colors.transparent,
          borderRadius: BorderRadius.circular(24),
          boxShadow: isActive
              ? [
                  BoxShadow(
                    color: const Color(0xFF8B1C28).withValues(alpha: 0.4),
                    blurRadius: 12,
                    offset: const Offset(0, 4),
                  )
                ]
              : [],
        ),
        child: Stack(
          clipBehavior: Clip.none,
          children: [
            Icon(
              icon,
              key: key,
              color: isActive ? Colors.white : const Color(0xFF4A0E13).withValues(alpha: 0.4),
              size: 26,
            ).animate(target: isActive ? 1 : 0)
              .scaleXY(begin: 1.0, end: 1.1, duration: 200.ms, curve: Curves.easeOutCubic),
            if (index == 2)
              Positioned(
                top: -6,
                right: -6,
                child: Consumer<CartProvider>(
                  builder: (context, cart, child) {
                    if (cart.items.isEmpty) return const SizedBox.shrink();
                    return Container(
                      padding: const EdgeInsets.all(4),
                      decoration: BoxDecoration(
                        color: isActive ? Colors.white : const Color(0xFF8B1C28),
                        shape: BoxShape.circle,
                        border: Border.all(
                          color: isActive ? const Color(0xFF8B1C28) : Colors.white,
                          width: 1.5,
                        ),
                      ),
                      child: Text(
                        '${cart.items.length}',
                        style: TextStyle(
                          color: isActive ? const Color(0xFF8B1C28) : Colors.white,
                          fontSize: 10,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                    ).animate(key: ValueKey(cart.items.length))
                     .scaleXY(begin: 0.5, end: 1.0, duration: 300.ms, curve: Curves.bounceOut);
                  },
                ),
              ),
          ],
        ),
      ),
    );
  }
}

