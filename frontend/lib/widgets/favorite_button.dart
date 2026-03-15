import 'package:flutter/material.dart';
import 'heart_overlay.dart';

class FavoriteButton extends StatefulWidget {
  final bool isFavorite;
  final VoidCallback onTap;
  final double size;

  const FavoriteButton({
    super.key,
    required this.isFavorite,
    required this.onTap,
    this.size = 24.0,
  });

  @override
  State<FavoriteButton> createState() => _FavoriteButtonState();
}

class _FavoriteButtonState extends State<FavoriteButton>
    with TickerProviderStateMixin {
  late AnimationController _controller;
  late Animation<double> _scaleAnimation;
  late AnimationController _particleController;
  bool _localInteraction = false;

  @override
  void initState() {
    super.initState();
    // Shorter duration for snappy feel (Instagram style)
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 150),
    );

    _particleController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 500),
    );

    // Punchy elastic pop: 1.0 -> 1.35 -> 0.9 -> 1.0
    _scaleAnimation = TweenSequence<double>([
      TweenSequenceItem(tween: Tween(begin: 1.0, end: 1.35).chain(CurveTween(curve: Curves.easeOutBack)), weight: 40),
      TweenSequenceItem(tween: Tween(begin: 1.35, end: 0.9).chain(CurveTween(curve: Curves.easeInOut)), weight: 30),
      TweenSequenceItem(tween: Tween(begin: 0.9, end: 1.0).chain(CurveTween(curve: Curves.easeOutBack)), weight: 30),
    ]).animate(_controller);

    // Removed unused _particleAnimation configuration
  }

  @override
  void didUpdateWidget(covariant FavoriteButton oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.isFavorite != oldWidget.isFavorite) {
      // Check if the current route is active to prevent background animations
      final route = ModalRoute.of(context);
      final isCurrent = route?.isCurrent ?? true;

      if (isCurrent) {
        if (widget.isFavorite) {
          _controller.forward(from: 0.0);
          _particleController.forward(from: 0.0);
          if (_localInteraction) {
            _showOverlay(true);
            _localInteraction = false;
          }
        } else {
          if (_localInteraction) {
            _showOverlay(false);
            _localInteraction = false;
          }
        }
      }
    }
  }

  void _showOverlay(bool isLike) {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      final OverlayState overlayState = Overlay.of(context);
      final RenderBox? renderBox = context.findRenderObject() as RenderBox?;
      if (renderBox == null) return;

      final Offset position = renderBox.localToGlobal(Offset.zero);
      final Size size = renderBox.size;

      late OverlayEntry overlayEntry;
      overlayEntry = OverlayEntry(
        builder: (context) {
          return Positioned(
            top: position.dy - 30,
            left: position.dx + (size.width - 40) / 2,
            child: HeartOverlay(
              emoji: isLike ? '❤️' : '💔',
              onComplete: () {
                if (overlayEntry.mounted) {
                  overlayEntry.remove();
                }
              },
            ),
          );
        },
      );
      overlayState.insert(overlayEntry);
    });
  }

  @override
  void dispose() {
    _controller.dispose();
    _particleController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: () {
        _localInteraction = true;
        widget.onTap();
      },
      behavior: HitTestBehavior.opaque,
      child: SizedBox(
        width: widget.size * 1.5,
        height: widget.size * 1.5,
        child: AnimatedBuilder(
          animation: _controller,
          builder: (context, child) {
            return Center(
              child: Transform.scale(
                scale: widget.isFavorite && _controller.isAnimating
                    ? _scaleAnimation.value
                    : 1.0,
                child: Icon(
                  widget.isFavorite ? Icons.favorite : Icons.favorite_border,
                  color: widget.isFavorite
                      ? const Color(0xFFED4956)
                      : Colors.grey[600], // Instagram Red & standard grey
                  size: widget.size,
                ),
              ),
            );
          },
        ),
      ),
    );
  }
}
