import 'package:dio/dio.dart';
import 'package:hive_flutter/hive_flutter.dart';
import '../models/user_model.dart';
import 'api_client.dart';
import '../utils/token_storage.dart';

class AuthService {
  static final Dio _dio = ApiClient().dio;

  static Future<UserModel?> login(String email, String password) async {
    try {
      final response = await _dio.post(
        '/auth/login',
        data: {'email': email, 'password': password},
      );

      if (response.statusCode == 200) {
        final data = response.data;
        final token = data['token'];
        final userModel = UserModel.fromJson(data['user']);
        if (token != null) {
          await TokenStorage.saveToken(token);
          await TokenStorage.saveUniversityId(userModel.universityId);
          await TokenStorage.saveUserName(userModel.name);
          await TokenStorage.saveUserEmail(userModel.email);
          
          final userBox = Hive.box<UserModel>('userBox');
          await userBox.put('currentUser', userModel);
        }
        return userModel;
      }
    } on DioException catch (e) {
      throw Exception(e.response?.data['message'] ?? 'Login failed');
    }
    return null;
  }

  static Future<UserModel?> register({
    required String name,
    required String email,
    required String password,
    required String universityId,
    String? phone,
  }) async {
    try {
      final response = await _dio.post(
        '/auth/register',
        data: {
          'name': name,
          'email': email,
          'password': password,
          'university_id': universityId,
          'phone': phone,
        },
      );

      if (response.statusCode == 201) {
        final data = response.data;
        final token = data['token'];
        final userModel = UserModel.fromJson(data['user']);
        if (token != null) {
          await TokenStorage.saveToken(token);
          await TokenStorage.saveUniversityId(userModel.universityId);
          await TokenStorage.saveUserName(userModel.name);
          await TokenStorage.saveUserEmail(userModel.email);

          final userBox = Hive.box<UserModel>('userBox');
          await userBox.put('currentUser', userModel);
        }
        return userModel;
      }
    } on DioException catch (e) {
      throw Exception(e.response?.data['message'] ?? 'Registration failed');
    }
    return null;
  }

  static Future<void> logout() async {
    await TokenStorage.deleteToken();
    final userBox = Hive.box<UserModel>('userBox');
    await userBox.delete('currentUser');
  }

  static Future<UserModel?> loginOtp(String phone) async {
    try {
      final response = await _dio.post(
        '/auth/login-otp',
        data: {'phone': phone},
      );

      if (response.statusCode == 200) {
        final data = response.data;
        final token = data['token'];
        final userModel = UserModel.fromJson(data['user']);
        if (token != null) {
          await TokenStorage.saveToken(token);
          await TokenStorage.saveUniversityId(userModel.universityId);
          await TokenStorage.saveUserName(userModel.name);
          await TokenStorage.saveUserEmail(userModel.email);

          final userBox = Hive.box<UserModel>('userBox');
          await userBox.put('currentUser', userModel);
        }
        return userModel;
      }
    } on DioException catch (e) {
      if (e.response?.statusCode == 404) {
        return null; // Return null if 404 (needs registration)
      }
      throw Exception(e.response?.data['message'] ?? 'Login failed');
    }
    return null;
  }

  static Future<UserModel?> registerOtp({
    required String phone,
    required String universityId,
  }) async {
    try {
      final response = await _dio.post(
        '/auth/register-otp',
        data: {
          'phone': phone,
          'university_id': universityId,
        },
      );

      if (response.statusCode == 201) {
        final data = response.data;
        final token = data['token'];
        final userModel = UserModel.fromJson(data['user']);
        if (token != null) {
          await TokenStorage.saveToken(token);
          await TokenStorage.saveUniversityId(userModel.universityId);
          await TokenStorage.saveUserName(userModel.name);
          await TokenStorage.saveUserEmail(userModel.email);

          final userBox = Hive.box<UserModel>('userBox');
          await userBox.put('currentUser', userModel);
        }
        return userModel;
      }
    } on DioException catch (e) {
      throw Exception(e.response?.data['message'] ?? 'Registration failed');
    }
    return null;
  }

  /// Updates the university for an existing user (returning user switching campus)
  static Future<UserModel?> updateUniversity({
    required String phone,
    required String universityId,
  }) async {
    try {
      final response = await _dio.post(
        '/auth/update-university',
        data: {
          'phone': phone,
          'university_id': universityId,
        },
      );

      if (response.statusCode == 200) {
        final data = response.data;
        final token = data['token'];
        final userModel = UserModel.fromJson(data['user']);
        if (token != null) {
          await TokenStorage.saveToken(token);
          await TokenStorage.saveUniversityId(userModel.universityId);
          await TokenStorage.saveUserName(userModel.name);
          await TokenStorage.saveUserEmail(userModel.email);

          final userBox = Hive.box<UserModel>('userBox');
          await userBox.put('currentUser', userModel);
        }
        return userModel;
      }
    } on DioException catch (e) {
      throw Exception(e.response?.data['message'] ?? 'Failed to update university');
    }
    return null;
  }

  /// Returns the cached user from Hive (for auto-login on app restart)
  static UserModel? getCachedUser() {
    final userBox = Hive.box<UserModel>('userBox');
    return userBox.get('currentUser');
  }
}
