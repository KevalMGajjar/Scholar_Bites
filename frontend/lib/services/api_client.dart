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
          if (token != null) {
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

          // ─── Device Conflict: logged in on another device ───
          // ONLY delete the token and force logout on explicit DEVICE_CONFLICT.
          // Do NOT delete the token on normal 401s (e.g. expired token, missing
          // header on a non-critical request) — that causes a cascade where every
          // subsequent request also fails.
          if (e.response?.statusCode == 401) {
            final data = e.response?.data;
            final code = data is Map ? data['code'] : null;

            if (code == 'DEVICE_CONFLICT') {
              await TokenStorage.deleteToken();
              _forceLogout('You have been logged in on another device.');
            }
          }

          return handler.next(e);
        },
      ),
    );
  }

  /// Clear all session data and navigate to welcome screen on device conflict
  static void _forceLogout(String message) async {
    // 1. Wipe secure storage (JWT + user metadata)
    await TokenStorage.deleteToken();

    // 2. Wipe Hive cached user so SplashScreen can't auto-login
    try {
      final userBox = Hive.box<UserModel>('userBox');
      await userBox.delete('currentUser');
    } catch (_) {}

    // 3. Navigate directly to WelcomeScreen (not SplashScreen)
    final navState = FoodTechApp.navigatorKey.currentState;
    if (navState == null) return;

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
  }
}
