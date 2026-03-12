import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:hive_flutter/hive_flutter.dart';
import '../widgets/spoon_loader.dart';

// ─── Colors ──────────────────────────────────────────
const _maroon = Color(0xFF8B1C28);
const _darkText = Color(0xFF4A0E13);
const _bg = Color(0xFFFCF9F5);

class PreferencesScreen extends StatefulWidget {
  const PreferencesScreen({super.key});

  @override
  State<PreferencesScreen> createState() => _PreferencesScreenState();
}

class _PreferencesScreenState extends State<PreferencesScreen> {
  late Box _prefsBox;
  bool _isLoaded = false;

  // ── Diet Type ──
  String _dietType = 'any'; // 'veg', 'nonveg', 'egg', 'any'

  // ── Nutritional Goals ──
  bool _highProtein = false;
  bool _lowCalorie = false;
  bool _highCalorie = false;
  bool _lowSugar = false;
  bool _highFiber = false;
  bool _lowFat = false;

  // ── Allergies ──
  bool _glutenFree = false;
  bool _nutFree = false;
  bool _dairyFree = false;
  bool _soyFree = false;

  // ── Spice Level ──
  int _spiceLevel = 2; // 0=none, 1=mild, 2=medium, 3=hot, 4=extra hot

  // ── Meal Size ──
  String _mealSize = 'regular'; // 'light', 'regular', 'large'

  @override
  void initState() {
    super.initState();
    _loadPreferences();
  }

  Future<void> _loadPreferences() async {
    _prefsBox = await Hive.openBox('userPreferences');
    setState(() {
      _dietType = _prefsBox.get('dietType', defaultValue: 'any');
      _highProtein = _prefsBox.get('highProtein', defaultValue: false);
      _lowCalorie = _prefsBox.get('lowCalorie', defaultValue: false);
      _highCalorie = _prefsBox.get('highCalorie', defaultValue: false);
      _lowSugar = _prefsBox.get('lowSugar', defaultValue: false);
      _highFiber = _prefsBox.get('highFiber', defaultValue: false);
      _lowFat = _prefsBox.get('lowFat', defaultValue: false);
      _glutenFree = _prefsBox.get('glutenFree', defaultValue: false);
      _nutFree = _prefsBox.get('nutFree', defaultValue: false);
      _dairyFree = _prefsBox.get('dairyFree', defaultValue: false);
      _soyFree = _prefsBox.get('soyFree', defaultValue: false);
      _spiceLevel = _prefsBox.get('spiceLevel', defaultValue: 2);
      _mealSize = _prefsBox.get('mealSize', defaultValue: 'regular');
      _isLoaded = true;
    });
  }

  Future<void> _saveAll() async {
    await _prefsBox.put('dietType', _dietType);
    await _prefsBox.put('highProtein', _highProtein);
    await _prefsBox.put('lowCalorie', _lowCalorie);
    await _prefsBox.put('highCalorie', _highCalorie);
    await _prefsBox.put('lowSugar', _lowSugar);
    await _prefsBox.put('highFiber', _highFiber);
    await _prefsBox.put('lowFat', _lowFat);
    await _prefsBox.put('glutenFree', _glutenFree);
    await _prefsBox.put('nutFree', _nutFree);
    await _prefsBox.put('dairyFree', _dairyFree);
    await _prefsBox.put('soyFree', _soyFree);
    await _prefsBox.put('spiceLevel', _spiceLevel);
    await _prefsBox.put('mealSize', _mealSize);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: _bg,
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        elevation: 0,
        foregroundColor: _darkText,
        title: const Text(
          'Food Preferences',
          style: TextStyle(fontWeight: FontWeight.w800, fontSize: 20),
        ),
        actions: [
          TextButton(
            onPressed: () async {
              await _saveAll();
              if (mounted) {
                ScaffoldMessenger.of(context).showSnackBar(
                  SnackBar(
                    content: const Text('Preferences saved!'),
                    backgroundColor: _maroon,
                    behavior: SnackBarBehavior.floating,
                    shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(12)),
                  ),
                );
                Navigator.pop(context);
              }
            },
            child: const Text(
              'Save',
              style: TextStyle(
                  color: _maroon, fontWeight: FontWeight.w800, fontSize: 16),
            ),
          ),
        ],
      ),
      body: !_isLoaded
          ? Center(
              child: SpoonLoader(size: 50),
            )
          : SingleChildScrollView(
              physics: const BouncingScrollPhysics(),
              padding: const EdgeInsets.fromLTRB(20, 8, 20, 40),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // ── Diet Type ──
                  _buildSectionHeader(
                      'Diet Type', '\u{1F331}', 'What do you eat?'),
                  const SizedBox(height: 12),
                  _buildDietTypeSelector(),
                  const SizedBox(height: 28),

                  // ── Nutritional Goals ──
                  _buildSectionHeader('Nutritional Goals', '\u{1F4AA}',
                      'What matters to you?'),
                  const SizedBox(height: 12),
                  _buildNutritionGrid(),
                  const SizedBox(height: 28),

                  // ── Allergies & Intolerances ──
                  _buildSectionHeader('Allergies & Restrictions', '\u{26A0}\u{FE0F}',
                      'Foods to avoid'),
                  const SizedBox(height: 12),
                  _buildAllergyGrid(),
                  const SizedBox(height: 28),

                  // ── Spice Level ──
                  _buildSectionHeader(
                      'Spice Level', '\u{1F336}\u{FE0F}', 'How hot do you like it?'),
                  const SizedBox(height: 12),
                  _buildSpiceLevelSelector(),
                  const SizedBox(height: 28),

                  // ── Meal Size ──
                  _buildSectionHeader(
                      'Portion Size', '\u{1F37D}\u{FE0F}', 'How much do you usually eat?'),
                  const SizedBox(height: 12),
                  _buildMealSizeSelector(),
                  const SizedBox(height: 20),
                ],
              ),
            ),
    );
  }

  // ── Section Header ──
  Widget _buildSectionHeader(String title, String emoji, String subtitle) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Text(emoji, style: const TextStyle(fontSize: 22)),
            const SizedBox(width: 10),
            Text(
              title,
              style: const TextStyle(
                fontSize: 18,
                fontWeight: FontWeight.w800,
                color: _darkText,
              ),
            ),
          ],
        ),
        const SizedBox(height: 4),
        Padding(
          padding: const EdgeInsets.only(left: 36),
          child: Text(
            subtitle,
            style: TextStyle(
              fontSize: 13,
              color: _darkText.withValues(alpha: 0.45),
              fontWeight: FontWeight.w500,
            ),
          ),
        ),
      ],
    ).animate().fadeIn(duration: 300.ms).slideX(begin: -0.05, end: 0);
  }

  // ── Diet Type Selector ──
  Widget _buildDietTypeSelector() {
    final options = [
      _DietOption('Veg', '\u{1F966}', 'veg', const Color(0xFF2E7D32)),
      _DietOption('Non-Veg', '\u{1F357}', 'nonveg', const Color(0xFFC62828)),
      _DietOption('Eggetarian', '\u{1F95A}', 'egg', const Color(0xFFFF8F00)),
      _DietOption('Any', '\u{1F37D}\u{FE0F}', 'any', const Color(0xFF5C6BC0)),
    ];

    return Row(
      children: options.map((opt) {
        final isSelected = _dietType == opt.value;
        return Expanded(
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 4),
            child: GestureDetector(
              onTap: () => setState(() => _dietType = opt.value),
              child: AnimatedContainer(
                duration: const Duration(milliseconds: 250),
                curve: Curves.easeOut,
                padding: const EdgeInsets.symmetric(vertical: 14),
                decoration: BoxDecoration(
                  color: isSelected
                      ? opt.color.withValues(alpha: 0.12)
                      : Colors.white,
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(
                    color: isSelected
                        ? opt.color
                        : _darkText.withValues(alpha: 0.08),
                    width: isSelected ? 2 : 1,
                  ),
                  boxShadow: isSelected
                      ? [
                          BoxShadow(
                            color: opt.color.withValues(alpha: 0.15),
                            blurRadius: 12,
                            offset: const Offset(0, 4),
                          )
                        ]
                      : [],
                ),
                child: Column(
                  children: [
                    Text(opt.emoji, style: const TextStyle(fontSize: 24)),
                    const SizedBox(height: 6),
                    Text(
                      opt.label,
                      style: TextStyle(
                        fontSize: 11,
                        fontWeight:
                            isSelected ? FontWeight.w800 : FontWeight.w600,
                        color: isSelected ? opt.color : _darkText.withValues(alpha: 0.6),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        );
      }).toList(),
    ).animate().fadeIn(duration: 300.ms, delay: 100.ms);
  }

  // ── Nutrition Grid ──
  Widget _buildNutritionGrid() {
    final items = [
      _ToggleItem('High Protein', '\u{1F4AA}', _highProtein,
          (v) => setState(() => _highProtein = v)),
      _ToggleItem('Low Calorie', '\u{1F525}', _lowCalorie,
          (v) => setState(() => _lowCalorie = v)),
      _ToggleItem('High Calorie', '\u{26A1}', _highCalorie,
          (v) => setState(() => _highCalorie = v)),
      _ToggleItem('Low Sugar', '\u{1F36C}', _lowSugar,
          (v) => setState(() => _lowSugar = v)),
      _ToggleItem('High Fiber', '\u{1F33E}', _highFiber,
          (v) => setState(() => _highFiber = v)),
      _ToggleItem('Low Fat', '\u{1F954}', _lowFat,
          (v) => setState(() => _lowFat = v)),
    ];

    return _buildToggleGrid(items);
  }

  // ── Allergy Grid ──
  Widget _buildAllergyGrid() {
    final items = [
      _ToggleItem('Gluten Free', '\u{1F35E}', _glutenFree,
          (v) => setState(() => _glutenFree = v)),
      _ToggleItem('Nut Free', '\u{1F95C}', _nutFree,
          (v) => setState(() => _nutFree = v)),
      _ToggleItem('Dairy Free', '\u{1F95B}', _dairyFree,
          (v) => setState(() => _dairyFree = v)),
      _ToggleItem('Soy Free', '\u{1FAD8}', _soyFree,
          (v) => setState(() => _soyFree = v)),
    ];

    return _buildToggleGrid(items);
  }

  Widget _buildToggleGrid(List<_ToggleItem> items) {
    return Wrap(
      spacing: 10,
      runSpacing: 10,
      children: items.map((item) {
        return GestureDetector(
          onTap: () => item.onChanged(!item.isActive),
          child: AnimatedContainer(
            duration: const Duration(milliseconds: 250),
            curve: Curves.easeOut,
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
            decoration: BoxDecoration(
              color: item.isActive
                  ? _maroon.withValues(alpha: 0.1)
                  : Colors.white,
              borderRadius: BorderRadius.circular(14),
              border: Border.all(
                color: item.isActive
                    ? _maroon
                    : _darkText.withValues(alpha: 0.08),
                width: item.isActive ? 1.5 : 1,
              ),
              boxShadow: item.isActive
                  ? [
                      BoxShadow(
                        color: _maroon.withValues(alpha: 0.1),
                        blurRadius: 8,
                        offset: const Offset(0, 3),
                      )
                    ]
                  : [],
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(item.emoji, style: const TextStyle(fontSize: 18)),
                const SizedBox(width: 8),
                Text(
                  item.label,
                  style: TextStyle(
                    fontSize: 13,
                    fontWeight:
                        item.isActive ? FontWeight.w700 : FontWeight.w500,
                    color: item.isActive ? _maroon : _darkText.withValues(alpha: 0.6),
                  ),
                ),
                if (item.isActive) ...[
                  const SizedBox(width: 6),
                  Icon(Icons.check_circle_rounded,
                      color: _maroon, size: 16),
                ],
              ],
            ),
          ),
        );
      }).toList(),
    ).animate().fadeIn(duration: 300.ms, delay: 150.ms);
  }

  // ── Spice Level Selector ──
  Widget _buildSpiceLevelSelector() {
    final levels = [
      _SpiceOption('None', 0),
      _SpiceOption('Mild', 1),
      _SpiceOption('Medium', 2),
      _SpiceOption('Hot', 3),
      _SpiceOption('Extra', 4),
    ];

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: _darkText.withValues(alpha: 0.06)),
      ),
      child: Column(
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: levels.map((level) {
              final isSelected = _spiceLevel == level.value;
              final pepperCount = level.value;
              return GestureDetector(
                onTap: () => setState(() => _spiceLevel = level.value),
                child: AnimatedContainer(
                  duration: const Duration(milliseconds: 200),
                  padding:
                      const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                  decoration: BoxDecoration(
                    color: isSelected
                        ? _getSpiceColor(level.value).withValues(alpha: 0.12)
                        : Colors.transparent,
                    borderRadius: BorderRadius.circular(12),
                    border: isSelected
                        ? Border.all(
                            color: _getSpiceColor(level.value), width: 1.5)
                        : null,
                  ),
                  child: Column(
                    children: [
                      Text(
                        pepperCount == 0
                            ? '\u{1F9CA}'
                            : '\u{1F336}\u{FE0F}' * pepperCount,
                        style: TextStyle(fontSize: pepperCount <= 2 ? 16 : 12),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        level.label,
                        style: TextStyle(
                          fontSize: 11,
                          fontWeight: isSelected
                              ? FontWeight.w700
                              : FontWeight.w500,
                          color: isSelected
                              ? _getSpiceColor(level.value)
                              : _darkText.withValues(alpha: 0.5),
                        ),
                      ),
                    ],
                  ),
                ),
              );
            }).toList(),
          ),
        ],
      ),
    ).animate().fadeIn(duration: 300.ms, delay: 200.ms);
  }

  Color _getSpiceColor(int level) {
    switch (level) {
      case 0:
        return Colors.blue;
      case 1:
        return Colors.green;
      case 2:
        return Colors.orange;
      case 3:
        return Colors.deepOrange;
      case 4:
        return Colors.red.shade800;
      default:
        return _maroon;
    }
  }

  // ── Meal Size Selector ──
  Widget _buildMealSizeSelector() {
    final sizes = [
      _MealSizeOption('Light', '\u{1F37F}', 'light', 'Small appetite'),
      _MealSizeOption('Regular', '\u{1F372}', 'regular', 'Just right'),
      _MealSizeOption('Large', '\u{1F969}', 'large', 'Extra hungry'),
    ];

    return Row(
      children: sizes.map((size) {
        final isSelected = _mealSize == size.value;
        return Expanded(
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 4),
            child: GestureDetector(
              onTap: () => setState(() => _mealSize = size.value),
              child: AnimatedContainer(
                duration: const Duration(milliseconds: 250),
                curve: Curves.easeOut,
                padding: const EdgeInsets.symmetric(vertical: 16),
                decoration: BoxDecoration(
                  color: isSelected
                      ? _maroon.withValues(alpha: 0.1)
                      : Colors.white,
                  borderRadius: BorderRadius.circular(18),
                  border: Border.all(
                    color: isSelected
                        ? _maroon
                        : _darkText.withValues(alpha: 0.08),
                    width: isSelected ? 2 : 1,
                  ),
                  boxShadow: isSelected
                      ? [
                          BoxShadow(
                            color: _maroon.withValues(alpha: 0.12),
                            blurRadius: 12,
                            offset: const Offset(0, 4),
                          )
                        ]
                      : [],
                ),
                child: Column(
                  children: [
                    Text(size.emoji, style: const TextStyle(fontSize: 28)),
                    const SizedBox(height: 8),
                    Text(
                      size.label,
                      style: TextStyle(
                        fontSize: 14,
                        fontWeight:
                            isSelected ? FontWeight.w800 : FontWeight.w600,
                        color: isSelected ? _maroon : _darkText.withValues(alpha: 0.6),
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      size.subtitle,
                      style: TextStyle(
                        fontSize: 11,
                        color: isSelected
                            ? _maroon.withValues(alpha: 0.6)
                            : _darkText.withValues(alpha: 0.35),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        );
      }).toList(),
    ).animate().fadeIn(duration: 300.ms, delay: 250.ms);
  }
}

// ── Data Classes ──
class _DietOption {
  final String label;
  final String emoji;
  final String value;
  final Color color;
  const _DietOption(this.label, this.emoji, this.value, this.color);
}

class _ToggleItem {
  final String label;
  final String emoji;
  final bool isActive;
  final ValueChanged<bool> onChanged;
  const _ToggleItem(this.label, this.emoji, this.isActive, this.onChanged);
}

class _SpiceOption {
  final String label;
  final int value;
  const _SpiceOption(this.label, this.value);
}

class _MealSizeOption {
  final String label;
  final String emoji;
  final String value;
  final String subtitle;
  const _MealSizeOption(this.label, this.emoji, this.value, this.subtitle);
}
