import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:provider/provider.dart';
import 'package:hive_flutter/hive_flutter.dart';
import 'models/cart_model.dart';
import 'screens/splash_screen.dart';

import 'models/favorites_model.dart';
import 'models/user_model.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await SystemChrome.setPreferredOrientations([
    DeviceOrientation.portraitUp,
    DeviceOrientation.portraitDown,
  ]);
  await Hive.initFlutter();
  Hive.registerAdapter(FoodItemAdapter());
  Hive.registerAdapter(CartItemAdapter());
  Hive.registerAdapter(UserModelAdapter());
  
  await Hive.openBox<CartItem>('cartBox');
  await Hive.openBox('favoritesBox');
  
  // One-time migration: clear old userBox from incompatible adapter format
  final settingsBox = await Hive.openBox('settings');
  if (settingsBox.get('userModelVersion', defaultValue: 0) < 2) {
    try { await Hive.deleteBoxFromDisk('userBox'); } catch (_) {}
    await settingsBox.put('userModelVersion', 2);
  }
  await Hive.openBox<UserModel>('userBox');

  runApp(const FoodTechApp());
}

class FoodTechApp extends StatelessWidget {
  const FoodTechApp({super.key});

  /// Global navigator key used by API interceptor for device-conflict redirects
  static final navigatorKey = GlobalKey<NavigatorState>();

  @override
  Widget build(BuildContext context) {
    return MultiProvider(
      providers: [
        ChangeNotifierProvider(create: (_) => CartProvider()),
        ChangeNotifierProvider(create: (_) => FavoritesProvider()),
      ],
      child: MaterialApp(
        navigatorKey: FoodTechApp.navigatorKey,
        title: 'Food Tech',
        debugShowCheckedModeBanner: false,
        theme: ThemeData(
          useMaterial3: true,
          scaffoldBackgroundColor: const Color(0xFFFDF0F0), // Cream background
          primaryColor: const Color(0xFF8B1C28), // Maroon primary
          brightness: Brightness.light,
          textTheme:
              GoogleFonts.poppinsTextTheme(Theme.of(context).textTheme).apply(
            bodyColor: const Color(0xFF4A0E13),
            displayColor: const Color(0xFF4A0E13),
          ), // Dark Maroon text
          colorScheme: const ColorScheme.light(
            primary: Color(0xFF8B1C28),
            secondary: Color(0xFFF4B3B3), // Peach/Light Pink accent
            surface: Colors.white,
          ),
        ),
        home: const SplashScreen(),
      ),
    );
  }
}
