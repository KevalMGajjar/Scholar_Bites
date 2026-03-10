import 'package:flutter/material.dart';
import 'dart:math';

class HeartOverlay extends StatefulWidget {
  final String emoji;
  final VoidCallback onComplete;

  const HeartOverlay({
    super.key,
    required this.emoji,
    required this.onComplete,
  });

  @override
  State<HeartOverlay> createState() => _HeartOverlayState();
}

class _HeartOverlayState extends State<HeartOverlay>
    with SingleTickerProviderStateMixin {
  late AnimationController _controller;
  final Random _random = Random();
  
  late List<_Particle> _particles;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1200),
    );

    // Generate 6-8 particles for a burst effect
    final int particleCount = _random.nextInt(3) + 6;
    _particles = List.generate(particleCount, (i) {
      final double angle = (2 * pi / particleCount) * i + (_random.nextDouble() - 0.5);
      final double speed = _random.nextDouble() * 0.6 + 0.4;
      return _Particle(
        angle: angle,
        speed: speed,
        size: _random.nextDouble() * 15 + 15,
        delay: _random.nextDouble() * 0.2, // Staggered start
      );
    });

    _controller.forward().then((_) => widget.onComplete());
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _controller,
      builder: (context, child) {
        final t = _controller.value;
        
        return Stack(
          alignment: Alignment.center,
          clipBehavior: Clip.none,
          children: [
            // Center main pop
            if (t < 0.8)
              Opacity(
                opacity: t < 0.6 ? 1.0 : 1.0 - ((t - 0.6) / 0.2),
                child: Transform.scale(
                  scale: _springScale(t * 1.25),
                  child: Text(
                    widget.emoji,
                    style: const TextStyle(
                      fontSize: 50,
                      decoration: TextDecoration.none,
                      shadows: [
                        Shadow(
                          color: Colors.black26,
                          blurRadius: 20,
                          offset: Offset(0, 5),
                        )
                      ]
                    ),
                  ),
                ),
              ),
              
            // Burst particles
            ..._particles.map((p) {
              final pt = (t - p.delay) / (1.0 - p.delay);
              if (pt < 0) return const SizedBox();
              
              final double distance = pt * 80 * p.speed;
              final double dx = cos(p.angle) * distance;
              final double dy = sin(p.angle) * distance - (pt * pt * 40); // Gravity effect
              
              final scale = pt < 0.2 
                  ? (pt / 0.2) 
                  : (1.0 - (pt - 0.2) / 0.8);
                  
              return Positioned(
                child: Transform.translate(
                  offset: Offset(dx, dy),
                  child: Transform.scale(
                    scale: scale,
                    child: Transform.rotate(
                      angle: p.angle + (pt * pi),
                      child: Text(
                        widget.emoji,
                        style: TextStyle(
                          fontSize: p.size,
                          decoration: TextDecoration.none,
                        ),
                      ),
                    ),
                  ),
                ),
              );
            }),
          ],
        );
      },
    );
  }

  // Gives a nice bouncy elasticity to the center pop
  double _springScale(double t) {
    if (t > 1.0) t = 1.0;
    return 1.0 - cos(t * pi * 4.5) * exp(-t * 6.0);
  }
}

class _Particle {
  final double angle;
  final double speed;
  final double size;
  final double delay;

  _Particle({
    required this.angle,
    required this.speed,
    required this.size,
    required this.delay,
  });
}
