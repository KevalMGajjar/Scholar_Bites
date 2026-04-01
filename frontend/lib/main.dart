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
import 'screens/order_qr_screen.dart';
import 'services/notification_service.dart';
import 'firebase_options.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await SystemChrome.setPreferredOrientations([
    DeviceOrientation.portraitUp,
    DeviceOrientation.portraitDown,
  ]);

  // Initialize Firebase (with explicit platform credentials for iOS bypass)
  await Firebase.initializeApp(
    options: DefaultFirebaseOptions.currentPlatform,
  );

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
    final notifService = NotificationService();
    notifService.init();

    // Register FCM token on every app startup.
    // Returning users who auto-login via Hive cache never re-register their
    // FCM token, causing push notifications to silently fail. This ensures
    // the backend always has a fresh token.
    notifService.registerCurrentToken();
    
    // Listen for 'order_ready' pushes globally
    notifService.onOrderReady = (data) {
      if (mounted) {
        _showOrderReadyPopup(data);
      }
    };
  }

  void _showOrderReadyPopup(Map<String, dynamic> data) {
    final context = FoodTechApp.navigatorKey.currentContext;
    if (context == null) return;
    
    showDialog(
      context: context,
      builder: (ctx) {
        return AlertDialog(
          backgroundColor: Colors.white,
          surfaceTintColor: Colors.white,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
          title: const Row(
            children: [
              Icon(Icons.fastfood_rounded, color: Color(0xFF8B1C28)),
              SizedBox(width: 8),
              Text('Order Ready!', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 20)),
            ],
          ),
          content: const Text(
            'Your order is freshly prepared and ready for pickup! Have your QR code ready at the counter.',
            style: TextStyle(fontSize: 14, color: Color(0xFF4A0E13)),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(ctx),
              child: const Text('Close', style: TextStyle(color: Colors.grey, fontWeight: FontWeight.w600)),
            ),
            ElevatedButton(
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFF8B1C28),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 10),
              ),
              onPressed: () {
                Navigator.pop(ctx);
                Navigator.push(
                  context,
                  MaterialPageRoute(builder: (_) => OrderQrScreen(
                    orderId: data['order_id']?.toString() ?? '',
                    orderToken: data['order_token']?.toString() ?? '',
                    status: 'ready',
                    amount: double.tryParse(data['amount']?.toString() ?? '0') ?? 0.0,
                  )),
                );
              },
              child: const Text('View Ticket', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
            ),
          ],
        );
      },
    );
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
        title: 'Ahmedabad University Canteen',
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
