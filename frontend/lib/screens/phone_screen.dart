import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:flutter_animate/flutter_animate.dart';
import '../widgets/spoon_loader.dart';
import '../widgets/primary_button.dart';
import '../widgets/custom_text_field.dart';
import '../utils/custom_toast.dart';
import 'otp_screen.dart';

class PhoneScreen extends StatefulWidget {
  const PhoneScreen({super.key});

  @override
  State<PhoneScreen> createState() => _PhoneScreenState();
}

class _PhoneScreenState extends State<PhoneScreen> {
  final _phoneController = TextEditingController();
  final _nameController = TextEditingController();
  final _phoneFocusNode = FocusNode();
  final _nameFocusNode = FocusNode();
  bool _isLoading = false;

  @override
  void dispose() {
    _phoneController.dispose();
    _nameController.dispose();
    _phoneFocusNode.dispose();
    _nameFocusNode.dispose();
    super.dispose();
  }

  void _requestOtp() async {
    final phone = _phoneController.text.trim();
    if (phone.length != 10 || !RegExp(r'^[6-9][0-9]{9}$').hasMatch(phone)) {
      CustomToast.showErrorToast(context, 'Please enter a valid 10-digit Indian mobile number.');
      return;
    }

    setState(() => _isLoading = true);
    
    // Simulate Backend API Call "requestOtp"
    await Future.delayed(const Duration(seconds: 1));
    
    if (mounted) {
      setState(() => _isLoading = false);
      final name = _nameController.text.trim();
      Navigator.push(
        context,
        MaterialPageRoute(
          builder: (context) => OtpScreen(
            phoneNumber: phone,
            displayName: name.isNotEmpty ? name : null,
          ),
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
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
                  child: const Icon(Icons.phone_iphone_rounded, color: Color(0xFF8B1C28), size: 40),
                ).animate()
                 .fade(duration: 600.ms)
                 .scaleXY(begin: 0.5, end: 1.0, curve: Curves.easeOutBack)
                 .shimmer(delay: 500.ms, duration: 1.seconds, color: const Color(0xFF8B1C28).withValues(alpha: 0.3)),
              ),
              
              const SizedBox(height: 40),
              
              Text(
                "Let's get started",
                style: GoogleFonts.poppins(
                  fontSize: 28,
                  fontWeight: FontWeight.bold,
                  color: const Color(0xFF4A0E13),
                ),
              ).animate().fade(delay: 200.ms, duration: 600.ms).slideY(begin: 0.2, end: 0, curve: Curves.easeOutCubic),
              const SizedBox(height: 8),
              Text(
                "Enter your phone number and an optional display name.",
                style: GoogleFonts.poppins(
                  fontSize: 16,
                  color: const Color(0xFF4A0E13).withValues(alpha: 0.7),
                ),
              ).animate().fade(delay: 400.ms, duration: 600.ms).slideY(begin: 0.2, end: 0, curve: Curves.easeOutCubic),
              
              const SizedBox(height: 40),
              
              CustomTextField(
                controller: _phoneController,
                hintText: 'Your mobile number',
                prefixIcon: Icons.phone_rounded,
                focusNode: _phoneFocusNode,
                keyboardType: TextInputType.number,
                inputFormatters: [
                  FilteringTextInputFormatter.digitsOnly,
                  LengthLimitingTextInputFormatter(10),
                ],
              ).animate().fade(delay: 600.ms, duration: 600.ms).slideX(begin: -0.1, end: 0, curve: Curves.easeOutCubic),
              
              const SizedBox(height: 20),

              CustomTextField(
                controller: _nameController,
                hintText: 'Your Name (optional)',
                prefixIcon: Icons.person_outline_rounded,
                focusNode: _nameFocusNode,
                keyboardType: TextInputType.text,
                inputFormatters: [
                  LengthLimitingTextInputFormatter(50),
                ],
              ).animate().fade(delay: 700.ms, duration: 600.ms).slideX(begin: -0.1, end: 0, curve: Curves.easeOutCubic),
              
              const SizedBox(height: 40),
              
              _isLoading
                  ? Center(
                      child: SpoonLoader(size: 50),
                    )
                  : PrimaryButton(
                      text: 'Continue',
                      onTap: _requestOtp,
                    ).animate().fade(delay: 800.ms, duration: 600.ms).scaleXY(begin: 0.9, end: 1.0, curve: Curves.easeOutBack),
              
              const SizedBox(height: 30),
            ],
          ),
        ),
      ),
    );
  }
}

