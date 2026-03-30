import '../models/food_item.dart';
import '../models/restaurant_model.dart';

/// Describes why a food item is not available for ordering.
enum FoodItemAvailability {
  /// Item is available and can be added to cart.
  available,

  /// Item stock has been depleted (admin marked out of stock).
  outOfStock,

  /// Item has been temporarily disabled / paused by the restaurant.
  unavailable,

  /// The restaurant that sells this item is currently closed.
  restaurantClosed,
}

/// Extension helpers on the enum for easy UI consumption.
extension FoodItemAvailabilityX on FoodItemAvailability {
  bool get isAvailable => this == FoodItemAvailability.available;

  /// Human-friendly short label for the badge / pill.
  String get label {
    switch (this) {
      case FoodItemAvailability.available:
        return '';
      case FoodItemAvailability.outOfStock:
        return 'Out of Stock';
      case FoodItemAvailability.unavailable:
        return 'Unavailable';
      case FoodItemAvailability.restaurantClosed:
        return 'Closed';
    }
  }

  /// Longer explanation for detail-screen banners.
  String get bannerMessage {
    switch (this) {
      case FoodItemAvailability.available:
        return '';
      case FoodItemAvailability.outOfStock:
        return 'This item is currently out of stock';
      case FoodItemAvailability.unavailable:
        return 'This item is temporarily unavailable';
      case FoodItemAvailability.restaurantClosed:
        return 'The restaurant is currently closed';
    }
  }
}

/// Centralised logic that determines the availability of a food item.
///
/// This replaces the duplicated `_isItemAvailable()` that was copy-pasted
/// across home_screen, search_screen, and favorites_screen.
class AvailabilityHelper {
  const AvailabilityHelper._();

  /// Determine the availability state of [food] given the known [restaurants].
  static FoodItemAvailability getAvailability(
    FoodItem food,
    List<Restaurant> restaurants,
  ) {
    // 1. Check if the restaurant is closed (time-based check)
    if (food.restaurantId != null) {
      final restaurant = restaurants.cast<Restaurant?>().firstWhere(
            (r) => r?.id == food.restaurantId,
            orElse: () => null,
          );
      if (restaurant != null && !restaurant.isCurrentlyOpen) {
        return FoodItemAvailability.restaurantClosed;
      }
    }

    // 2. Check item-level flags from the API
    if (!food.isAvailable) {
      return FoodItemAvailability.outOfStock;
    }

    if (!food.restaurantIsOpen) {
      return FoodItemAvailability.unavailable;
    }

    return FoodItemAvailability.available;
  }

  /// Convenience: returns the restaurant that owns [food], if any.
  static Restaurant? findRestaurant(
    FoodItem food,
    List<Restaurant> restaurants,
  ) {
    if (food.restaurantId == null) return null;
    return restaurants.cast<Restaurant?>().firstWhere(
          (r) => r?.id == food.restaurantId,
          orElse: () => null,
        );
  }
}
