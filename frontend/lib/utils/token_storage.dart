import 'package:flutter_secure_storage/flutter_secure_storage.dart';

class TokenStorage {
  static const _storage = FlutterSecureStorage();
  static const _tokenKey = 'jwt_token';

  static Future<void> saveToken(String token) async {
    await _storage.write(key: _tokenKey, value: token);
  }

  static Future<String?> getToken() async {
    return await _storage.read(key: _tokenKey);
  }

  static Future<void> deleteToken() async {
    await _storage.delete(key: _tokenKey);
    await _storage.delete(key: 'university_id');
    await _storage.delete(key: 'user_name');
    await _storage.delete(key: 'user_email');
  }

  static Future<void> saveUniversityId(String id) async {
    await _storage.write(key: 'university_id', value: id);
  }

  static Future<String?> getUniversityId() async {
    return await _storage.read(key: 'university_id');
  }

  static Future<void> saveUserName(String name) async {
    await _storage.write(key: 'user_name', value: name);
  }

  static Future<String?> getUserName() async {
    return await _storage.read(key: 'user_name');
  }

  static Future<void> saveUserEmail(String email) async {
    await _storage.write(key: 'user_email', value: email);
  }

  static Future<String?> getUserEmail() async {
    return await _storage.read(key: 'user_email');
  }
}
