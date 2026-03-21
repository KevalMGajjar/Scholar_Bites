import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'dart:math' as math;
import '../services/auth_service.dart';
import 'welcome_screen.dart';
import 'home_screen.dart';

class SplashScreen extends StatefulWidget {
  const SplashScreen({super.key});

  @override
  State<SplashScreen> createState() => _SplashScreenState();
}

class _SplashScreenState extends State<SplashScreen>
    with TickerProviderStateMixin {
  late AnimationController _mainController;
  late AnimationController _pulseController;

  // Animation Sequences
  late Animation<double> _logoSlideY;
  late Animation<double> _logoScale;
  late Animation<double> _iconRotation;
  late Animation<double> _textOpacity;
  late Animation<double> _textSlideY;
  late Animation<double> _expandScale;
  late Animation<double> _contentFadeOut;

  @override
  void initState() {
    super.initState();

    // Main Orchestrator
    _mainController = AnimationController(
      vsync: this,
      duration: const Duration(seconds: 3),
    );

    // Subtle Pulse for waiting phase
    _pulseController = AnimationController(
      vsync: this,
      duration: const Duration(seconds: 2),
    )..repeat(reverse: true);

    // 1. Logo Drop In (Elastic/Bounce) - 0.0 to 0.4
    // Start from -800 (off-screen) to 0 (center)
    _logoSlideY = Tween<double>(begin: -800.0, end: 0.0).animate(
      CurvedAnimation(
        parent: _mainController,
        // Use bounceOut for a physical drop feel, or elasticOut for rubbery feel
        curve: const Interval(0.0, 0.4, curve: Curves.bounceOut),
      ),
    );

    _logoScale = Tween<double>(begin: 0.0, end: 1.0).animate(
      CurvedAnimation(
        parent: _mainController,
        curve: const Interval(0.0, 0.4, curve: Curves.elasticOut),
      ),
    );

    // 2. Text Reveal (Staggered) - 0.3 to 0.6
    _textOpacity = Tween<double>(begin: 0.0, end: 1.0).animate(
      CurvedAnimation(
        parent: _mainController,
        curve: const Interval(0.3, 0.5, curve: Curves.easeIn),
      ),
    );

    _textSlideY = Tween<double>(begin: 20.0, end: 0.0).animate(
      CurvedAnimation(
        parent: _mainController,
        curve: const Interval(0.3, 0.5, curve: Curves.easeOutCubic),
      ),
    );

    // 3. Anticipation & Exit - 0.7 to 1.0
    // Rotate icon slightly before expanding
    _iconRotation = Tween<double>(begin: 0.0, end: -0.2).animate(
      CurvedAnimation(
        parent: _mainController,
        curve: const Interval(0.6, 0.7, curve: Curves.easeInBack),
      ),
    );

    // Massive Expansion
    _expandScale = Tween<double>(begin: 1.0, end: 35.0).animate(
      CurvedAnimation(
        parent: _mainController,
        curve: const Interval(0.7, 1.0, curve: Curves.easeInOutQuart),
      ),
    );

    // Fade out text/icon content during expansion so we just have a color fill
    _contentFadeOut = Tween<double>(begin: 1.0, end: 0.0).animate(
      CurvedAnimation(
        parent: _mainController,
        curve: const Interval(0.7, 0.8, curve: Curves.easeOut),
      ),
    );

    // Start everything after a delay to ensure native splash is gone
    Future.delayed(const Duration(milliseconds: 500), () {
      if (mounted) {
        _mainController.forward();
      }
    });

    _mainController.addStatusListener((status) {
      if (status == AnimationStatus.completed) {
        _navigateToNext();
      }
    });
  }

  void _navigateToNext() {
    final cachedUser = AuthService.getCachedUser();
    final Widget destination =
        cachedUser != null ? const HomeScreen() : const WelcomeScreen();

    Navigator.of(context).pushReplacement(
      PageRouteBuilder(
        pageBuilder: (context, animation, secondaryAnimation) => destination,
        transitionsBuilder: (context, animation, secondaryAnimation, child) {
          return FadeTransition(opacity: animation, child: child);
        },
        transitionDuration: const Duration(milliseconds: 800),
      ),
    );
  }

  @override
  void dispose() {
    _mainController.dispose();
    _pulseController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFFDF0F0),
      body: AnimatedBuilder(
        animation: Listenable.merge([_mainController, _pulseController]),
        builder: (context, child) {
          // Determine which scale to use: Entrance or Exit
          // If we are in the exit phase (timeline > 0.7), we use the expandScale
          // But we effectively want to multiply the pulse effect if we are in the middle phase.

          double scale = _logoScale.value;
          if (_mainController.value >= 0.7) {
            scale = _expandScale.value;
          } else if (_mainController.value > 0.4) {
            // Add subtle heartbeat in the middle phase
            scale += (_pulseController.value * 0.05);
          }

          return Stack(
            children: [
              // 1. The Main Circular Reveal
              Center(
                child: Transform.translate(
                  offset: Offset(0, _logoSlideY.value),
                  child: Transform.scale(
                    scale: scale,
                    child: Container(
                      width: 100,
                      height: 100,
                      decoration: const BoxDecoration(
                        shape: BoxShape.circle,
                        color: Color(0xFF8B1C28),
                        boxShadow: [
                          BoxShadow(
                            color: Color(0x668B1C28),
                            blurRadius: 30,
                            spreadRadius: 10,
                          ),
                        ],
                      ),
                      child: Center(
                        child: Opacity(
                          opacity: _contentFadeOut.value,
                          child: Transform.rotate(
                            angle:
                                _iconRotation.value * (math.pi * 2), // Radians
                            child: ClipOval(
                              child: Image.asset(
                                'assets/icon/app_icon_maroon.png',
                                width: 80,
                                height: 80,
                                fit: BoxFit.cover,
                                errorBuilder: (context, error, stackTrace) {
                                  return const Icon(
                                    Icons.error_outline, // Fallback icon
                                    color: Colors.white,
                                    size: 50,
                                  );
                                },
                              ),
                            ),
                          ),
                        ),
                      ),
                    ),
                  ),
                ),
              ),

              // 2. Ripple Effects (Only visible in middle phase)
              if (_mainController.value > 0.4 && _mainController.value < 0.7)
                Center(
                  child: IgnorePointer(
                    child: ScaleTransition(
                      scale: Tween(
                        begin: 1.0,
                        end: 1.5,
                      ).animate(_pulseController),
                      child: Container(
                        width: 100,
                        height: 100,
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          border: Border.all(
                            color: const Color(
                              0xFF8B1C28,
                            ).withValues(
                                alpha: 0.3 * (1 - _pulseController.value)),
                            width: 2,
                          ),
                        ),
                      ),
                    ),
                  ),
                ),

              // 3. Text Elements (Independent of scale to avoid expansion distortion)
              Positioned(
                left: 0,
                right: 0,
                top: MediaQuery.of(context).size.height / 2 + 80,
                child: Transform.translate(
                  offset: Offset(0, _textSlideY.value),
                  child: Opacity(
                    opacity: _textOpacity.value * _contentFadeOut.value,
                    child: Column(
                      children: [
                        Text(
                          'Scholar Bites',
                          style: GoogleFonts.poppins(
                            fontSize: 36,
                            fontWeight: FontWeight.w800,
                            color: Color(0xFF4A0E13),
                            letterSpacing: 1.5,
                          ),
                        ),
                        const SizedBox(height: 12),
                        Row(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Container(
                              width: 30,
                              height: 2,
                              color: const Color(0xFF8B1C28),
                            ),
                            const SizedBox(width: 10),
                            Text(
                              'PREMIUM TASTE',
                              style: GoogleFonts.poppins(
                                fontSize: 12,
                                fontWeight: FontWeight.bold,
                                color: Color(0xFF8B1C28).withValues(alpha: 0.9),
                                letterSpacing: 2.0,
                              ),
                            ),
                            const SizedBox(width: 10),
                            Container(
                              width: 30,
                              height: 2,
                              color: const Color(0xFF8B1C28),
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ],
          );
        },
      ),
    );
  }
}
