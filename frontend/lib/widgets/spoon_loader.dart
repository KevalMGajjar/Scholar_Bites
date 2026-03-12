import 'package:flutter/material.dart';
import 'package:lottie/lottie.dart';

/// Reusable animated spoon loader widget.
/// Replaces all CircularProgressIndicator usages in the app.
class SpoonLoader extends StatelessWidget {
  final double size;

  const SpoonLoader({super.key, this.size = 80});

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: size,
      height: size,
      child: Lottie.asset(
        'assets/lottie/Spoon Loader.json',
        fit: BoxFit.contain,
      ),
    );
  }
}
