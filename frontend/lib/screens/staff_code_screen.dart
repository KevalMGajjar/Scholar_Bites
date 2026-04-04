import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:flutter_animate/flutter_animate.dart';
import '../widgets/spoon_loader.dart';
import '../widgets/primary_button.dart';
import '../widgets/custom_text_field.dart';
import '../utils/custom_toast.dart';
import '../services/auth_service.dart';
import 'otp_screen.dart';

class StaffCodeScreen extends StatefulWidget {
  const StaffCodeScreen({super.key});

  @override
  State<StaffCodeScreen> createState() => _StaffCodeScreenState();
}

class _StaffCodeScreenState extends State<StaffCodeScreen> {
  final _codeController = TextEditingController();
  final _phoneController = TextEditingController();
  final _codeFocusNode = FocusNode();
  final _phoneFocusNode = FocusNode();
  bool _isLoading = false;

  @override
  void dispose() {
    _codeController.dispose();
    _phoneController.dispose();
    _codeFocusNode.dispose();
    _phoneFocusNode.dispose();
    super.dispose();
  }

  void _verifyAndProceed() async {
    final staffCode = _codeController.text.trim().toUpperCase();
    final phone = _phoneController.text.trim();

    if (staffCode.isEmpty) {
      CustomToast.showErrorToast(context, 'Please enter the staff access code.');
      return;
    }

    if (phone.length != 10 || !RegExp(r'^[6-9][0-9]{9}$').hasMatch(phone)) {
      CustomToast.showErrorToast(context, 'Please enter a valid 10-digit Indian mobile number.');
      return;
    }

    setState(() => _isLoading = true);

    try {
      final isValid = await AuthService.verifyStaffCode(staffCode);
      if (!isValid) {
         CustomToast.showErrorToast(context, 'Invalid staff access code.');
         setState(() => _isLoading = false);
         return;
      }
      
      // Navigate to staff specific OTP screen or standard OTP with staff flag
      if (mounted) {
        setState(() => _isLoading = false);
        Navigator.push(
          context,
          MaterialPageRoute(
            builder: (context) => OtpScreen(phoneNumber: phone, isStaffLogin: true, staffCode: staffCode),
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        setState(() => _isLoading = false);
        CustomToast.showErrorToast(context, e.toString().contains('Exception:') ? e.toString().split('Exception: ')[1] : e.toString());
      }
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
              
              const SizedBox(height: 30),
              
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
                  child: const Icon(Icons.badge_rounded, color: Color(0xFF8B1C28), size: 40),
                ).animate()
                 .fade(duration: 600.ms)
                 .scaleXY(begin: 0.5, end: 1.0, curve: Curves.easeOutBack),
              ),
              
              const SizedBox(height: 40),
              
              Text(
                "Staff Member?",
                style: GoogleFonts.poppins(
                  fontSize: 28,
                  fontWeight: FontWeight.bold,
                  color: const Color(0xFF4A0E13),
                ),
              ).animate().fade(delay: 200.ms, duration: 600.ms).slideY(begin: 0.2, end: 0, curve: Curves.easeOutCubic),
              const SizedBox(height: 8),
              Text(
                "Please enter your university staff code and phone number to continue.",
                style: GoogleFonts.poppins(
                  fontSize: 16,
                  color: const Color(0xFF4A0E13).withValues(alpha: 0.7),
                ),
              ).animate().fade(delay: 400.ms, duration: 600.ms).slideY(begin: 0.2, end: 0, curve: Curves.easeOutCubic),
              
              const SizedBox(height: 40),
              
              CustomTextField(
                controller: _codeController,
                hintText: 'Staff Access Code',
                prefixIcon: Icons.security_rounded,
                focusNode: _codeFocusNode,
                textCapitalization: TextCapitalization.characters,
              ).animate().fade(delay: 600.ms, duration: 600.ms).slideX(begin: -0.1, end: 0, curve: Curves.easeOutCubic),

              const SizedBox(height: 20),

              CustomTextField(
                controller: _phoneController,
                hintText: 'Your mobile number',
                prefixIcon: Icons.phone_rounded,
                focusNode: _phoneFocusNode,
                keyboardType: TextInputType.number,
              ).animate().fade(delay: 700.ms, duration: 600.ms).slideX(begin: -0.1, end: 0, curve: Curves.easeOutCubic),
              
              const SizedBox(height: 40),
              
              _isLoading
                  ? Center(
                      child: SpoonLoader(size: 50),
                    )
                  : PrimaryButton(
                      text: 'Verify & Continue',
                      onTap: _verifyAndProceed,
                    ).animate().fade(delay: 800.ms, duration: 600.ms).scaleXY(begin: 0.9, end: 1.0, curve: Curves.easeOutBack),
              
            ],
          ),
        ),
      ),
    );
  }
}
