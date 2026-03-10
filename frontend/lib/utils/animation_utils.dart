import 'package:flutter/material.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'dart:math';

class AnimationUtils {
  static void runFlyAnimation(
    BuildContext context,
    GlobalKey startKey,
    GlobalKey endKey,
    String imageUrl, {
    VoidCallback? onComplete,
  }) {
    final OverlayState overlayState = Overlay.of(context);
    
    final RenderBox? startRenderBox =
        startKey.currentContext?.findRenderObject() as RenderBox?;
    final RenderBox? endRenderBox =
        endKey.currentContext?.findRenderObject() as RenderBox?;

    if (startRenderBox == null || endRenderBox == null) return;

    // Calculate center points
    final Offset startPosition =
        startRenderBox.localToGlobal(Offset.zero) +
        Offset(startRenderBox.size.width / 2, startRenderBox.size.height / 2);
    final Offset endPosition =
        endRenderBox.localToGlobal(Offset.zero) +
        Offset(endRenderBox.size.width / 2, endRenderBox.size.height / 2);

    late OverlayEntry overlayEntry;

    overlayEntry = OverlayEntry(
      builder: (context) {
        return _PremiumFlyWidget(
          startPosition: startPosition,
          endPosition: endPosition,
          imageUrl: imageUrl,
          onComplete: () {
            overlayEntry.remove();
            if (onComplete != null) onComplete();
          },
        );
      },
    );

    overlayState.insert(overlayEntry);
  }
}

class _PremiumFlyWidget extends StatefulWidget {
  final Offset startPosition;
  final Offset endPosition;
  final String imageUrl;
  final VoidCallback onComplete;

  const _PremiumFlyWidget({
    required this.startPosition,
    required this.endPosition,
    required this.imageUrl,
    required this.onComplete,
  });

  @override
  State<_PremiumFlyWidget> createState() => _PremiumFlyWidgetState();
}

class _PremiumFlyWidgetState extends State<_PremiumFlyWidget>
    with TickerProviderStateMixin {
  late AnimationController _controller;
  late Animation<double> _arcAnimation;
  late Animation<double> _scaleAnimation;
  late Animation<double> _rotationAnimation;
  late Animation<double> _opacityAnimation;

  @override
  void initState() {
    super.initState();
    // A slightly longer duration for a majestic float
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 850),
    );

    // Bouncy easeOut for the arc movement
    _arcAnimation = CurvedAnimation(
      parent: _controller,
      curve: Curves.easeInOutCubic,
    );

    // Initial pop out, then scale down into cart
    _scaleAnimation = TweenSequence<double>([
      TweenSequenceItem(
          tween: Tween(begin: 0.5, end: 1.4).chain(CurveTween(curve: Curves.easeOutBack)),
          weight: 30),
      TweenSequenceItem(
          tween: Tween(begin: 1.4, end: 1.4).chain(CurveTween(curve: Curves.linear)),
          weight: 20),
      TweenSequenceItem(
          tween: Tween(begin: 1.4, end: 0.1).chain(CurveTween(curve: Curves.easeInBack)),
          weight: 50),
    ]).animate(_controller);

    // Dynamic rotation: spin out, then spin in
    _rotationAnimation = Tween<double>(begin: -0.5 * pi, end: 2 * pi).animate(
      CurvedAnimation(parent: _controller, curve: Curves.easeInOutSine),
    );

    // Fade out right at the end
    _opacityAnimation = TweenSequence<double>([
      TweenSequenceItem(tween: ConstantTween(1.0), weight: 80),
      TweenSequenceItem(tween: Tween(begin: 1.0, end: 0.0), weight: 20),
    ]).animate(_controller);

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
        final double t = _arcAnimation.value;
        
        // Horizontal ease
        final double dx =
            widget.startPosition.dx +
            (widget.endPosition.dx - widget.startPosition.dx) * t;
            
        // Vertical arc
        final double dy =
            widget.startPosition.dy +
            (widget.endPosition.dy - widget.startPosition.dy) * t;

        // Dramatic parabolic arc (height depends on distance)
        final distance = (widget.startPosition - widget.endPosition).distance;
        final arcHeight = -distance * 0.4 * (4 * t * (1 - t));

        return Positioned(
          top: dy + arcHeight - 35, // Adjust for center (70/2)
          left: dx - 35,
          child: Opacity(
            opacity: _opacityAnimation.value,
            child: Transform.scale(
              scale: _scaleAnimation.value,
              child: Transform(
                alignment: Alignment.center,
                transform: Matrix4.identity()
                  ..setEntry(3, 2, 0.002) // Perspective for 3D spin
                  ..rotateZ(_rotationAnimation.value)
                  ..rotateX(sin(t * pi) * 0.8) // Dramatic 3D flipping
                  ..rotateY(sin(t * pi) * 0.5),
                child: Container(
                  width: 70,
                  height: 70,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    image: DecorationImage(
                      image: CachedNetworkImageProvider(widget.imageUrl),
                      fit: BoxFit.cover,
                    ),
                    boxShadow: [
                      BoxShadow(
                        color: Colors.black.withValues(alpha: 0.4),
                        blurRadius: 20,
                        offset: Offset(0, 15 * sin(t * pi)),
                      ),
                      BoxShadow(
                        color: const Color(0xFF8B1C28).withValues(alpha: 0.3),
                        blurRadius: 30,
                        spreadRadius: 5 * sin(t * pi),
                      ),
                    ],
                    border: Border.all(
                      color: Colors.white,
                      width: 3,
                    ),
                  ),
                ),
              ),
            ),
          ),
        );
      },
    );
  }
}
