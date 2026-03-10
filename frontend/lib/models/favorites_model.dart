import 'package:flutter/foundation.dart';
import 'package:hive/hive.dart';
import 'dart:convert';
import 'food_item.dart';

class FavoritesProvider with ChangeNotifier {
  final Map<String, FoodItem> _favorites = {};
  late Box _box;

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
}
