import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';

/// A premium horizontally scrollable price filter chip bar.
///
/// Displays quick-filter chips like "Under ₹100", "Under ₹200", "Under ₹300".
/// Tapping an active chip deselects it (returns null).
class PriceFilterChips extends StatelessWidget {
  final double? selectedMaxPrice;
  final ValueChanged<double?> onPriceSelected;

  const PriceFilterChips({
    super.key,
    required this.selectedMaxPrice,
    required this.onPriceSelected,
  });

  static const _maroon = Color(0xFF8B1C28);

  static const List<Map<String, dynamic>> _priceOptions = [
    {'label': 'Under ₹100', 'value': 100.0, 'icon': Icons.bolt_rounded},
    {'label': 'Under ₹200', 'value': 200.0, 'icon': Icons.local_offer_rounded},
    {'label': 'Under ₹300', 'value': 300.0, 'icon': Icons.workspace_premium_rounded},
  ];

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: 52,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        physics: const BouncingScrollPhysics(),
        padding: const EdgeInsets.symmetric(horizontal: 24),
        itemCount: _priceOptions.length,
        separatorBuilder: (_, __) => const SizedBox(width: 10),
        itemBuilder: (context, index) {
          final option = _priceOptions[index];
          final value = option['value'] as double;
          final label = option['label'] as String;
          final icon = option['icon'] as IconData;
          final isSelected = selectedMaxPrice == value;

          return GestureDetector(
            onTap: () => onPriceSelected(isSelected ? null : value),
            child: AnimatedContainer(
              duration: const Duration(milliseconds: 280),
              curve: Curves.easeOutCubic,
              padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 10),
              decoration: BoxDecoration(
                gradient: isSelected
                    ? const LinearGradient(
                        colors: [_maroon, Color(0xFFB52A3A)],
                        begin: Alignment.topLeft,
                        end: Alignment.bottomRight,
                      )
                    : null,
                color: isSelected ? null : Colors.white,
                borderRadius: BorderRadius.circular(28),
                border: Border.all(
                  color: isSelected
                      ? _maroon
                      : _maroon.withValues(alpha: 0.12),
                  width: 1.5,
                ),
                boxShadow: isSelected
                    ? [
                        BoxShadow(
                          color: _maroon.withValues(alpha: 0.30),
                          blurRadius: 12,
                          offset: const Offset(0, 4),
                          spreadRadius: -2,
                        ),
                        BoxShadow(
                          color: _maroon.withValues(alpha: 0.10),
                          blurRadius: 24,
                          offset: const Offset(0, 8),
                        ),
                      ]
                    : [
                        BoxShadow(
                          color: Colors.black.withValues(alpha: 0.04),
                          blurRadius: 8,
                          offset: const Offset(0, 2),
                        ),
                      ],
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  AnimatedContainer(
                    duration: const Duration(milliseconds: 280),
                    padding: const EdgeInsets.all(4),
                    decoration: BoxDecoration(
                      color: isSelected
                          ? Colors.white.withValues(alpha: 0.20)
                          : _maroon.withValues(alpha: 0.08),
                      shape: BoxShape.circle,
                    ),
                    child: Icon(
                      icon,
                      size: 14,
                      color: isSelected
                          ? Colors.white
                          : _maroon.withValues(alpha: 0.7),
                    ),
                  ),
                  const SizedBox(width: 8),
                  Text(
                    label,
                    style: TextStyle(
                      color: isSelected ? Colors.white : const Color(0xFF4A0E13),
                      fontWeight: isSelected ? FontWeight.w800 : FontWeight.w600,
                      fontSize: 13.5,
                      letterSpacing: -0.2,
                    ),
                  ),
                  if (isSelected) ...[
                    const SizedBox(width: 6),
                    Container(
                      width: 18,
                      height: 18,
                      decoration: BoxDecoration(
                        color: Colors.white.withValues(alpha: 0.25),
                        shape: BoxShape.circle,
                      ),
                      child: const Icon(
                        Icons.close_rounded,
                        size: 12,
                        color: Colors.white,
                      ),
                    ),
                  ],
                ],
              ),
            ),
          ).animate().fadeIn(
                delay: (80 * index).ms,
                duration: 350.ms,
              ).slideX(
                begin: 0.15,
                end: 0,
                delay: (80 * index).ms,
                duration: 350.ms,
                curve: Curves.easeOutCubic,
              );
        },
      ),
    );
  }
}
