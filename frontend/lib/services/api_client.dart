import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
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

          // Handle 401 Unauthorized globally if needed
          if (e.response?.statusCode == 401) {
            await TokenStorage.deleteToken();
            // Ideally trigger navigation to login
          }

          return handler.next(e);
        },
      ),
    );
  }
}
