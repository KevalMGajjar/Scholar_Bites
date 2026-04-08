import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:flutter_animate/flutter_animate.dart';
import '../widgets/spoon_loader.dart';
import 'package:pinput/pinput.dart';
import '../utils/custom_toast.dart';
import '../widgets/primary_button.dart';
import '../services/auth_service.dart';
import 'home_screen.dart';

class OtpScreen extends StatefulWidget {
  final String phoneNumber;
  final String? username;
  
  const OtpScreen({
    super.key, 
    required this.phoneNumber, 
    this.username,
  });

  @override
  State<OtpScreen> createState() => _OtpScreenState();
}

class _OtpScreenState extends State<OtpScreen> {
  final _otpController = TextEditingController();
  final _otpFocusNode = FocusNode();
  bool _isLoading = false;

  @override
  void dispose() {
    _otpController.dispose();
    _otpFocusNode.dispose();
    super.dispose();
  }

  void _verifyOtp() async {
    final otp = _otpController.text;
    if (otp.length < 6) {
      CustomToast.showErrorToast(context, 'Please enter the complete 6-digit verification code.');
      return;
    }

    setState(() => _isLoading = true);
    
    // Simulate OTP verification delay
    await Future.delayed(const Duration(seconds: 1));
    
    if (!mounted) return;
    
    try {
      // Try to login — this works for both existing students and pre-created staff
      final existingUser = await AuthService.loginOtp(widget.phoneNumber);
      
      if (!mounted) return;

      if (existingUser != null) {
        // Returning user — welcome back and go home
        setState(() => _isLoading = false);
        CustomToast.showSuccessToast(context, 'Welcome back!');
        Navigator.pushAndRemoveUntil(
          context,
          MaterialPageRoute(builder: (context) => const HomeScreen()),
          (route) => false,
        );
      } else {
        // New user — register with optional username
        try {
          final newUser = await AuthService.registerOtp(
            phone: widget.phoneNumber,
            username: widget.username,
          );
          setState(() => _isLoading = false);
          
          if (newUser != null && mounted) {
            CustomToast.showSuccessToast(context, 'Account created successfully!');
            Navigator.pushAndRemoveUntil(
              context,
              MaterialPageRoute(builder: (context) => const HomeScreen()),
              (route) => false,
            );
          }
        } catch (regError) {
          setState(() => _isLoading = false);
          if (mounted) {
            CustomToast.showErrorToast(context, regError.toString().replaceAll('Exception: ', ''));
          }
        }
      }
    } catch (e) {
      final errorMessage = e.toString().replaceAll('Exception: ', '');
      
      // "User not found" means new user — register directly
      if (errorMessage.contains('User not found') || errorMessage.contains('404')) {
        try {
          final newUser = await AuthService.registerOtp(
            phone: widget.phoneNumber,
            username: widget.username,
          );
          setState(() => _isLoading = false);
          
          if (newUser != null && mounted) {
            CustomToast.showSuccessToast(context, 'Account created successfully!');
            Navigator.pushAndRemoveUntil(
              context,
              MaterialPageRoute(builder: (context) => const HomeScreen()),
              (route) => false,
            );
          }
        } catch (regError) {
          setState(() => _isLoading = false);
          if (mounted) {
            CustomToast.showErrorToast(context, regError.toString().replaceAll('Exception: ', ''));
          }
        }
        return;
      }
      
      setState(() => _isLoading = false);
      
      // Clear OTP so user can retry
      _otpController.clear();
      _otpFocusNode.requestFocus();
      
      if (mounted) {
        final isConnectionError = errorMessage.contains('connect') || 
            errorMessage.contains('SocketException') || 
            errorMessage.contains('Connection');
            
        final displayMessage = isConnectionError
              ? 'Unable to connect to server. Please check your connection.'
              : errorMessage.replaceAll('Exception: ', '');

        CustomToast.showErrorToast(context, displayMessage);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final defaultPinTheme = PinTheme(
      width: 56,
      height: 60,
      textStyle: GoogleFonts.poppins(
        fontSize: 22,
        color: const Color(0xFF4A0E13),
        fontWeight: FontWeight.w600,
      ),
      decoration: BoxDecoration(
        color: const Color(0xFFF4B3B3).withValues(alpha: 0.05),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFF8B1C28).withValues(alpha: 0.1), width: 1.5),
      ),
    );

    final focusedPinTheme = defaultPinTheme.copyWith(
      decoration: defaultPinTheme.decoration!.copyWith(
        color: const Color(0xFFF4B3B3).withValues(alpha: 0.15),
        border: Border.all(color: const Color(0xFF8B1C28).withValues(alpha: 0.5), width: 1.5),
        boxShadow: [
          BoxShadow(
            color: const Color(0xFF8B1C28).withValues(alpha: 0.2),
            blurRadius: 20,
            offset: const Offset(0, 5),
          )
        ]
      ),
    );

    return Scaffold(
      backgroundColor: const Color(0xFFFDF0F0),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.symmetric(horizontal: 24.0),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const SizedBox(height: 20),
              // Back Button
              IconButton(
                icon: const Icon(Icons.arrow_back_ios_rounded, color: Color(0xFF4A0E13)),
                onPressed: () => Navigator.pop(context),
              ).animate().fade().slideX(begin: -0.2, end: 0, curve: Curves.easeOutCubic),
              
              const SizedBox(height: 40),
              
              // Animated Graphic/Icon
              Center(
                child: Container(
                  width: 80,
                  height: 80,
                  decoration: BoxDecoration(
                    color: const Color(0xFFF4B3B3),
                    shape: BoxShape.circle,
                    border: Border.all(color: const Color(0xFF8B1C28).withValues(alpha: 0.3), width: 2),
                    boxShadow: [
                      BoxShadow(
                        color: const Color(0xFF8B1C28).withValues(alpha: 0.2),
                        blurRadius: 30,
                        offset: const Offset(0, 10),
                      ),
                    ],
                  ),
                  child: const Icon(Icons.password_rounded, color: Color(0xFF8B1C28), size: 40),
                ).animate()
                 .fade(duration: 600.ms)
                 .scaleXY(begin: 0.5, end: 1.0, curve: Curves.easeOutBack)
                 .shimmer(delay: 500.ms, duration: 1.seconds, color: const Color(0xFF8B1C28).withValues(alpha: 0.3)),
              ),
              
              const SizedBox(height: 40),
              
              Text(
                "Check your phone",
                style: GoogleFonts.poppins(
                  fontSize: 28,
                  fontWeight: FontWeight.bold,
                  color: const Color(0xFF4A0E13),
                ),
              ).animate().fade(delay: 200.ms, duration: 600.ms).slideY(begin: 0.2, end: 0, curve: Curves.easeOutCubic),
              const SizedBox(height: 8),
              RichText(
                text: TextSpan(
                  style: GoogleFonts.poppins(
                    fontSize: 16,
                    color: const Color(0xFF4A0E13).withValues(alpha: 0.7),
                    height: 1.5,
                  ),
                  children: [
                    const TextSpan(text: "We've sent a 6-digit verification code to\n"),
                    TextSpan(
                      text: widget.phoneNumber,
                      style: const TextStyle(
                        fontWeight: FontWeight.w600,
                        color: Color(0xFF4A0E13),
                      ),
                    ),
                  ],
                ),
              ).animate().fade(delay: 400.ms, duration: 600.ms).slideY(begin: 0.2, end: 0, curve: Curves.easeOutCubic),
              
              const SizedBox(height: 40),
              
              Center(
                child: Pinput(
                  length: 6,
                  controller: _otpController,
                  focusNode: _otpFocusNode,
                  defaultPinTheme: defaultPinTheme,
                  focusedPinTheme: focusedPinTheme,
                  showCursor: true,
                  cursor: Container(
                    width: 2,
                    height: 24,
                    color: const Color(0xFF8B1C28),
                    margin: const EdgeInsets.only(bottom: 8),
                  ),
                  onCompleted: (pin) => _verifyOtp(),
                ),
              ).animate().fade(delay: 600.ms, duration: 600.ms).slideX(begin: -0.1, end: 0, curve: Curves.easeOutCubic),
              
              const SizedBox(height: 40),
              
              _isLoading
                  ? Center(
                      child: SpoonLoader(size: 50),
                    )
                  : PrimaryButton(
                      text: 'Verify',
                      onTap: _verifyOtp,
                    ).animate().fade(delay: 800.ms, duration: 600.ms).scaleXY(begin: 0.9, end: 1.0, curve: Curves.easeOutBack),
                    
              const SizedBox(height: 24),
              
              Center(
                child: TextButton(
                  onPressed: () {
                    // Resend logic
                  },
                  child: Text(
                    "Didn't get the code? Resend",
                    style: GoogleFonts.poppins(
                      color: const Color(0xFF8B1C28),
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ),
              ).animate().fade(delay: 1000.ms, duration: 600.ms),
            ],
          ),
        ),
      ),
    );
  }
}

