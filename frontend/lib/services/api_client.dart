import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import '../main.dart';
import '../screens/splash_screen.dart';
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
          if (e.response?.statusCode == 401) {
            final data = e.response?.data;
            final code = data is Map ? data['code'] : null;

            await TokenStorage.deleteToken();

            if (code == 'DEVICE_CONFLICT') {
              _forceLogout('You have been logged in on another device.');
            }
          }

          return handler.next(e);
        },
      ),
    );
  }

  /// Navigate to splash screen and show a device-conflict message
  static void _forceLogout(String message) {
    final ctx = FoodTechApp.navigatorKey.currentContext;
    if (ctx == null) return;

    // Navigate to splash and clear the stack
    FoodTechApp.navigatorKey.currentState?.pushAndRemoveUntil(
      MaterialPageRoute(builder: (_) => const SplashScreen()),
      (route) => false,
    );

    // Show a snackbar on the splash screen after the frame
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final scaffoldMessenger = ScaffoldMessenger.maybeOf(
        FoodTechApp.navigatorKey.currentContext!,
      );
      scaffoldMessenger?.showSnackBar(
        SnackBar(
          content: Text(message),
          backgroundColor: const Color(0xFF8B1C28),
          duration: const Duration(seconds: 4),
        ),
      );
    });
  }
}
