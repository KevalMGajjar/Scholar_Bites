import 'package:flutter/foundation.dart';
import 'package:hive/hive.dart';
import 'dart:convert';
import 'food_item.dart';
import '../services/api_client.dart';
import '../utils/token_storage.dart';

class FavoritesProvider with ChangeNotifier {
  final Map<String, FoodItem> _favorites = {};
  late Box _box;
  bool _hasSyncedOnce = false;

  FavoritesProvider() {
    _box = Hive.box('favoritesBox');
    _loadFromHive();
  }

  void _loadFromHive() {
    // Each favorite is stored as a separate key with a JSON string value
    for (final key in _box.keys) {
      try {
        final jsonStr = _box.get(key);
        if (jsonStr is String) {
          final map = jsonDecode(jsonStr) as Map<String, dynamic>;
          final item = FoodItem.fromJson(map);
          _favorites[item.id] = item;
        }
      } catch (_) {
        // Skip corrupted entries
      }
    }
  }

  void _saveItemToHive(String id, FoodItem item) {
    _box.put(id, jsonEncode(item.toJson()));
  }

  void _removeItemFromHive(String id) {
    _box.delete(id);
  }

  bool isFavorite(String id) {
    return _favorites.containsKey(id);
  }

  void toggleFavorite(String id, [FoodItem? item]) {
    if (_favorites.containsKey(id)) {
      _favorites.remove(id);
      _removeItemFromHive(id);
    } else if (item != null) {
      _favorites[id] = item;
      _saveItemToHive(id, item);
    }
    notifyListeners();

    // Fire-and-forget: sync this toggle to the backend so
    // the server knows who favorited what (for targeted notifications).
    _syncToggleToBackend(id);
  }

  List<FoodItem> get favoriteItems => _favorites.values.toList();

  int get count => _favorites.length;

  List<FoodItem> getFavoriteItems(List<FoodItem> allItems) {
    final List<FoodItem> result = [];
    for (final id in _favorites.keys) {
      if (_favorites[id] != null) {
        result.add(_favorites[id]!);
      } else {
        final match = allItems.where((item) => item.id == id).toList();
        if (match.isNotEmpty) result.add(match.first);
      }
    }
    return result;
  }

  // ─── Backend Sync ────────────────────────────────────────

  /// Called once after login to push all local favorites to the server.
  /// Merges remote favorites into local state so cross-device works too.
  Future<void> syncWithBackend() async {
    // Guard: only sync if user is logged in
    final token = await TokenStorage.getToken();
    if (token == null) return;

    try {
      final dio = ApiClient().dio;

      // 1. Fetch any favorites stored on the server (e.g. from another device)
      final getRes = await dio.get('/user/favorites');
      final List<dynamic> remoteIds = getRes.data['favorites'] ?? [];

      // 2. Merge remote into local (add any server-side favorites we don't have locally)
      for (final id in remoteIds) {
        final idStr = id.toString();
        if (!_favorites.containsKey(idStr)) {
          // We don't have the full FoodItem data from the server — just track the ID.
          // The item details will be populated when the menu loads.
          _box.put(idStr, jsonEncode({'id': idStr}));
        }
      }

      // 3. Push local favorites to the server (full sync — server becomes source of truth)
      final localIds = _favorites.keys.toList();
      await dio.post('/user/favorites/sync', data: {
        'menu_item_ids': localIds,
      });

      _hasSyncedOnce = true;
      debugPrint('[Favorites] ✅ Synced ${localIds.length} favorite(s) with backend');
    } catch (e) {
      // Non-critical — local favorites still work offline
      debugPrint('[Favorites] ⚠️ Backend sync failed (offline?): $e');
    }
  }

  /// Fire-and-forget toggle sync for a single item.
  Future<void> _syncToggleToBackend(String menuItemId) async {
    final token = await TokenStorage.getToken();
    if (token == null) return;

    try {
      await ApiClient().dio.post('/user/favorites/toggle', data: {
        'menu_item_id': menuItemId,
      });
    } catch (e) {
      // Non-critical — will be corrected on next full sync
      debugPrint('[Favorites] Toggle sync failed for $menuItemId: $e');
    }
  }

  bool get hasSyncedOnce => _hasSyncedOnce;
}
