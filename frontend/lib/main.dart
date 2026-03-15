import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:provider/provider.dart';
import 'package:hive_flutter/hive_flutter.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:timezone/data/latest_all.dart' as tz;
import 'models/cart_model.dart';
import 'models/favorites_model.dart';
import 'models/user_model.dart';
import 'screens/splash_screen.dart';
import 'services/notification_service.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await SystemChrome.setPreferredOrientations([
    DeviceOrientation.portraitUp,
    DeviceOrientation.portraitDown,
  ]);

  // Initialize Firebase
  await Firebase.initializeApp();

  // Initialize timezones for local notifications
  tz.initializeTimeZones();

  // Register FCM background handler
  FirebaseMessaging.onBackgroundMessage(firebaseMessagingBackgroundHandler);

  // Initialize Hive
  await Hive.initFlutter();
  Hive.registerAdapter(FoodItemAdapter());
  Hive.registerAdapter(CartItemAdapter());
  Hive.registerAdapter(UserModelAdapter());

  await Hive.openBox<CartItem>('cartBox');
  await Hive.openBox('favoritesBox');

  // One-time migration: clear old userBox from incompatible adapter format
  final settingsBox = await Hive.openBox('settings');
  if (settingsBox.get('userModelVersion', defaultValue: 0) < 2) {
    try {
      await Hive.deleteBoxFromDisk('userBox');
    } catch (_) {}
    await settingsBox.put('userModelVersion', 2);
  }
  await Hive.openBox<UserModel>('userBox');

  runApp(const FoodTechApp());
}

class FoodTechApp extends StatefulWidget {
  const FoodTechApp({super.key});

  /// Global navigator key used by API interceptor for device-conflict redirects
  static final navigatorKey = GlobalKey<NavigatorState>();

  @override
  State<FoodTechApp> createState() => _FoodTechAppState();
}

class _FoodTechAppState extends State<FoodTechApp> {
  @override
  void initState() {
    super.initState();
    // Initialize notification service (FCM token, permissions, etc.)
    NotificationService().init();
  }

  @override
  Widget build(BuildContext context) {
    return MultiProvider(
      providers: [
        ChangeNotifierProvider(create: (_) => CartProvider()),
        ChangeNotifierProvider(create: (_) => FavoritesProvider()),
      ],
      child: MaterialApp(
        navigatorKey: FoodTechApp.navigatorKey,
        title: 'Scholar Bites',
        debugShowCheckedModeBanner: false,
        theme: ThemeData(
          useMaterial3: true,
          scaffoldBackgroundColor: const Color(0xFFFDF0F0),
          primaryColor: const Color(0xFF8B1C28),
          brightness: Brightness.light,
          textTheme:
              GoogleFonts.poppinsTextTheme(Theme.of(context).textTheme).apply(
            bodyColor: const Color(0xFF4A0E13),
            displayColor: const Color(0xFF4A0E13),
          ),
          colorScheme: const ColorScheme.light(
            primary: Color(0xFF8B1C28),
            secondary: Color(0xFFF4B3B3),
            surface: Colors.white,
          ),
        ),
        home: const SplashScreen(),
      ),
    );
  }
}
