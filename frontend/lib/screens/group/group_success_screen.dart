import 'dart:async';
import 'dart:math';
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_fortune_wheel/flutter_fortune_wheel.dart';
import '../home_screen.dart';

class GroupSuccessScreen extends StatefulWidget {
  final String groupCode;
  final List<Map<String, dynamic>> members;
  final String pickupRestaurant;
  final String orderToken;

  const GroupSuccessScreen({
    super.key,
    required this.groupCode,
    required this.members,
    required this.pickupRestaurant,
    required this.orderToken,
  });

  @override
  State<GroupSuccessScreen> createState() => _GroupSuccessScreenState();
}

class _GroupSuccessScreenState extends State<GroupSuccessScreen> {
  static const _maroon = Color(0xFF8B1C28);
  static const _darkText = Color(0xFF4A0E13);
  static const _bg = Color(0xFFFCF9F5);

  final StreamController<int> _selectedController = StreamController<int>();
  bool _hasSpun = false;
  String? _selectedMember;
  bool _isSpinning = false;

  static const _wheelColors = [
    Color(0xFF8B1C28), Color(0xFF4CAF50), Color(0xFF2196F3),
    Color(0xFFFF9800), Color(0xFF9C27B0), Color(0xFFE91E63),
    Color(0xFF00BCD4), Color(0xFFFF5722),
  ];

  @override
  void dispose() {
    _selectedController.close();
    super.dispose();
  }

  void _spinWheel() {
    if (_isSpinning) return;

    setState(() => _isSpinning = true);

    final memberCount = widget.members.isNotEmpty ? widget.members.length : 1;
    final displayCount = memberCount == 1 ? 2 : memberCount; // Wheel needs min 2 items

    final random = Random();
    final selectedIdx = random.nextInt(displayCount);
    _selectedController.add(selectedIdx);

    // After animation
    Future.delayed(const Duration(seconds: 4), () {
      if (mounted) {
        setState(() {
          _hasSpun = true;
          _isSpinning = false;
          if (widget.members.isNotEmpty) {
            final realIdx = selectedIdx % widget.members.length;
            _selectedMember = widget.members[realIdx]['nickname'] ?? 'Member';
          } else {
            _selectedMember = 'Member';
          }
        });
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    var memberNames = widget.members.map((m) => m['nickname']?.toString() ?? 'Member').toList();
    if (memberNames.isEmpty) memberNames = ['Member'];
    
    // FortuneWheel needs at least 2 items to render 
    final displayNames = memberNames.length == 1 
        ? [memberNames[0], memberNames[0]] 
        : memberNames;

    return Scaffold(
      backgroundColor: _bg,
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.symmetric(horizontal: 24),
          child: Column(
            children: [
              const SizedBox(height: 30),

              // Success header
              const Text('🎉', style: TextStyle(fontSize: 56))
                  .animate().scaleXY(begin: 0, end: 1, curve: Curves.elasticOut, duration: 800.ms),

              const SizedBox(height: 12),

              Text(
                'Order Placed!',
                style: GoogleFonts.poppins(fontSize: 28, fontWeight: FontWeight.w900, color: _darkText),
              ).animate().fadeIn(delay: 300.ms),

              const SizedBox(height: 8),

              // Order token
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 10),
                decoration: BoxDecoration(
                  color: _maroon.withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(14),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text('Order Token: ', style: GoogleFonts.poppins(fontSize: 14, color: _darkText.withValues(alpha: 0.6))),
                    Text(
                      widget.orderToken,
                      style: GoogleFonts.poppins(fontSize: 20, fontWeight: FontWeight.w900, color: _maroon, letterSpacing: 4),
                    ),
                  ],
                ),
              ).animate().fadeIn(delay: 400.ms),

              const SizedBox(height: 6),

              Text(
                'Pick up from ${widget.pickupRestaurant}',
                style: GoogleFonts.poppins(fontSize: 14, color: _darkText.withValues(alpha: 0.5), fontWeight: FontWeight.w600),
              ).animate().fadeIn(delay: 500.ms),

              const SizedBox(height: 30),

              // Roulette section
              Text(
                'Who picks up the order?',
                style: GoogleFonts.poppins(fontSize: 18, fontWeight: FontWeight.w800, color: _darkText),
              ).animate().fadeIn(delay: 600.ms),

              const SizedBox(height: 4),

              Text(
                'Spin the wheel to decide!',
                style: GoogleFonts.poppins(fontSize: 14, color: _darkText.withValues(alpha: 0.5)),
              ).animate().fadeIn(delay: 700.ms),

              const SizedBox(height: 20),

              // Fortune Wheel
              if (displayNames.isNotEmpty)
                SizedBox(
                  height: 300,
                  child: FortuneWheel(
                    selected: _selectedController.stream,
                    animateFirst: false,
                    physics: CircularPanPhysics(
                      duration: const Duration(seconds: 3),
                      curve: Curves.decelerate,
                    ),
                    indicators: const [
                      FortuneIndicator(
                        alignment: Alignment.topCenter,
                        child: TriangleIndicator(color: _maroon),
                      ),
                    ],
                    items: [
                      for (int i = 0; i < displayNames.length; i++)
                        FortuneItem(
                          child: Padding(
                            padding: const EdgeInsets.symmetric(horizontal: 8),
                            child: Text(
                              displayNames[i],
                              style: GoogleFonts.poppins(
                                fontWeight: FontWeight.w700,
                                fontSize: 13,
                                color: Colors.white,
                              ),
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                            ),
                          ),
                          style: FortuneItemStyle(
                            color: _wheelColors[i % _wheelColors.length],
                            borderColor: Colors.white,
                            borderWidth: 2,
                          ),
                        ),
                    ],
                  ),
                ).animate().fadeIn(delay: 800.ms).scaleXY(begin: 0.8),

              const SizedBox(height: 20),

              // Spin button or result
              if (_hasSpun && _selectedMember != null)
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.all(20),
                  decoration: BoxDecoration(
                    gradient: LinearGradient(
                      colors: [_maroon.withValues(alpha: 0.1), _maroon.withValues(alpha: 0.04)],
                    ),
                    borderRadius: BorderRadius.circular(20),
                    border: Border.all(color: _maroon.withValues(alpha: 0.2)),
                  ),
                  child: Column(
                    children: [
                      const Text('🏃', style: TextStyle(fontSize: 40)),
                      const SizedBox(height: 8),
                      Text(
                        '$_selectedMember will pick up!',
                        style: GoogleFonts.poppins(fontSize: 20, fontWeight: FontWeight.w900, color: _maroon),
                        textAlign: TextAlign.center,
                      ),
                      const SizedBox(height: 4),
                      Text(
                        'Time to go grab those goodies! 🎉',
                        style: GoogleFonts.poppins(fontSize: 14, color: _darkText.withValues(alpha: 0.5)),
                      ),
                    ],
                  ),
                ).animate().fadeIn().scaleXY(begin: 0.9, curve: Curves.elasticOut, duration: 800.ms)
              else
                GestureDetector(
                  onTap: _isSpinning ? null : _spinWheel,
                  child: Container(
                    width: double.infinity,
                    padding: const EdgeInsets.symmetric(vertical: 18),
                    decoration: BoxDecoration(
                      gradient: _isSpinning
                          ? LinearGradient(colors: [_maroon.withValues(alpha: 0.5), const Color(0xFFB52A3A).withValues(alpha: 0.5)])
                          : const LinearGradient(colors: [_maroon, Color(0xFFB52A3A)]),
                      borderRadius: BorderRadius.circular(18),
                      boxShadow: [BoxShadow(color: _maroon.withValues(alpha: 0.35), blurRadius: 20, offset: const Offset(0, 8))],
                    ),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Icon(_isSpinning ? Icons.hourglass_empty_rounded : Icons.casino_rounded, color: Colors.white, size: 22),
                        const SizedBox(width: 10),
                        Text(
                          _isSpinning ? 'Spinning...' : '🎰 Spin the Wheel!',
                          style: GoogleFonts.poppins(color: Colors.white, fontSize: 16, fontWeight: FontWeight.w700),
                        ),
                      ],
                    ),
                  ),
                ).animate().fadeIn(delay: 900.ms),

              const SizedBox(height: 24),

              // Done button
              GestureDetector(
                onTap: () {
                  Navigator.pushAndRemoveUntil(
                    context,
                    MaterialPageRoute(builder: (_) => const HomeScreen()),
                    (route) => false,
                  );
                },
                child: Container(
                  width: double.infinity,
                  padding: const EdgeInsets.symmetric(vertical: 16),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(color: _maroon.withValues(alpha: 0.15)),
                  ),
                  child: Center(
                    child: Text('Done — Go Home', style: GoogleFonts.poppins(color: _maroon, fontSize: 15, fontWeight: FontWeight.w700)),
                  ),
                ),
              ),

              const SizedBox(height: 30),
            ],
          ),
        ),
      ),
    );
  }
}
