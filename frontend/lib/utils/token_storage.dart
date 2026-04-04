import 'dart:convert';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

class TokenStorage {
  static const _storage = FlutterSecureStorage();
  static const _tokenKey = 'jwt_token';

  static Future<void> saveToken(String token) async {
    if (token.isEmpty) return; // Never save empty tokens
    await _storage.write(key: _tokenKey, value: token);
  }

  static Future<String?> getToken() async {
    final token = await _storage.read(key: _tokenKey);
    // Guard against corrupted or placeholder values
    if (token == null || token.isEmpty || token == 'null' || token == 'undefined') {
      return null;
    }
    return token;
  }

  /// Checks if we have a non-expired JWT token stored.
  /// Returns true if the token exists and has not expired.
  /// This does NOT verify the signature (that's the server's job).
  static Future<bool> hasValidToken() async {
    final token = await getToken();
    if (token == null) return false;

    try {
      // JWT = header.payload.signature — decode the payload
      final parts = token.split('.');
      if (parts.length != 3) return false;

      // Base64 decode the payload (part[1])
      String payload = parts[1];
      // Add padding if needed
      switch (payload.length % 4) {
        case 2: payload += '=='; break;
        case 3: payload += '='; break;
      }
      final decoded = json.decode(utf8.decode(base64Url.decode(payload)));
      final exp = decoded['exp'] as int?;
      if (exp == null) return false;

      final expiryDate = DateTime.fromMillisecondsSinceEpoch(exp * 1000);
      // Consider token invalid if it expires within the next 60 seconds
      return expiryDate.isAfter(DateTime.now().add(const Duration(seconds: 60)));
    } catch (_) {
      // If we can't decode, the token is corrupted — treat as invalid
      return false;
    }
  }

  static Future<void> deleteToken() async {
    await _storage.delete(key: _tokenKey);
    await _storage.delete(key: 'university_id');
    await _storage.delete(key: 'user_id');
    await _storage.delete(key: 'user_name');
    await _storage.delete(key: 'user_email');
    await _storage.delete(key: 'user_phone');
  }

  static Future<void> saveUserId(String id) async {
    await _storage.write(key: 'user_id', value: id);
  }

  static Future<String?> getUserId() async {
    return await _storage.read(key: 'user_id');
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

  static Future<void> saveHasSeenFlickHint() async {
    await _storage.write(key: 'has_seen_flick_hint', value: 'true');
  }

  static Future<bool> getHasSeenFlickHint() async {
    final val = await _storage.read(key: 'has_seen_flick_hint');
    return val == 'true';
  }

  static Future<void> savePhone(String phone) async {
    await _storage.write(key: 'user_phone', value: phone);
  }

  static Future<String?> getPhone() async {
    return await _storage.read(key: 'user_phone');
  }

  static Future<void> saveUserType(String userType) async {
    await _storage.write(key: 'user_type', value: userType);
  }

  static Future<String?> getUserType() async {
    return await _storage.read(key: 'user_type');
  }
}
