import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:hive_flutter/hive_flutter.dart';
import '../main.dart';
import '../models/user_model.dart';
import '../screens/welcome_screen.dart';
import '../utils/app_config.dart';
import '../utils/token_storage.dart';

class ApiClient {
  static final ApiClient _instance = ApiClient._internal();
  late final Dio dio;

  /// Prevents multiple simultaneous force-logout navigations.
  static bool _isLoggingOut = false;

  factory ApiClient() {
    return _instance;
  }

  ApiClient._internal() {
    dio = Dio(
      BaseOptions(
        baseUrl: AppConfig.baseUrl,
        connectTimeout: const Duration(seconds: 10),
        receiveTimeout: const Duration(seconds: 10),
        headers: {'Content-Type': 'application/json'},
      ),
    );

    // Logging + Auth Interceptor
    dio.interceptors.add(
      InterceptorsWrapper(
        onRequest: (options, handler) async {
          final token = await TokenStorage.getToken();
          if (token != null && token.isNotEmpty) {
            options.headers['Authorization'] = 'Bearer $token';
          }
          if (kDebugMode) {
            print('--> ${options.method.toUpperCase()} ${options.uri}');
            if (options.data != null) print('Data: ${options.data}');
          }
          return handler.next(options);
        },
        onResponse: (response, handler) {
          if (kDebugMode) {
            print('<-- ${response.statusCode} ${response.requestOptions.uri}');
          }
          return handler.next(response);
        },
        onError: (DioException e, handler) async {
          if (kDebugMode) {
            print(
              '<-- Error ${e.response?.statusCode} ${e.requestOptions.uri}',
            );
            print('Message: ${e.message}');
            print('Response: ${e.response?.data}');
          }

          final statusCode = e.response?.statusCode;
          final data = e.response?.data;
          final code = data is Map ? data['code'] : null;

          // ─── Skip auth-related error handling for login/register endpoints ───
          final path = e.requestOptions.path;
          final isAuthEndpoint = path.contains('/auth/login') ||
              path.contains('/auth/register') ||
              path.contains('/auth/update-university');

          if (!isAuthEndpoint) {
            // ─── DEVICE_CONFLICT: logged in on another device ───
            if (statusCode == 401 && code == 'DEVICE_CONFLICT') {
              _forceLogout('You have been logged in on another device.');
              return handler.next(e);
            }

            // ─── 403: Token decode failure (expired / corrupted / wrong secret) ───
            // This is the exact case from the error log:
            // "[Auth] 403: Failed to decode token for /balance"
            if (statusCode == 403) {
              _forceLogout('Your session has expired. Please log in again.');
              return handler.next(e);
            }

            // ─── 401 without DEVICE_CONFLICT: generic unauthorized ───
            // Could be a missing token, revoked session, etc.
            if (statusCode == 401) {
              _forceLogout('Session expired. Please log in again.');
              return handler.next(e);
            }
          }

          return handler.next(e);
        },
      ),
    );
  }

  /// Clear all session data and navigate to welcome screen.
  /// Debounced: only runs once when multiple 403s fire simultaneously.
  static void _forceLogout(String message) async {
    // Prevent cascading logouts from parallel failing requests
    if (_isLoggingOut) return;
    _isLoggingOut = true;

    try {
      // 1. Wipe secure storage (JWT + user metadata)
      await TokenStorage.deleteToken();

      // 2. Wipe Hive cached user so SplashScreen can't auto-login
      try {
        final userBox = Hive.box<UserModel>('userBox');
        await userBox.delete('currentUser');
      } catch (_) {}

      // 3. Navigate directly to WelcomeScreen (not SplashScreen)
      final navState = FoodTechApp.navigatorKey.currentState;
      if (navState == null) {
        _isLoggingOut = false;
        return;
      }

      navState.pushAndRemoveUntil(
        MaterialPageRoute(builder: (_) => const WelcomeScreen()),
        (route) => false,
      );

      // 4. Show explanation snackbar
      WidgetsBinding.instance.addPostFrameCallback((_) {
        final ctx = FoodTechApp.navigatorKey.currentContext;
        if (ctx == null) return;
        ScaffoldMessenger.maybeOf(ctx)?.showSnackBar(
          SnackBar(
            content: Text(message),
            backgroundColor: const Color(0xFF8B1C28),
            duration: const Duration(seconds: 4),
          ),
        );
      });
    } finally {
      // Reset flag after a delay to allow dust to settle
      Future.delayed(const Duration(seconds: 2), () {
        _isLoggingOut = false;
      });
    }
  }
}
