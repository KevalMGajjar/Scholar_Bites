import 'dart:math';
import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:lottie/lottie.dart';
import 'package:qr_flutter/qr_flutter.dart';
import 'multi_qr_screen.dart';

class OrderSuccessScreen extends StatefulWidget {
  final String orderId;
  final double amount;
  final String orderToken;
  final String restaurantName;

  const OrderSuccessScreen({
    super.key,
    required this.orderId,
    required this.amount,
    this.orderToken = '',
    this.restaurantName = 'the counter',
  });

  @override
  State<OrderSuccessScreen> createState() => _OrderSuccessScreenState();
}

class _OrderSuccessScreenState extends State<OrderSuccessScreen>
    with TickerProviderStateMixin {
  static const _maroon = Color(0xFF8B1C28);
  static const _darkText = Color(0xFF4A0E13);

  late AnimationController _confettiController;
  late List<_ConfettiParticle> _particles;
  final _random = Random();

  @override
  void initState() {
    super.initState();
    _confettiController = AnimationController(
      vsync: this,
      duration: const Duration(seconds: 4),
    );
    _particles = List.generate(60, (_) => _ConfettiParticle(_random));
    _confettiController.forward();
  }

  @override
  void dispose() {
    _confettiController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return PopScope(
      canPop: false,
      child: Scaffold(
        backgroundColor: const Color(0xFFFCF9F5),
        body: Stack(
          children: [
            // Confetti overlay
            AnimatedBuilder(
              animation: _confettiController,
              builder: (context, child) {
                return CustomPaint(
                  painter: _ConfettiPainter(
                    particles: _particles,
                    progress: _confettiController.value,
                  ),
                  size: MediaQuery.of(context).size,
                );
              },
            ),

            // Main content
            SafeArea(
              child: Center(
                child: SingleChildScrollView(
                  padding: const EdgeInsets.symmetric(horizontal: 32),
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      const SizedBox(height: 40),

                      // Lottie animation — place your file at assets/lottie/order_success.json
                      SizedBox(
                        width: 200,
                        height: 200,
                        child: Lottie.asset(
                          'assets/lottie/order_success.json',
                          repeat: true,
                          animate: true,
                          errorBuilder: (context, error, stackTrace) {
                            // Fallback if Lottie file is missing
                            return Container(
                              width: 120,
                              height: 120,
                              decoration: BoxDecoration(
                                gradient: const LinearGradient(
                                  begin: Alignment.topLeft,
                                  end: Alignment.bottomRight,
                                  colors: [Color(0xFF27AE60), Color(0xFF2ECC71)],
                                ),
                                shape: BoxShape.circle,
                                boxShadow: [
                                  BoxShadow(
                                    color: const Color(0xFF27AE60).withValues(alpha: 0.4),
                                    blurRadius: 30,
                                    spreadRadius: 5,
                                  ),
                                ],
                              ),
                              child: const Icon(
                                Icons.check_rounded,
                                color: Colors.white,
                                size: 60,
                              ),
                            );
                          },
                        ),
                      )
                          .animate()
                          .scale(
                            begin: const Offset(0, 0),
                            end: const Offset(1, 1),
                            duration: 600.ms,
                            curve: Curves.elasticOut,
                          )
                          .fadeIn(duration: 300.ms),

                      const SizedBox(height: 24),

                      // Title
                      const Text(
                        'Order Placed!',
                        style: TextStyle(
                          fontSize: 28,
                          fontWeight: FontWeight.w900,
                          color: _darkText,
                        ),
                      ).animate().fadeIn(delay: 400.ms, duration: 400.ms).slideY(begin: 0.3),

                      const SizedBox(height: 12),

                      Text(
                        'Your delicious food is being prepared!',
                        textAlign: TextAlign.center,
                        style: TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.w500,
                          color: _darkText.withValues(alpha: 0.6),
                        ),
                      ).animate().fadeIn(delay: 600.ms, duration: 400.ms),

                      const SizedBox(height: 32),

                      // Food preparing Lottie — place your file at assets/lottie/food_preparing.json
                      Container(
                        padding: const EdgeInsets.all(24),
                        decoration: BoxDecoration(
                          color: Colors.white,
                          borderRadius: BorderRadius.circular(28),
                          boxShadow: [
                            BoxShadow(
                              color: Colors.black.withValues(alpha: 0.04),
                              blurRadius: 20,
                              offset: const Offset(0, 8),
                            ),
                          ],
                        ),
                        child: Column(
                          children: [
                            // Lottie food preparing animation
                            SizedBox(
                              height: 140,
                              child: Lottie.asset(
                                'assets/lottie/food_preparing.json',
                                repeat: true,
                                animate: true,
                                errorBuilder: (context, error, stackTrace) {
                                  // Fallback if Lottie file is missing
                                  return Row(
                                    mainAxisAlignment: MainAxisAlignment.center,
                                    children: [
                                      _buildFallbackIcon(Icons.egg_alt_rounded, 0),
                                      const SizedBox(width: 20),
                                      _buildFallbackIcon(Icons.restaurant_rounded, 200),
                                      const SizedBox(width: 20),
                                      _buildFallbackIcon(Icons.dinner_dining_rounded, 400),
                                    ],
                                  );
                                },
                              ),
                            ),
                            const SizedBox(height: 16),

                            // Progress steps
                            _buildProgressStep('Order Confirmed', true, 0),
                            _buildProgressConnector(),
                            _buildProgressStep('Preparing Your Food', true, 200),
                            _buildProgressConnector(),
                            _buildProgressStep('Almost Ready!', false, 400),

                            const SizedBox(height: 20),

                            // Order details row
                            Container(
                              padding: const EdgeInsets.all(16),
                              decoration: BoxDecoration(
                                color: _maroon.withValues(alpha: 0.05),
                                borderRadius: BorderRadius.circular(16),
                              ),
                              child: Row(
                                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                children: [
                                  Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      Text(
                                        'Order ID',
                                        style: TextStyle(
                                          fontSize: 12,
                                          fontWeight: FontWeight.w500,
                                          color: _darkText.withValues(alpha: 0.5),
                                        ),
                                      ),
                                      const SizedBox(height: 4),
                                      Text(
                                        '#${widget.orderId.length > 12 ? widget.orderId.substring(widget.orderId.length - 8) : widget.orderId}',
                                        style: const TextStyle(
                                          fontSize: 14,
                                          fontWeight: FontWeight.w800,
                                          color: _darkText,
                                        ),
                                      ),
                                    ],
                                  ),
                                  Column(
                                    crossAxisAlignment: CrossAxisAlignment.end,
                                    children: [
                                      Text(
                                        'Amount Paid',
                                        style: TextStyle(
                                          fontSize: 12,
                                          fontWeight: FontWeight.w500,
                                          color: _darkText.withValues(alpha: 0.5),
                                        ),
                                      ),
                                      const SizedBox(height: 4),
                                      Text(
                                        '\u{20B9}${widget.amount.toStringAsFixed(0)}',
                                        style: const TextStyle(
                                          fontSize: 18,
                                          fontWeight: FontWeight.w900,
                                          color: _maroon,
                                        ),
                                      ),
                                    ],
                                  ),
                                ],
                              ),
                            ),
                          ],
                        ),
                      ).animate().fadeIn(delay: 800.ms, duration: 500.ms).slideY(begin: 0.2),

                      // QR Code section
                      if (widget.orderToken.isNotEmpty) ...[
                        const SizedBox(height: 24),
                        Container(
                          padding: const EdgeInsets.all(24),
                          decoration: BoxDecoration(
                            color: Colors.white,
                            borderRadius: BorderRadius.circular(28),
                            boxShadow: [
                              BoxShadow(
                                color: _maroon.withValues(alpha: 0.06),
                                blurRadius: 24,
                                offset: const Offset(0, 8),
                              ),
                            ],
                          ),
                          child: Column(
                            children: [
                              Text(
                                'Your Pickup Token',
                                style: TextStyle(
                                  fontSize: 13,
                                  fontWeight: FontWeight.w600,
                                  color: _darkText.withValues(alpha: 0.5),
                                ),
                              ),
                              const SizedBox(height: 12),
                              Text(
                                '#${widget.orderToken}',
                                style: const TextStyle(
                                  fontSize: 36,
                                  fontWeight: FontWeight.w900,
                                  color: _maroon,
                                  letterSpacing: 6,
                                ),
                              ),
                              const SizedBox(height: 16),
                              QrImageView(
                                data: widget.orderToken,
                                version: QrVersions.auto,
                                size: 140,
                                eyeStyle: const QrEyeStyle(
                                  eyeShape: QrEyeShape.square,
                                  color: _darkText,
                                ),
                                dataModuleStyle: const QrDataModuleStyle(
                                  dataModuleShape: QrDataModuleShape.square,
                                  color: _darkText,
                                ),
                              ),
                              const SizedBox(height: 16),
                              SizedBox(
                                width: double.infinity,
                                height: 48,
                                child: OutlinedButton.icon(
                                  onPressed: () {
                                    Navigator.push(
                                      context,
                                      MaterialPageRoute(
                                        builder: (_) => MultiQrScreen(
                                          batchId: widget.orderId,
                                          subOrders: [
                                            {
                                              'id': widget.orderId,
                                              'status': 'preparing',
                                              'total_amount': widget.amount,
                                              'restaurant_name': widget.restaurantName,
                                              'order_token': widget.orderToken,
                                            }
                                          ],
                                        ),
                                      ),
                                    );
                                  },
                                  icon: const Icon(Icons.qr_code_2_rounded, size: 20),
                                  label: const Text(
                                    'Show QR at Counter',
                                    style: TextStyle(fontWeight: FontWeight.w700),
                                  ),
                                  style: OutlinedButton.styleFrom(
                                    foregroundColor: _maroon,
                                    side: BorderSide(color: _maroon.withValues(alpha: 0.3)),
                                    shape: RoundedRectangleBorder(
                                      borderRadius: BorderRadius.circular(16),
                                    ),
                                  ),
                                ),
                              ),
                            ],
                          ),
                        ).animate().fadeIn(delay: 1000.ms, duration: 400.ms).slideY(begin: 0.2),
                      ],

                      const SizedBox(height: 40),

                      // Continue Browsing button
                      SizedBox(
                        width: double.infinity,
                        height: 58,
                        child: ElevatedButton(
                          onPressed: () {
                            Navigator.of(context).popUntil((route) => route.isFirst);
                          },
                          style: ElevatedButton.styleFrom(
                            backgroundColor: _maroon,
                            foregroundColor: Colors.white,
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(22),
                            ),
                            elevation: 8,
                            shadowColor: _maroon.withValues(alpha: 0.5),
                          ),
                          child: const Row(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              Icon(Icons.restaurant_menu_rounded, size: 22),
                              SizedBox(width: 10),
                              Text(
                                'Continue Browsing',
                                style: TextStyle(
                                  fontSize: 18,
                                  fontWeight: FontWeight.w800,
                                  letterSpacing: 0.5,
                                ),
                              ),
                            ],
                          ),
                        ),
                      )
                          .animate()
                          .fadeIn(delay: 1200.ms, duration: 400.ms)
                          .slideY(begin: 0.3),

                      const SizedBox(height: 40),
                    ],
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildFallbackIcon(IconData iconData, int delayMs) {
    return Container(
      width: 56,
      height: 56,
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [
            _maroon.withValues(alpha: 0.12),
            _maroon.withValues(alpha: 0.04),
          ],
        ),
        borderRadius: BorderRadius.circular(16),
      ),
      child: Icon(iconData, size: 28, color: _maroon),
    )
        .animate(onPlay: (c) => c.repeat(reverse: true))
        .scaleXY(
          begin: 1.0,
          end: 1.2,
          delay: delayMs.ms,
          duration: 800.ms,
          curve: Curves.easeInOut,
        );
  }

  Widget _buildProgressStep(String label, bool isCompleted, int delayMs) {
    return Row(
      children: [
        Container(
          width: 28,
          height: 28,
          decoration: BoxDecoration(
            color: isCompleted ? const Color(0xFF27AE60) : Colors.grey.shade200,
            shape: BoxShape.circle,
          ),
          child: isCompleted
              ? const Icon(Icons.check, color: Colors.white, size: 16)
              : Container(
                  margin: const EdgeInsets.all(8),
                  decoration: BoxDecoration(
                    color: _maroon.withValues(alpha: 0.3),
                    shape: BoxShape.circle,
                  ),
                ),
        ),
        const SizedBox(width: 12),
        Text(
          label,
          style: TextStyle(
            fontSize: 14,
            fontWeight: isCompleted ? FontWeight.w700 : FontWeight.w500,
            color: isCompleted ? _darkText : _darkText.withValues(alpha: 0.4),
          ),
        ),
      ],
    ).animate().fadeIn(delay: (800 + delayMs).ms, duration: 300.ms);
  }

  Widget _buildProgressConnector() {
    return Container(
      margin: const EdgeInsets.only(left: 13),
      width: 2,
      height: 20,
      color: const Color(0xFF27AE60).withValues(alpha: 0.3),
    );
  }
}

// ─── Confetti ─────────────────────────────────────
class _ConfettiParticle {
  late double x, speed, size;
  late Color color;
  late int shape; // 0=circle, 1=rect, 2=triangle

  _ConfettiParticle(Random r) {
    x = r.nextDouble();
    speed = 0.3 + r.nextDouble() * 0.7;
    size = 4 + r.nextDouble() * 8;
    shape = r.nextInt(3);
    color = [
      const Color(0xFF8B1C28),
      const Color(0xFFE74C3C),
      const Color(0xFFF39C12),
      const Color(0xFF27AE60),
      const Color(0xFF3498DB),
      const Color(0xFF9B59B6),
      const Color(0xFFE91E63),
      const Color(0xFFFF9800),
    ][r.nextInt(8)];
  }
}

class _ConfettiPainter extends CustomPainter {
  final List<_ConfettiParticle> particles;
  final double progress;

  _ConfettiPainter({required this.particles, required this.progress});

  @override
  void paint(Canvas canvas, Size size) {
    final opacity = (1.0 - progress).clamp(0.0, 1.0);
    if (opacity <= 0) return;

    for (var p in particles) {
      final paint = Paint()..color = p.color.withValues(alpha: opacity * 0.8);
      final x = p.x * size.width;
      final y = -20 + (size.height + 40) * progress * p.speed;
      final wobble = sin(progress * 10 + p.x * 20) * 20;

      canvas.save();
      canvas.translate(x + wobble, y);
      canvas.rotate(progress * 6 * p.speed);

      if (p.shape == 0) {
        canvas.drawCircle(Offset.zero, p.size / 2, paint);
      } else if (p.shape == 1) {
        canvas.drawRect(
          Rect.fromCenter(center: Offset.zero, width: p.size, height: p.size * 0.6),
          paint,
        );
      } else {
        final path = Path()
          ..moveTo(0, -p.size / 2)
          ..lineTo(p.size / 2, p.size / 2)
          ..lineTo(-p.size / 2, p.size / 2)
          ..close();
        canvas.drawPath(path, paint);
      }

      canvas.restore();
    }
  }

  @override
  bool shouldRepaint(covariant _ConfettiPainter old) => old.progress != progress;
}
