import 'dart:io';
import 'package:dio/dio.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:timezone/timezone.dart' as tz;
import 'api_client.dart';
import '../utils/token_storage.dart';

/// Handles FCM token registration, push notifications (foreground/background),
/// local notification display, and REST API calls for in-app notifications.
class NotificationService {
  static final NotificationService _instance = NotificationService._();
  factory NotificationService() => _instance;
  NotificationService._();

  final Dio _dio = ApiClient().dio;
  final FirebaseMessaging _fcm = FirebaseMessaging.instance;
  final FlutterLocalNotificationsPlugin _localNotifs =
      FlutterLocalNotificationsPlugin();

  bool _initialized = false;

  /// Initialize notifications — call once after Firebase.initializeApp().
  /// This only sets up local notification channels, permissions, and listeners.
  /// It does NOT attempt any authenticated API calls.
  Future<void> init() async {
    if (_initialized) return;
    _initialized = true;

    // Request permissions
    await _fcm.requestPermission(
      alert: true,
      badge: true,
      sound: true,
      provisional: false,
    );

    // Initialize local notifications for foreground display
    const androidSettings = AndroidInitializationSettings('@mipmap/ic_launcher');
    const iosSettings = DarwinInitializationSettings(
      requestAlertPermission: true,
      requestBadgePermission: true,
      requestSoundPermission: true,
    );
    await _localNotifs.initialize(
      settings: const InitializationSettings(
        android: androidSettings,
        iOS: iosSettings,
      ),
    );

    // Create Android notification channel
    if (Platform.isAndroid) {
      const channel = AndroidNotificationChannel(
        'scholar_bites_notifications',
        'Scholar Bites',
        description: 'Notifications from Scholar Bites',
        importance: Importance.high,
      );
      await _localNotifs
          .resolvePlatformSpecificImplementation<
              AndroidFlutterLocalNotificationsPlugin>()
          ?.createNotificationChannel(channel);
    }

    // Listen for foreground messages
    FirebaseMessaging.onMessage.listen(_handleForegroundMessage);

    // Listen for token refresh — only register if user is logged in
    _fcm.onTokenRefresh.listen((newToken) async {
      final jwt = await TokenStorage.getToken();
      if (jwt != null) {
        registerToken(newToken);
      }
    });
  }

  /// Handle foreground FCM messages — show as local notification
  void _handleForegroundMessage(RemoteMessage message) {
    final notification = message.notification;
    if (notification == null) return;

    _localNotifs.show(
      id: notification.hashCode,
      title: notification.title,
      body: notification.body,
      notificationDetails: const NotificationDetails(
        android: AndroidNotificationDetails(
          'scholar_bites_notifications',
          'Scholar Bites',
          channelDescription: 'Notifications from Scholar Bites',
          importance: Importance.high,
          priority: Priority.high,
          icon: '@mipmap/ic_launcher',
        ),
        iOS: DarwinNotificationDetails(
          presentAlert: true,
          presentBadge: true,
          presentSound: true,
        ),
      ),
    );
  }

  // ─── Local Notifications (Cart Reminder) ───

  /// Schedule a local notification if cart is abandoned (2 hours from now)
  Future<void> scheduleCartReminder(String itemName) async {
    // Cancel any existing reminder
    await cancelCartReminder();

    final scheduledTime = tz.TZDateTime.now(tz.local).add(const Duration(hours: 2));

    await _localNotifs.zonedSchedule(
      id: 999, // Fixed ID for cart reminder
      title: 'Your cart misses you!',
      body: '$itemName and the squad have been waiting — they might sell out ngl',
      scheduledDate: scheduledTime,
      notificationDetails: const NotificationDetails(
        android: AndroidNotificationDetails(
          'scholar_bites_notifications',
          'Scholar Bites',
          channelDescription: 'Notifications from Scholar Bites',
          importance: Importance.high,
          priority: Priority.high,
        ),
        iOS: DarwinNotificationDetails(),
      ),
      androidScheduleMode: AndroidScheduleMode.exactAllowWhileIdle,
    );
  }

  /// Cancel cart reminder (e.g., when checked out or cart cleared)
  Future<void> cancelCartReminder() async {
    await _localNotifs.cancel(id: 999);
  }

  // ─── API Methods (all guarded: skip if no JWT) ───

  /// Returns true if the user has a stored JWT token.
  Future<bool> _isAuthenticated() async {
    final token = await TokenStorage.getToken();
    return token != null;
  }

  /// Register FCM token with backend
  Future<void> registerToken(String token) async {
    if (!await _isAuthenticated()) return;
    try {
      await _dio.post('/notifications/register-token', data: {'fcm_token': token});
      if (kDebugMode) print('[NotificationService] FCM token registered successfully');
    } catch (e) {
      if (kDebugMode) print('[NotificationService] Failed to register token: $e');
    }
  }

  /// Manually trigger token registration (call after successful login/register)
  Future<void> registerCurrentToken() async {
    if (!await _isAuthenticated()) return;
    try {
      final token = await _fcm.getToken();
      if (token != null) {
        await registerToken(token);
      }
    } catch (e) {
      if (kDebugMode) print('[NotificationService] registerCurrentToken failed: $e');
    }
  }

  /// Fetch notifications list
  Future<Map<String, dynamic>> getNotifications({int page = 1, int limit = 30}) async {
    if (!await _isAuthenticated()) {
      return {'notifications': [], 'total': 0, 'page': page, 'limit': limit};
    }
    try {
      final response = await _dio.get('/notifications', queryParameters: {
        'page': page,
        'limit': limit,
      });
      return response.data;
    } catch (e) {
      return {'notifications': [], 'total': 0, 'page': page, 'limit': limit};
    }
  }

  /// Get unread count for badge
  Future<int> getUnreadCount() async {
    if (!await _isAuthenticated()) return 0;
    try {
      final response = await _dio.get('/notifications/unread-count');
      return response.data['count'] ?? 0;
    } catch (_) {
      return 0;
    }
  }

  /// Mark single notification as read
  Future<void> markAsRead(String id) async {
    if (!await _isAuthenticated()) return;
    try {
      await _dio.post('/notifications/$id/read');
    } catch (_) {}
  }

  /// Mark all notifications as read
  Future<void> markAllAsRead() async {
    if (!await _isAuthenticated()) return;
    try {
      await _dio.post('/notifications/read-all');
    } catch (_) {}
  }
}

/// Top-level handler for background FCM messages (required by Firebase)
@pragma('vm:entry-point')
Future<void> firebaseMessagingBackgroundHandler(RemoteMessage message) async {
  await Firebase.initializeApp();
  // Background messages are automatically shown as notifications by FCM
}
