import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:flutter_animate/flutter_animate.dart';
import '../services/wallet_service.dart';
import '../utils/custom_toast.dart';
import '../widgets/primary_button.dart';
import '../widgets/custom_text_field.dart';

class RedeemCouponScreen extends StatefulWidget {
  const RedeemCouponScreen({super.key});

  @override
  State<RedeemCouponScreen> createState() => _RedeemCouponScreenState();
}

class _RedeemCouponScreenState extends State<RedeemCouponScreen> {
  final TextEditingController _codeController = TextEditingController();
  bool _isRedeeming = false;

  void _redeemCoupon() async {
    final code = _codeController.text.trim().toUpperCase();
    if (code.isEmpty) {
      CustomToast.showErrorToast(context, 'Please enter a coupon code');
      return;
    }

    setState(() => _isRedeeming = true);

    try {
      await WalletService().redeemCoupon(code);
      if (mounted) {
        CustomToast.showSuccessToast(context, 'Coupon redeemed successfully! Funds added to wallet.');
        Navigator.pop(context, true);
      }
    } catch (e) {
      if (mounted) {
        CustomToast.showErrorToast(context, e.toString().replaceAll('Exception: ', ''));
      }
    } finally {
      if (mounted) {
        setState(() => _isRedeeming = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFFDF0F0),
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        elevation: 0,
        centerTitle: true,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_rounded, color: Color(0xFF4A0E13)),
          onPressed: () => Navigator.pop(context),
        ),
        title: Text(
          'Redeem Dean Coupon',
          style: GoogleFonts.poppins(
            color: const Color(0xFF4A0E13),
            fontSize: 20,
            fontWeight: FontWeight.w700,
          ),
        ),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(24),
        child: Column(
          children: [
            const SizedBox(height: 32),
            Container(
              width: 120,
              height: 120,
              decoration: BoxDecoration(
                color: const Color(0xFF8B1C28).withValues(alpha: 0.1),
                shape: BoxShape.circle,
              ),
              child: const Icon(
                Icons.local_activity_rounded,
                size: 60,
                color: Color(0xFF8B1C28),
              ),
            ).animate().scale(delay: 200.ms, curve: Curves.easeOutBack),
            const SizedBox(height: 32),
            Text(
              'Enter your 10-character code below to add department funds to your wallet.',
              textAlign: TextAlign.center,
              style: GoogleFonts.poppins(
                fontSize: 14,
                color: const Color(0xFF4A0E13).withValues(alpha: 0.7),
                fontWeight: FontWeight.w500,
              ),
            ).animate().fadeIn(delay: 400.ms),
            const SizedBox(height: 32),
            CustomTextField(
              controller: _codeController,
              hintText: 'e.g. DCA1B2C3D4',
              prefixIcon: Icons.confirmation_number_rounded,
              textCapitalization: TextCapitalization.characters,
            ).animate().fadeIn(delay: 600.ms).slideY(begin: 0.2, end: 0),
            const SizedBox(height: 32),
            _isRedeeming
                ? const SizedBox(
                    height: 56,
                     child: Center(
                       child: CircularProgressIndicator(color: Color(0xFF8B1C28)),
                     )
                  ).animate().fadeIn()
                : PrimaryButton(
                    text: 'Redeem Now',
                    onTap: _redeemCoupon,
                  ).animate().fadeIn(delay: 800.ms).slideY(begin: 0.2, end: 0),
          ],
        ),
      ),
    );
  }
}
