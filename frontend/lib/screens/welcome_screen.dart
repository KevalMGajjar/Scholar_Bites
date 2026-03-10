import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'dart:ui';
import 'package:flutter_animate/flutter_animate.dart';
import '../widgets/primary_button.dart';
import 'phone_screen.dart';
class WelcomeScreen extends StatelessWidget {
  const WelcomeScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Stack(
        children: [
          // Background Gradient / Pattern
          Container(
            decoration: const BoxDecoration(
              gradient: LinearGradient(
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
                colors: [
                  Color(0xFFFDF0F0),
                  Color(0xFFF4B3B3), // Peach/Light Pink accent
                ],
              ),
            ),
          ),
          
          // Floating Shapes for native Vibe
          Positioned(
            top: -50,
            right: -50,
            child: Container(
              width: 200,
              height: 200,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: const Color(0xFF8B1C28).withValues(alpha: 0.1),
              ),
              child: BackdropFilter(
                filter: ImageFilter.blur(sigmaX: 50, sigmaY: 50),
                child: Container(color: Colors.transparent),
              ),
            ).animate(onPlay: (controller) => controller.repeat())
             .move(duration: 4.seconds, curve: Curves.easeInOutSine, begin: const Offset(0, -20), end: const Offset(0, 20)),
          ),
          Positioned(
            bottom: 100,
            left: -80,
            child: Container(
              width: 250,
              height: 250,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: const Color(0xFFF4B3B3).withValues(alpha: 0.3),
              ),
              child: BackdropFilter(
                filter: ImageFilter.blur(sigmaX: 60, sigmaY: 60),
                child: Container(color: Colors.transparent),
              ),
            ).animate(onPlay: (controller) => controller.repeat(reverse: true))
             .move(duration: 5.seconds, curve: Curves.easeInOut, begin: const Offset(-20, 0), end: const Offset(20, 0)),
          ),

          SafeArea(
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 24.0, vertical: 40.0),
              child: Column(
                mainAxisAlignment: MainAxisAlignment.end,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Icon
                  Container(
                    width: 70,
                    height: 70,
                    decoration: BoxDecoration(
                      color: const Color(0xFF8B1C28),
                      borderRadius: BorderRadius.circular(20),
                      boxShadow: [
                        BoxShadow(
                          color: const Color(0xFF8B1C28).withValues(alpha: 0.3),
                          blurRadius: 30,
                          offset: const Offset(0, 15),
                        ),
                      ],
                    ),
                    child: const Icon(
                      Icons.restaurant_menu_rounded,
                      color: Colors.white,
                      size: 36,
                    ),
                  ).animate()
                   .fade(duration: 600.ms, curve: Curves.easeOut)
                   .slideY(begin: 0.5, end: 0, curve: Curves.easeOutBack, duration: 600.ms)
                   .shimmer(delay: 1.seconds, duration: 1000.ms, color: Colors.white54),
                  const SizedBox(height: 32),
                  
                  Text(
                    'Your Campus Canteen, In Your Hands.',
                    style: GoogleFonts.poppins(
                      fontSize: 42,
                      fontWeight: FontWeight.w800,
                      color: const Color(0xFF4A0E13),
                      height: 1.1,
                    ),
                  ).animate().fade(delay: 200.ms, duration: 600.ms).slideY(begin: 0.2, end: 0, curve: Curves.easeOutCubic),
                  const SizedBox(height: 16),
                  Text(
                    'Skip the queue, browse the menu, and order from your university canteen — all in one tap.',
                    style: GoogleFonts.poppins(
                      fontSize: 16,
                      color: const Color(0xFF4A0E13).withValues(alpha: 0.7),
                      height: 1.5,
                    ),
                  ).animate().fade(delay: 400.ms, duration: 600.ms).slideY(begin: 0.2, end: 0, curve: Curves.easeOutCubic),
                  const SizedBox(height: 48),

                  // Actions
                  PrimaryButton(
                    text: 'Get Started',
                    onTap: () {
                      Navigator.push(
                        context,
                        MaterialPageRoute(builder: (context) => const PhoneScreen()),
                      );
                    },
                  ).animate().fade(delay: 600.ms, duration: 600.ms).scaleXY(begin: 0.9, end: 1.0, curve: Curves.easeOutBack),
                  const SizedBox(height: 16),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}
