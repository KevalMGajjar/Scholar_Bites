import 'package:flutter/material.dart';
import 'dart:math' as math;

class GenZCharacter extends StatelessWidget {
  final bool isCoveringEyes;
  final double lookDirection; // -1.0 to 1.0 (left to right)

  const GenZCharacter({
    super.key,
    required this.isCoveringEyes,
    required this.lookDirection,
  });

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: 150,
      height: 150,
      child: Stack(
        alignment: Alignment.center,
        children: [
          // Head
          AnimatedContainer(
            duration: const Duration(milliseconds: 300),
            width: 120,
            height: 120,
            decoration: BoxDecoration(
              color: isCoveringEyes ? const Color(0xFFE8B2B7) : const Color(0xFFFFD1D1),
              shape: BoxShape.circle,
              boxShadow: [
                BoxShadow(
                  color: const Color(0xFF8B1C28).withValues(alpha: 0.1),
                  blurRadius: 20,
                  offset: const Offset(0, 10),
                ),
              ],
            ),
          ),
          
          // Eyes
          AnimatedPositioned(
            duration: const Duration(milliseconds: 150),
            curve: Curves.easeOut,
            left: 50 + (lookDirection * 15),
            top: 45,
            child: Row(
              children: [
                _buildEye(),
                const SizedBox(width: 20),
                _buildEye(),
              ],
            ),
          ),

          // Mouth
          AnimatedPositioned(
            duration: const Duration(milliseconds: 300),
            curve: Curves.easeOut,
            bottom: isCoveringEyes ? 25 : 35,
            left: 60 + (lookDirection * 10),
            child: AnimatedContainer(
              duration: const Duration(milliseconds: 300),
              width: isCoveringEyes ? 30 : 20,
              height: isCoveringEyes ? 10 : 20,
              decoration: BoxDecoration(
                color: const Color(0xFF8B1C28),
                borderRadius: BorderRadius.circular(isCoveringEyes ? 10 : 20),
              ),
            ),
          ),

          // Hands covering eyes
          AnimatedPositioned(
            duration: const Duration(milliseconds: 400),
            curve: Curves.elasticOut,
            top: isCoveringEyes ? 40 : 130,
            left: 30,
            child: Row(
              children: [
                _buildHand(),
                const SizedBox(width: 30),
                _buildHand(),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildEye() {
    return AnimatedContainer(
      duration: const Duration(milliseconds: 300),
      width: 15,
      height: isCoveringEyes ? 2 : 15,
      decoration: BoxDecoration(
        color: const Color(0xFF4A0E13),
        borderRadius: BorderRadius.circular(isCoveringEyes ? 2 : 10),
      ),
    );
  }

  Widget _buildHand() {
    return Container(
      width: 30,
      height: 30,
      decoration: BoxDecoration(
        color: const Color(0xFFFFD1D1),
        shape: BoxShape.circle,
        border: Border.all(color: const Color(0xFF8B1C28).withValues(alpha: 0.2), width: 2),
        boxShadow: [
          BoxShadow(
            color: const Color(0xFF8B1C28).withValues(alpha: 0.2),
            blurRadius: 10,
            offset: const Offset(0, 5),
          ),
        ],
      ),
    );
  }
}

class SpringCurve extends Curve {
  const SpringCurve();
  @override
  double transformInternal(double t) {
    return (math.sin(t * math.pi * 2.5) * math.pow(1 - t, 2.0)) + t;
  }
}

