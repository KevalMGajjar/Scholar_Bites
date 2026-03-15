import 'package:flutter/foundation.dart';
import 'package:hive_flutter/hive_flutter.dart';
import 'food_item.dart';
import '../services/notification_service.dart';

// Adapter for FoodItem
class FoodItemAdapter extends TypeAdapter<FoodItem> {
  @override
  final int typeId = 0;

  @override
  FoodItem read(BinaryReader reader) {
    return FoodItem(
      id: reader.read(),
      name: reader.read(),
      imageUrl: reader.read(),
      price: reader.read(),
      calories: reader.read(),
      weight: reader.read(),
      description: reader.read(),
      category: reader.read(),
    );
  }

  @override
  void write(BinaryWriter writer, FoodItem obj) {
    writer.write(obj.id);
    writer.write(obj.name);
    writer.write(obj.imageUrl);
    writer.write(obj.price);
    writer.write(obj.calories);
    writer.write(obj.weight);
    writer.write(obj.description);
    writer.write(obj.category);
  }
}

// Adapter for CartItem
class CartItemAdapter extends TypeAdapter<CartItem> {
  @override
  final int typeId = 1;

  @override
  CartItem read(BinaryReader reader) {
    return CartItem(
      id: reader.read(),
      food: reader.read(),
      quantity: reader.read(),
    );
  }

  @override
  void write(BinaryWriter writer, CartItem obj) {
    writer.write(obj.id);
    writer.write(obj.food);
    writer.write(obj.quantity);
  }
}

class CartItem {
  final String id;
  final FoodItem food;
  int quantity;

  CartItem({required this.id, required this.food, this.quantity = 1});

  double get totalPrice => food.price * quantity;
}

class CartProvider with ChangeNotifier {
  Map<String, CartItem>? _cachedItems;
  bool _isDirty = true;

  Box<CartItem> get _box {
    return Hive.box<CartItem>('cartBox');
  }

  void _markDirty() {
    _isDirty = true;
    _cachedItems = null;
  }

  Map<String, CartItem> get items {
    if (!Hive.isBoxOpen('cartBox')) return {};
    if (!_isDirty && _cachedItems != null) return _cachedItems!;
    
    Map<String, CartItem> itemsMap = {};
    for (var item in _box.values) {
      itemsMap[item.food.id] = item;
    }
    _cachedItems = itemsMap;
    _isDirty = false;
    return itemsMap;
  }

  bool get isEmpty {
    if (!Hive.isBoxOpen('cartBox')) return true;
    return _box.isEmpty;
  }

  int get itemCount {
    if (!Hive.isBoxOpen('cartBox')) return 0;
    return _box.length;
  }

  double get totalAmount {
    if (!Hive.isBoxOpen('cartBox')) return 0.0;
    var total = 0.0;
    for (var cartItem in _box.values) {
      total += cartItem.food.price * cartItem.quantity;
    }
    return total;
  }

  void addItem(FoodItem food) {
    final box = _box;
    CartItem? existingItem;
    dynamic keyToDelete;

    for (var key in box.keys) {
      var item = box.get(key);
      if (item != null && item.food.id == food.id) {
        existingItem = item;
        keyToDelete = key;
        break;
      }
    }

    if (existingItem != null) {
      existingItem.quantity = existingItem.quantity + 1;
      box.put(keyToDelete, existingItem);
    } else {
      box.add(CartItem(id: DateTime.now().toString(), food: food, quantity: 1));
    }
    _markDirty();
    notifyListeners();
    
    // Schedule a cart abandonment reminder for 2 hours later
    try {
      NotificationService().scheduleCartReminder(food.name);
    } catch (_) {}
  }

  void removeSingleItem(String foodId) {
    final box = _box;

    for (var key in box.keys) {
      var item = box.get(key);
      if (item != null && item.food.id == foodId) {
        if (item.quantity > 1) {
          item.quantity = item.quantity - 1;
          box.put(key, item);
        } else {
          box.delete(key);
        }
        break;
      }
    }
    _markDirty();
    notifyListeners();
    
    if (isEmpty) {
      try {
        NotificationService().cancelCartReminder();
      } catch (_) {}
    }
  }

  void removeItem(String foodId) {
    final box = _box;
    for (var key in box.keys) {
      var item = box.get(key);
      if (item != null && item.food.id == foodId) {
        box.delete(key);
        break;
      }
    }
    _markDirty();
    notifyListeners();

    if (isEmpty) {
      try {
        NotificationService().cancelCartReminder();
      } catch (_) {}
    }
  }

  Future<void> clear() async {
    await _box.clear();
    _markDirty();
    notifyListeners();
    
    try {
      await NotificationService().cancelCartReminder();
    } catch (_) {}
  }
}
