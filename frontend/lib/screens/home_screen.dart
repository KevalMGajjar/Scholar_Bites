import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:provider/provider.dart';
import '../models/food_item.dart';
import '../models/restaurant_model.dart';
import '../models/cart_model.dart';
import '../widgets/food_card.dart';
import '../widgets/spoon_loader.dart';
import '../widgets/custom_bottom_bar.dart';
import 'detail_screen.dart';
import 'restaurant_detail_screen.dart';
import 'group/group_entry_screen.dart';
import 'group/group_lobby_screen.dart';
import 'group/group_payment_screen.dart';
import '../services/group_service.dart';
import '../services/menu_service.dart';
import '../services/restaurant_service.dart';
import '../services/university_service.dart';
import '../services/speech_service.dart';
import '../utils/token_storage.dart';
import '../utils/animation_utils.dart';
import '../widgets/physics_cravings_box.dart';
import '../widgets/filter_bottom_sheet.dart';
import 'dart:async';
import 'package:flutter/services.dart';
import 'search_screen.dart';
import '../utils/custom_toast.dart';

import 'cart_screen.dart';
import 'profile_screen.dart';
import 'favorites_screen.dart';
import 'notifications_screen.dart';
import '../services/notification_service.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  final int _currentNavIndex = 0;
  final GlobalKey _cartKey = GlobalKey();
  final GlobalKey _favKey = GlobalKey();
  
  final PageController _trendingController = PageController(viewportFraction: 0.85);
  Timer? _trendingTimer;

  List<FoodItem> _trendingItems = [];
  List<Restaurant> _restaurants = [];
  bool _isLoading = true;
  SearchFilters _homeFilters = const SearchFilters();
  DateTime? _currentBackPressTime;

  // University header data
  String? _universityName;
  String? _universityLogoUrl;
  String? _universityAddress;
  int _unreadNotifsCount = 0;

  // Categories with Material icons for Story UI
  List<Map<String, dynamic>> _categories = [];

  final TextEditingController _homeSearchController = TextEditingController();
  final FocusNode _searchFocusNode = FocusNode();

  @override
  void initState() {
    super.initState();
    _fetchHomeData();
    _startAutoScroll();
    _checkActiveGroup();
  }

  /// Check if user is stuck in an active locked group and redirect
  Future<void> _checkActiveGroup() async {
    try {
      final result = await GroupService().getActiveGroup();
      if (!mounted) return;
      if (result['active'] == true) {
        final code = result['code']?.toString() ?? '';
        final status = result['status']?.toString() ?? '';
        final isLeader = result['is_leader'] == true;
        final nickname = result['nickname']?.toString() ?? 'Member';

        if (status == 'locked') {
          // Redirect to payment screen
          Navigator.pushReplacement(
            context,
            MaterialPageRoute(
              builder: (_) => GroupPaymentScreen(
                groupCode: code,
                isLeader: isLeader,
                myNickname: nickname,
                members: const [],
                creatorId: '',
              ),
            ),
          );
        } else if (status == 'open') {
          // Redirect to lobby screen
          Navigator.pushReplacement(
            context,
            MaterialPageRoute(
              builder: (_) => GroupLobbyScreen(
                groupCode: code,
                isLeader: isLeader,
                myNickname: nickname,
              ),
            ),
          );
        }
      }
    } catch (_) {
      // Silently fail — don't block home screen
    }
  }

  void _startAutoScroll() {
    _trendingTimer?.cancel();
    _trendingTimer = Timer.periodic(const Duration(seconds: 7), (timer) {
      if (_trendingController.hasClients && _trendingItems.isNotEmpty) {
        int nextPage = _trendingController.page!.round() + 1;
        if (nextPage >= _trendingItems.length) {
          _trendingController.animateToPage(
            0,
            duration: const Duration(milliseconds: 1000),
            curve: Curves.easeInOutCubic,
          );
        } else {
          _trendingController.nextPage(
            duration: const Duration(milliseconds: 1000),
            curve: Curves.easeInOutCubic,
          );
        }
      }
    });
  }

  void _pauseAutoScroll() {
    _trendingTimer?.cancel();
    // Resume auto-scroll after 12 seconds of inactivity
    Future.delayed(const Duration(seconds: 12), () {
      if (mounted) _startAutoScroll();
    });
  }

  @override
  void dispose() {
    _trendingTimer?.cancel();
    _trendingController.dispose();
    _homeSearchController.dispose();
    _searchFocusNode.dispose();
    super.dispose();
  }

  Future<void> _fetchHomeData() async {
    try {
      final menuService = MenuService();
      final restService = RestaurantService();

      final uniId = await TokenStorage.getUniversityId();
      if (uniId != null) {
        final rests = await restService.getRestaurantsByUniversity(uniId);

        // Fetch university details for header
        try {
          final uniData = await UniversityService().getUniversityById(uniId);
          if (uniData != null && mounted) {
            setState(() {
              _universityName = uniData['name'];
              _universityLogoUrl = uniData['logo_url'];
              _universityAddress = uniData['address'];
            });
          }
        } catch (_) {}
        
        // Fetch trending items, unread count, AND all items concurrently
        final responses = await Future.wait([
          menuService.getTrendingItems(uniId),
          NotificationService().getUnreadCount(),
          menuService.getMenuItems(uniId),
        ]);
        List<FoodItem> trending = responses[0] as List<FoodItem>;
        final int unreadCount = responses[1] as int;
        final List<FoodItem> allItems = responses[2] as List<FoodItem>;

        if (trending.isEmpty) {
          trending = allItems.take(5).toList();
        }

        // Build dynamic categories based on available menu
        final Set<String> catSet = {};
        for (var item in allItems) {
          if (item.category.isNotEmpty) catSet.add(item.category);
        }
        
        final List<Map<String, dynamic>> dynCategories = catSet.map((cat) {
          return {
            'name': cat,
            'icon': _getIconForCategory(cat),
          };
        }).toList();

        if (mounted) {
          setState(() {
            _restaurants = rests;
            _trendingItems = trending;
            _categories = dynCategories;
            _unreadNotifsCount = unreadCount;
            _isLoading = false;
          });
        }
      } else {
        if (mounted) setState(() => _isLoading = false);
      }
    } catch (e) {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  IconData _getIconForCategory(String category) {
    final lower = category.toLowerCase();
    if (lower.contains('burger')) return Icons.lunch_dining_rounded;
    if (lower.contains('pizza')) return Icons.local_pizza_rounded;
    if (lower.contains('drink') || lower.contains('beverage') || lower.contains('coffee')) return Icons.local_cafe_rounded;
    if (lower.contains('healthy') || lower.contains('salad')) return Icons.eco_rounded;
    if (lower.contains('snack')) return Icons.bakery_dining_rounded;
    if (lower.contains('dessert') || lower.contains('sweet')) return Icons.icecream_rounded;
    if (lower.contains('indian')) return Icons.ramen_dining_rounded;
    if (lower.contains('chinese')) return Icons.takeout_dining_rounded;
    return Icons.restaurant_rounded;
  }

  void _onNavTapped(int index) {
    if (index == 0) return;
    if (index == 1) {
      Navigator.push(context, MaterialPageRoute(builder: (context) => FavoritesScreen()));
    }
    if (index == 2) {
      Navigator.push(context, MaterialPageRoute(builder: (context) => const CartScreen()));
    }
    if (index == 3) {
      Navigator.push(context, MaterialPageRoute(builder: (context) => const ProfileScreen()));
    }
  }

  bool _isItemAvailable(FoodItem food) {
    if (!food.isAvailable) return false;
    if (food.restaurantId != null) {
      final restaurant = _restaurants.cast<Restaurant?>().firstWhere(
        (r) => r?.id == food.restaurantId,
        orElse: () => null,
      );
      if (restaurant != null && !restaurant.isCurrentlyOpen) return false;
    }
    return food.actuallyAvailable;
  }

  void _runAddToCartAnimation(GlobalKey widgetKey, String imageUrl) {
    AnimationUtils.runFlyAnimation(
      context,
      widgetKey,
      _cartKey,
      imageUrl,
    );
  }

  void _showFilterPopup() async {
    final categories = ['All', ..._categories.map((c) => c['name'] as String)];
    final result = await showModalBottomSheet<SearchFilters>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (context) => DraggableScrollableSheet(
        initialChildSize: 0.75,
        maxChildSize: 0.92,
        minChildSize: 0.5,
        builder: (_, controller) => FilterBottomSheet(
          currentFilters: _homeFilters,
          categories: categories,
        ),
      ),
    );
    if (result != null) {
      if (result.hasActiveFilters || result.category != 'All') {
        Navigator.push(
          context,
          MaterialPageRoute(
            builder: (context) => SearchScreen(
              initialCategory: result.category != 'All' ? result.category : null,
              initialFilters: result,
            ),
          ),
        ).then((_) {
          _searchFocusNode.unfocus();
        });
      } else {
        setState(() => _homeFilters = result);
      }
    }
  }

  String _getGreeting() {
    final hour = DateTime.now().hour;
    if (hour < 12) return "Morning cravings";
    if (hour < 15) return "Lunchtime";
    if (hour < 18) return "Afternoon snack";
    if (hour < 22) return "Dinnertime";
    return "Late night cravings";
  }

  @override
  Widget build(BuildContext context) {
    return PopScope(
      canPop: false,
      onPopInvoked: (didPop) {
        if (didPop) return;
        final now = DateTime.now();
        if (_currentBackPressTime == null ||
            now.difference(_currentBackPressTime!) > const Duration(seconds: 2)) {
          _currentBackPressTime = now;
          CustomToast.showNeutralToast(context, 'Press back again to exit');
        } else {
          SystemNavigator.pop();
        }
      },
      child: Scaffold(
        backgroundColor: const Color(0xFFFAFAFA),
        body: GestureDetector(
          onTap: () => _searchFocusNode.unfocus(),
          behavior: HitTestBehavior.translucent,
          child: Stack(
        children: [
          SafeArea(
            bottom: false,
            child: _isLoading
                ? Center(
                    child: SpoonLoader(size: 60))
                : RefreshIndicator(
                    color: const Color(0xFF8B1C28),
                    backgroundColor: Colors.white,
                    onRefresh: _fetchHomeData,
                    child: CustomScrollView(
                      physics: const BouncingScrollPhysics(
                          parent: AlwaysScrollableScrollPhysics()),
                      slivers: [
                      // 1. University Header
                      if (_universityName != null)
                        SliverToBoxAdapter(
                          child: Padding(
                            padding: const EdgeInsets.only(top: 16, left: 24, right: 24, bottom: 4),
                            child: Container(
                              padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 14),
                              decoration: BoxDecoration(
                                gradient: LinearGradient(
                                  colors: [
                                    const Color(0xFF8B1C28).withValues(alpha: 0.06),
                                    const Color(0xFF8B1C28).withValues(alpha: 0.02),
                                  ],
                                  begin: Alignment.topLeft,
                                  end: Alignment.bottomRight,
                                ),
                                borderRadius: BorderRadius.circular(20),
                                border: Border.all(
                                  color: const Color(0xFF8B1C28).withValues(alpha: 0.08),
                                ),
                              ),
                              child: Row(
                                children: [
                                  // University Logo with glow ring
                                  Container(
                                    width: 48,
                                    height: 48,
                                    decoration: BoxDecoration(
                                      shape: BoxShape.circle,
                                      boxShadow: [
                                        BoxShadow(
                                          color: const Color(0xFF8B1C28).withValues(alpha: 0.15),
                                          blurRadius: 12,
                                          spreadRadius: 2,
                                        ),
                                      ],
                                    ),
                                    child: Container(
                                      decoration: BoxDecoration(
                                        shape: BoxShape.circle,
                                        border: Border.all(
                                          color: const Color(0xFF8B1C28).withValues(alpha: 0.2),
                                          width: 2,
                                        ),
                                      ),
                                      child: ClipOval(
                                        child: _universityLogoUrl != null && _universityLogoUrl!.isNotEmpty
                                            ? CachedNetworkImage(
                                                imageUrl: _universityLogoUrl!,
                                                width: 44,
                                                height: 44,
                                                fit: BoxFit.cover,
                                                placeholder: (context, url) => Container(
                                                  color: const Color(0xFFFDF0F0),
                                                  child: const Icon(Icons.school_rounded, color: Color(0xFF8B1C28), size: 20),
                                                ),
                                                errorWidget: (context, url, error) => Container(
                                                  color: const Color(0xFFFDF0F0),
                                                  child: const Icon(Icons.school_rounded, color: Color(0xFF8B1C28), size: 20),
                                                ),
                                              )
                                            : Container(
                                                width: 44,
                                                height: 44,
                                                color: const Color(0xFFFDF0F0),
                                                child: const Icon(Icons.school_rounded, color: Color(0xFF8B1C28), size: 20),
                                              ),
                                      ),
                                    ),
                                  ),
                                  const SizedBox(width: 14),
                                  // University Name & Address
                                  Expanded(
                                    child: Column(
                                      crossAxisAlignment: CrossAxisAlignment.start,
                                      children: [
                                        Text(
                                          _universityName!,
                                          style: const TextStyle(
                                            fontSize: 16,
                                            fontWeight: FontWeight.w800,
                                            color: Color(0xFF1E1E1E),
                                            letterSpacing: -0.3,
                                          ),
                                          maxLines: 1,
                                          overflow: TextOverflow.ellipsis,
                                        ),
                                        if (_universityAddress != null && _universityAddress!.isNotEmpty)
                                          Padding(
                                            padding: const EdgeInsets.only(top: 2),
                                            child: Row(
                                              children: [
                                                Icon(Icons.location_on_rounded, size: 12, color: const Color(0xFF8B1C28).withValues(alpha: 0.5)),
                                                const SizedBox(width: 3),
                                                Expanded(
                                                  child: Text(
                                                    _universityAddress!,
                                                    style: TextStyle(
                                                      fontSize: 12,
                                                      fontWeight: FontWeight.w500,
                                                      color: const Color(0xFF1E1E1E).withValues(alpha: 0.45),
                                                    ),
                                                    maxLines: 1,
                                                    overflow: TextOverflow.ellipsis,
                                                  ),
                                                ),
                                              ],
                                            ),
                                          ),
                                      ],
                                    ),
                                  ),
                                  // Notification Bell Icon with Badge
                                  GestureDetector(
                                    onTap: () async {
                                      await Navigator.push(
                                        context,
                                        MaterialPageRoute(
                                          builder: (_) => const NotificationsScreen(),
                                        ),
                                      );
                                      // Refresh unread count when returning
                                      if (mounted) {
                                        final count = await NotificationService().getUnreadCount();
                                        setState(() => _unreadNotifsCount = count);
                                      }
                                    },
                                    child: Container(
                                      width: 44,
                                      height: 44,
                                      decoration: BoxDecoration(
                                        color: Colors.white,
                                        shape: BoxShape.circle,
                                        boxShadow: [
                                          BoxShadow(
                                            color: const Color(0xFF8B1C28).withValues(alpha: 0.08),
                                            blurRadius: 10,
                                            offset: const Offset(0, 4),
                                          ),
                                        ],
                                      ),
                                      child: Stack(
                                        alignment: Alignment.center,
                                        children: [
                                          Icon(
                                            Icons.notifications_none_rounded,
                                            color: const Color(0xFF1E1E1E).withValues(alpha: 0.8),
                                            size: 24,
                                          ),
                                          if (_unreadNotifsCount > 0)
                                            Positioned(
                                              top: 10,
                                              right: 10,
                                              child: Container(
                                                padding: const EdgeInsets.all(3),
                                                decoration: BoxDecoration(
                                                  color: const Color(0xFFE53935),
                                                  shape: BoxShape.circle,
                                                  border: Border.all(color: Colors.white, width: 1.5),
                                                ),
                                                constraints: const BoxConstraints(
                                                  minWidth: 10,
                                                  minHeight: 10,
                                                ),
                                              ).animate().scale(duration: 300.ms, curve: Curves.easeOutBack),
                                            ),
                                        ],
                                      ),
                                    ),
                                  ),
                                ],
                              ),
                            ).animate().fadeIn(duration: 500.ms).slideY(begin: -0.15, end: 0, curve: Curves.easeOutCubic),
                          ),
                        ),

                      // 2. Dynamic Contextual Header
                      SliverToBoxAdapter(
                        child: Padding(
                          padding: const EdgeInsets.only(
                              top: 24, left: 24, right: 24, bottom: 16),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                                Text(
                                '${_getGreeting()}!',
                                style: const TextStyle(
                                  color: Color(0xFF1E1E1E),
                                  fontSize: 28,
                                  fontWeight: FontWeight.w900,
                                  height: 1.2,
                                  letterSpacing: -0.5,
                                ),
                              ).animate().fadeIn(duration: 400.ms).slideY(begin: 0.2, end: 0, curve: Curves.easeOutBack),
                            ],
                          ),
                        ),
                      ),

                      // 2. Interactive Search Bar
                      SliverToBoxAdapter(
                        child: Padding(
                          padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 8),
                          child: Container(
                            height: 60,
                            padding: const EdgeInsets.symmetric(horizontal: 20),
                            decoration: BoxDecoration(
                              color: Colors.white,
                              borderRadius: BorderRadius.circular(30),
                              boxShadow: [
                                BoxShadow(
                                  color: Colors.black.withValues(alpha: 0.04),
                                  blurRadius: 20,
                                  offset: const Offset(0, 10),
                                ),
                              ],
                            ),
                            child: Row(
                              children: [
                                const Icon(Icons.search_rounded, color: Colors.grey, size: 24),
                                const SizedBox(width: 12),
                                Expanded(
                                  child: TextField(
                                    controller: _homeSearchController,
                                    focusNode: _searchFocusNode,
                                    autofocus: false,
                                    onSubmitted: (value) {
                                      if (value.trim().isNotEmpty) {
                                        Navigator.push(
                                          context,
                                          MaterialPageRoute(
                                            builder: (context) => SearchScreen(initialQuery: value.trim()),
                                          ),
                                        ).then((_) {
                                        _homeSearchController.clear();
                                        _searchFocusNode.unfocus();
                                      });
                                      }
                                    },
                                    decoration: InputDecoration(
                                      hintText: 'Search burgers, coffee...',
                                      hintStyle: TextStyle(
                                        color: Colors.grey.shade400,
                                        fontSize: 16,
                                        fontWeight: FontWeight.w500,
                                      ),
                                      border: InputBorder.none,
                                    ),
                                  ),
                                ),
                                // Voice Search Mic Button
                                ListenableBuilder(
                                  listenable: SpeechService(),
                                  builder: (context, _) {
                                    final isListening = SpeechService().isListening;
                                    return GestureDetector(
                                      onTap: () async {
                                        if (isListening) {
                                          await SpeechService().stopListening();
                                        } else {
                                          await SpeechService().startListening(
                                            onResult: (text) {
                                              if (text.isNotEmpty) {
                                                _homeSearchController.text = text;
                                              }
                                            },
                                          );
                                        }
                                      },
                                      child: AnimatedContainer(
                                        duration: const Duration(milliseconds: 300),
                                        padding: const EdgeInsets.all(8),
                                        margin: const EdgeInsets.only(right: 6),
                                        decoration: BoxDecoration(
                                          color: isListening ? const Color(0xFF8B1C28).withValues(alpha: 0.1) : Colors.transparent,
                                          shape: BoxShape.circle,
                                        ),
                                        child: Icon(
                                          isListening ? Icons.mic_rounded : Icons.mic_none_rounded,
                                          color: isListening ? const Color(0xFF8B1C28) : Colors.grey,
                                          size: 24,
                                        ).animate(target: isListening ? 1 : 0)
                                          .scaleXY(begin: 1.0, end: 1.1)
                                          .tint(color: const Color(0xFF8B1C28)),
                                      ),
                                    );
                                  },
                                ),
                                // Dynamic button: filter (when empty) vs search (when typing/filtered)
                                ValueListenableBuilder<TextEditingValue>(
                                  valueListenable: _homeSearchController,
                                  builder: (context, value, _) {
                                    final hasText = value.text.trim().isNotEmpty;
                                    final hasFilters = _homeFilters.hasActiveFilters;
                                    return GestureDetector(
                                      onTap: () {
                                        if (hasText || hasFilters) {
                                          Navigator.push(
                                            context,
                                            MaterialPageRoute(
                                              builder: (context) => SearchScreen(
                                                initialQuery: hasText ? _homeSearchController.text.trim() : null,
                                                initialCategory: _homeFilters.category != 'All' ? _homeFilters.category : null,
                                                initialFilters: _homeFilters,
                                              ),
                                            ),
                                          ).then((_) {
                                            _homeSearchController.clear();
                                            _searchFocusNode.unfocus();
                                            setState(() => _homeFilters = const SearchFilters());
                                          });
                                        } else {
                                          _showFilterPopup();
                                        }
                                      },
                                      child: AnimatedSwitcher(
                                        duration: const Duration(milliseconds: 250),
                                        transitionBuilder: (Widget child, Animation<double> animation) {
                                          return ScaleTransition(scale: animation, child: child);
                                        },
                                        child: (hasText || hasFilters)
                                            ? Container(
                                                key: const ValueKey('search_go'),
                                                width: 40,
                                                height: 40,
                                                decoration: const BoxDecoration(
                                                  color: Color(0xFF8B1C28),
                                                  shape: BoxShape.circle,
                                                ),
                                                child: const Icon(Icons.arrow_forward_rounded, color: Colors.white, size: 20),
                                              )
                                            : Container(
                                                key: const ValueKey('filter'),
                                                width: 40,
                                                height: 40,
                                                decoration: const BoxDecoration(
                                                  color: Color(0xFF8B1C28),
                                                  shape: BoxShape.circle,
                                                ),
                                                child: const Icon(Icons.tune_rounded, color: Colors.white, size: 20),
                                              ),
                                      ),
                                    );
                                  },
                                ),
                              ],
                            ),
                          ).animate().fadeIn(delay: 100.ms).slideY(begin: 0.2, end: 0),
                        ),
                      ),

                      // 3. "Cravings" Story-style categories
                      SliverToBoxAdapter(
                        child: _categories.isNotEmpty ? Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const Padding(
                              padding: EdgeInsets.only(left: 24, top: 24, bottom: 16),
                              child: Text(
                                'Cravings',
                                style: TextStyle(
                                  fontSize: 20,
                                  fontWeight: FontWeight.w800,
                                  color: Color(0xFF1E1E1E),
                                ),
                              ),
                            ),
                            Padding(
                              padding: const EdgeInsets.symmetric(horizontal: 24),
                              child: PhysicsCravingsBox(
                                boxHeight: 180,
                                onItemTap: (index) {
                                  Navigator.push(
                                    context,
                                    MaterialPageRoute(
                                      builder: (context) => SearchScreen(
                                        initialCategory: _categories[index]['name'],
                                      ),
                                    ),
                                  );
                                },
                                items: _categories.map((cat) {
                                  return Column(
                                    mainAxisSize: MainAxisSize.min,
                                    children: [
                                      Container(
                                        width: 70,
                                        height: 70,
                                        decoration: BoxDecoration(
                                          shape: BoxShape.circle,
                                          gradient: const LinearGradient(
                                            colors: [Color(0xFFFFDAB9), Color(0xFFFFFFFF)],
                                            begin: Alignment.topLeft,
                                            end: Alignment.bottomRight,
                                          ),
                                          boxShadow: [
                                            BoxShadow(
                                              color: const Color(0xFFFFDAB9).withValues(alpha: 0.5),
                                              blurRadius: 15,
                                              offset: const Offset(0, 8),
                                            )
                                          ],
                                        ),
                                        child: Center(
                                          child: Icon(
                                            cat['icon'] as IconData,
                                            size: 30,
                                            color: const Color(0xFF8B1C28),
                                          ),
                                        ),
                                      ),
                                    ],
                                  );
                                }).toList(),
                              ),
                            ),
                          ],
                        ) : const SizedBox.shrink(),
                      ),

                      // 4. Trending on Campus Carousel
                      if (_trendingItems.isNotEmpty)
                        SliverToBoxAdapter(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Padding(
                                padding: const EdgeInsets.only(left: 24, top: 24, right: 24, bottom: 16),
                                child: Row(
                                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                  children: [
                                    const Row(
                                      children: [
                                        Text(
                                          'Trending',
                                          style: TextStyle(
                                            fontSize: 20,
                                            fontWeight: FontWeight.w800,
                                            color: Color(0xFF1E1E1E),
                                          ),
                                        ),
                                        SizedBox(width: 6),
                                        Icon(Icons.local_fire_department_rounded, size: 20, color: Color(0xFFE65100)),
                                      ],
                                    ),
                                    GestureDetector(
                                      onTap: () {
                                        Navigator.push(
                                          context,
                                          MaterialPageRoute(
                                            builder: (context) => const SearchScreen(),
                                          ),
                                        );
                                      },
                                      child: Text(
                                        'See all',
                                        style: TextStyle(
                                          fontSize: 14,
                                          fontWeight: FontWeight.w700,
                                          color: const Color(0xFF8B1C28).withValues(alpha: 0.8),
                                        ),
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                              SizedBox(
                                height: 320,
                                child: PageView.builder(
                                  padEnds: true,
                                  physics: const BouncingScrollPhysics(),
                                  controller: _trendingController,
                                  itemCount: _trendingItems.length,
                                  itemBuilder: (context, index) {
                                    return Padding(
                                      padding: const EdgeInsets.symmetric(horizontal: 8),
                                      child: FoodCard(
                                        food: _trendingItems[index],
                                        isAvailable: _isItemAvailable(_trendingItems[index]),
                                        unavailableText: 'Closed',
                                        onTap: () {
                                          Navigator.push(
                                            context,
                                            MaterialPageRoute(
                                              builder: (context) => DetailScreen(food: _trendingItems[index]),
                                            ),
                                          );
                                        },
                                        onAddTap: (key) {
                                          Provider.of<CartProvider>(context, listen: false).addItem(_trendingItems[index]);
                                          _runAddToCartAnimation(key, _trendingItems[index].imageUrl);
                                          _pauseAutoScroll();
                                        },
                                        onInteraction: _pauseAutoScroll,
                                      ),
                                    );
                                  },
                                ),
                              ),
                            ],
                          ),
                        ),

                      // 5. Campus Spots List
                      SliverToBoxAdapter(
                        child: Padding(
                          padding: const EdgeInsets.only(left: 24, top: 32, bottom: 16),
                          child: const Text(
                            'Campus Spots \u{1F3EC}',
                            style: TextStyle(
                              fontSize: 20,
                              fontWeight: FontWeight.w800,
                              color: Color(0xFF1E1E1E),
                            ),
                          ),
                        ),
                      ),

                      SliverPadding(
                        padding: const EdgeInsets.only(left: 24, right: 24, bottom: 120),
                        sliver: SliverList(
                          delegate: SliverChildBuilderDelegate(
                            (context, index) {
                              Restaurant restaurant = _restaurants[index];
                              return GestureDetector(
                                onTap: () {
                                  Navigator.push(
                                    context,
                                    MaterialPageRoute(builder: (context) => RestaurantDetailScreen(restaurant: restaurant)),
                                  );
                                },
                                behavior: HitTestBehavior.opaque,
                                child: Container(
                                  margin: const EdgeInsets.only(bottom: 24),
                                  height: 200,
                                  decoration: BoxDecoration(
                                    borderRadius: BorderRadius.circular(24),
                                    image: DecorationImage(
                                      image: CachedNetworkImageProvider(restaurant.coverUrl ?? restaurant.imageUrl),
                                      fit: BoxFit.cover,
                                    ),
                                    boxShadow: [
                                      BoxShadow(
                                        color: Colors.black.withValues(alpha: 0.15),
                                        blurRadius: 20,
                                        offset: const Offset(0, 10),
                                      )
                                    ],
                                  ),
                                  child: Stack(
                                    children: [
                                      // Dark bottom gradient for text readability
                                      Positioned.fill(
                                        child: Container(
                                          decoration: BoxDecoration(
                                            borderRadius: BorderRadius.circular(24),
                                            gradient: LinearGradient(
                                              colors: [Colors.black.withValues(alpha: 0.8), Colors.transparent],
                                              begin: Alignment.bottomCenter,
                                              end: Alignment.topCenter,
                                            ),
                                          ),
                                        ),
                                      ),
                                      // Glassmorphic Info Overlay
                                      Positioned(
                                        bottom: 16,
                                        left: 16,
                                        right: 16,
                                        child: Row(
                                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                          crossAxisAlignment: CrossAxisAlignment.end,
                                          children: [
                                            Column(
                                              crossAxisAlignment: CrossAxisAlignment.start,
                                              children: [
                                                Text(
                                                  restaurant.name,
                                                  style: const TextStyle(
                                                    color: Colors.white,
                                                    fontSize: 20,
                                                    fontWeight: FontWeight.w900,
                                                  ),
                                                ),
                                                const SizedBox(height: 4),
                                                Text(
                                                  restaurant.tags.join(' \u{2022} '),
                                                  style: TextStyle(
                                                    color: Colors.white.withValues(alpha: 0.8),
                                                    fontSize: 13,
                                                    fontWeight: FontWeight.w600,
                                                  ),
                                                ),
                                              ],
                                            ),
                                            Container(
                                              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                                              decoration: BoxDecoration(
                                                color: Colors.white.withValues(alpha: 0.2),
                                                borderRadius: BorderRadius.circular(16),
                                                border: Border.all(color: Colors.white.withValues(alpha: 0.3)),
                                              ),
                                              child: Row(
                                                children: [
                                                  const Icon(Icons.star_rounded, color: Colors.orangeAccent, size: 16),
                                                  const SizedBox(width: 4),
                                                  Text(
                                                    restaurant.rating.toString(),
                                                    style: const TextStyle(
                                                      color: Colors.white,
                                                      fontWeight: FontWeight.bold,
                                                      fontSize: 12,
                                                    ),
                                                  ),
                                                ],
                                              ),
                                            ),
                                          ],
                                        ),
                                      ),
                                    ],
                                  ),
                                ),
                              );
                            },
                            childCount: _restaurants.length,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
          ),
          
          // Floating Group Order Button
          Positioned(
            right: 20,
            bottom: 120,
            child: GestureDetector(
              onTap: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const GroupEntryScreen())),
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                decoration: BoxDecoration(
                  gradient: const LinearGradient(colors: [Color(0xFF8B1C28), Color(0xFFB52A3A)]),
                  borderRadius: BorderRadius.circular(20),
                  boxShadow: [
                    BoxShadow(color: const Color(0xFF8B1C28).withValues(alpha: 0.4), blurRadius: 16, offset: const Offset(0, 6)),
                  ],
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    const Icon(Icons.group_rounded, color: Colors.white, size: 20),
                    const SizedBox(width: 8),
                    Text('Group Order', style: GoogleFonts.poppins(color: Colors.white, fontSize: 13, fontWeight: FontWeight.w700)),
                  ],
                ),
              ),
            ),
          ),

          // Floating Bottom Navigation Bar
          Positioned(
            left: 0,
            right: 0,
            bottom: 0,
            child: CustomBottomBar(
              currentIndex: _currentNavIndex,
              onTap: _onNavTapped,
              cartKey: _cartKey,
              favKey: _favKey,
            ),
          ),
        ],
      ),
      ),
    ));
  }
}

