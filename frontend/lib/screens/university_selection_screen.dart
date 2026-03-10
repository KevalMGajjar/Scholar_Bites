import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:geolocator/geolocator.dart';
import 'dart:async';
import '../widgets/primary_button.dart';
import '../widgets/custom_text_field.dart';
import '../services/university_service.dart';
import '../services/auth_service.dart';
import '../models/restaurant_model.dart';
import '../models/user_model.dart';
import '../utils/custom_toast.dart';
import 'home_screen.dart';

class UniversitySelectionScreen extends StatefulWidget {
  final String phoneNumber;
  final bool isExistingUser;
  
  const UniversitySelectionScreen({
    super.key,
    required this.phoneNumber,
    this.isExistingUser = false,
  });

  @override
  State<UniversitySelectionScreen> createState() => _UniversitySelectionScreenState();
}

class _UniversitySelectionScreenState extends State<UniversitySelectionScreen> {
  bool _isSearching = false;
  bool _isRegistering = false;
  bool _isLoadingNearest = true;
  Restaurant? _selectedUniversity;
  Restaurant? _nearestUniversity;
  String _searchQuery = '';
  Timer? _debounce;
  
  List<Restaurant> _searchResults = [];

  @override
  void initState() {
    super.initState();
    _findNearestUniversity();
  }

  @override
  void dispose() {
    _debounce?.cancel();
    super.dispose();
  }

  // Fetch nearest university using device location
  Future<void> _findNearestUniversity() async {
    try {
      bool serviceEnabled = await Geolocator.isLocationServiceEnabled();
      if (!serviceEnabled) {
        debugPrint('Nearest campus: Location services disabled');
        setState(() => _isLoadingNearest = false);
        return;
      }

      LocationPermission permission = await Geolocator.checkPermission();
      if (permission == LocationPermission.denied) {
        permission = await Geolocator.requestPermission();
        if (permission == LocationPermission.denied) {
          debugPrint('Nearest campus: Permission denied');
          setState(() => _isLoadingNearest = false);
          return;
        }
      }
      if (permission == LocationPermission.deniedForever) {
        debugPrint('Nearest campus: Permission denied forever');
        setState(() => _isLoadingNearest = false);
        return;
      }

      // Phase 1: Try last known position (instant, no GPS wait)
      Position? position = await Geolocator.getLastKnownPosition();
      debugPrint('Nearest campus: Last known position = ${position?.latitude}, ${position?.longitude}');

      // Phase 2: If no cached position, get fresh with generous timeout
      if (position == null) {
        debugPrint('Nearest campus: Getting fresh position...');
        position = await Geolocator.getCurrentPosition(
          locationSettings: const LocationSettings(accuracy: LocationAccuracy.low),
        ).timeout(const Duration(seconds: 10));
        debugPrint('Nearest campus: Fresh position = ${position.latitude}, ${position.longitude}');
      }

      final results = await UniversityService().searchUniversities(
        lat: position.latitude,
        lng: position.longitude,
        limit: 1,
      );
      debugPrint('Nearest campus: API returned ${results.length} results');

      if (mounted && results.isNotEmpty) {
        setState(() {
          _nearestUniversity = results[0];
          _isLoadingNearest = false;
        });
      } else if (mounted) {
        setState(() => _isLoadingNearest = false);
      }
    } catch (e) {
      debugPrint('Nearest campus error: $e');
      if (mounted) {
        setState(() => _isLoadingNearest = false);
      }
    }
  }

  // Debounced search against backend
  void _onSearchChanged(String query) {
    setState(() => _searchQuery = query);
    _debounce?.cancel();
    
    if (query.trim().isEmpty) {
      setState(() {
        _searchResults = [];
        _isSearching = false;
      });
      return;
    }

    _debounce = Timer(const Duration(milliseconds: 400), () async {
      setState(() => _isSearching = true);
      try {
        final results = await UniversityService().searchUniversities(q: query.trim());
        if (mounted) {
          setState(() {
            _searchResults = results;
            _isSearching = false;
          });
        }
      } catch (e) {
        if (mounted) setState(() => _isSearching = false);
      }
    });
  }

  void _selectUniversity(Restaurant uni) {
    setState(() {
      _selectedUniversity = uni;
      _searchQuery = '';
      _searchResults = [];
    });
    FocusScope.of(context).unfocus();
  }

  void _finishSetup() async {
    if (_selectedUniversity == null) return;
    
    setState(() => _isRegistering = true);
    
    try {
      UserModel? user;
      if (widget.isExistingUser) {
        user = await AuthService.updateUniversity(
          phone: widget.phoneNumber,
          universityId: _selectedUniversity!.id,
        );
      } else {
        user = await AuthService.registerOtp(
          phone: widget.phoneNumber,
          universityId: _selectedUniversity!.id,
        );
      }
      
      setState(() => _isRegistering = false);
      
      if (user != null && mounted) {
        CustomToast.showSuccessToast(
          context,
          widget.isExistingUser ? 'University updated successfully!' : 'Account created successfully!',
        );
        Navigator.pushAndRemoveUntil(
          context,
          MaterialPageRoute(builder: (context) => const HomeScreen()), 
          (route) => false,
        );
      }
    } catch (e) {
      if (mounted) {
        setState(() => _isRegistering = false);
        CustomToast.showErrorToast(context, e.toString().replaceAll('Exception: ', ''));
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFFDF0F0),
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 24.0),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const SizedBox(height: 40),
              
              Text(
                "Welcome to the club.",
                style: GoogleFonts.poppins(
                  fontSize: 28,
                  fontWeight: FontWeight.bold,
                  color: const Color(0xFF4A0E13),
                ),
              ).animate().fade(duration: 600.ms).slideY(begin: 0.2, end: 0, curve: Curves.easeOutCubic),
              const SizedBox(height: 8),
              Text(
                "Search for your university to get started.",
                style: GoogleFonts.poppins(
                  fontSize: 16,
                  color: const Color(0xFF4A0E13).withValues(alpha: 0.7),
                ),
              ).animate().fade(delay: 200.ms, duration: 600.ms).slideY(begin: 0.2, end: 0, curve: Curves.easeOutCubic),
              
              const SizedBox(height: 30),
              
              CustomTextField(
                hintText: 'Search for your university...',
                prefixIcon: Icons.search_rounded,
                onChanged: _onSearchChanged,
              ).animate().fade(delay: 300.ms, duration: 600.ms).slideX(begin: -0.1),
              
              const SizedBox(height: 20),
              
              // Content Area
              Expanded(
                child: _buildContent(),
              ),

              if (_selectedUniversity != null && _searchQuery.isEmpty)
                _isRegistering
                  ? const Center(
                      child: Padding(
                        padding: EdgeInsets.only(bottom: 20),
                        child: CircularProgressIndicator(color: Color(0xFF8B1C28)),
                      ),
                    )
                  : Padding(
                      padding: const EdgeInsets.only(bottom: 20),
                      child: PrimaryButton(
                        text: 'Enter Campus',
                        onTap: _finishSetup,
                      ).animate().fade(delay: 300.ms, duration: 600.ms).scaleXY(begin: 0.9, end: 1.0, curve: Curves.easeOutBack),
                    ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildContent() {
    // Active search mode
    if (_searchQuery.isNotEmpty) {
      if (_isSearching) {
        return const Center(
          child: CircularProgressIndicator(color: Color(0xFF8B1C28)),
        );
      }
      if (_searchResults.isEmpty) {
        return Center(
          child: Text("No universities found.", style: GoogleFonts.poppins(color: const Color(0xFF4A0E13).withValues(alpha: 0.5))),
        );
      }
      return ListView.builder(
        itemCount: _searchResults.length,
        itemBuilder: (context, index) => _buildUniversityTile(_searchResults[index]),
      ).animate().fade();
    }

    // Default view: Nearest suggestion + selected campus
    return SingleChildScrollView(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Nearest University Suggestion
          if (_isLoadingNearest)
            Center(
              child: Column(
                children: [
                  const SizedBox(height: 30),
                  const CircularProgressIndicator(color: Color(0xFF8B1C28)),
                  const SizedBox(height: 16),
                  Text("Finding nearest campus...", style: GoogleFonts.poppins(color: const Color(0xFF4A0E13).withValues(alpha: 0.7), fontSize: 14)),
                ],
              ),
            ).animate().fade(delay: 400.ms)
          else if (_nearestUniversity != null) ...[
            Text(
              "NEAREST CAMPUS",
              style: GoogleFonts.poppins(
                fontSize: 12,
                fontWeight: FontWeight.w600,
                color: const Color(0xFF8B1C28),
                letterSpacing: 1.5,
              ),
            ).animate().fade(duration: 600.ms).slideX(begin: -0.1),
            const SizedBox(height: 4),
            Text(
              "This university is the closest to your current location. Would you like to select it?",
              style: GoogleFonts.poppins(
                fontSize: 13,
                color: const Color(0xFF4A0E13).withValues(alpha: 0.6),
              ),
            ).animate().fade(delay: 100.ms, duration: 600.ms),
            const SizedBox(height: 12),
            _buildCampusCard(
              _nearestUniversity!,
              subtitle: "📍 Closest to you",
              isSelected: _selectedUniversity?.id == _nearestUniversity!.id,
              onTap: () => _selectUniversity(_nearestUniversity!),
            ),
            const SizedBox(height: 24),
          ],

          // Selected Campus (if different from nearest)
          if (_selectedUniversity != null && _selectedUniversity?.id != _nearestUniversity?.id) ...[
            Text(
              "SELECTED CAMPUS",
              style: GoogleFonts.poppins(
                fontSize: 12,
                fontWeight: FontWeight.w600,
                color: const Color(0xFF8B1C28),
                letterSpacing: 1.5,
              ),
            ).animate().fade(duration: 600.ms).slideX(begin: -0.1),
            const SizedBox(height: 12),
            _buildCampusCard(
              _selectedUniversity!,
              subtitle: "Selected via search",
              isSelected: true,
              onTap: () {},
            ),
            const SizedBox(height: 20),
          ],

          // Hint to search if nothing selected
          if (_selectedUniversity == null && _nearestUniversity == null && !_isLoadingNearest)
            Center(
              child: Column(
                children: [
                  const SizedBox(height: 40),
                  Icon(Icons.school_rounded, size: 64, color: const Color(0xFF8B1C28).withValues(alpha: 0.3)),
                  const SizedBox(height: 16),
                  Text(
                    "Use the search bar above\nto find your university",
                    textAlign: TextAlign.center,
                    style: GoogleFonts.poppins(
                      fontSize: 14,
                      color: const Color(0xFF4A0E13).withValues(alpha: 0.5),
                      height: 1.5,
                    ),
                  ),
                ],
              ),
            ).animate().fade(delay: 500.ms, duration: 600.ms),
        ],
      ),
    );
  }

  Widget _buildUniversityTile(Restaurant uni) {
    final isSelected = _selectedUniversity?.id == uni.id;
    return GestureDetector(
      onTap: () => _selectUniversity(uni),
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        margin: const EdgeInsets.only(bottom: 12),
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: isSelected ? const Color(0xFFF4B3B3).withValues(alpha: 0.3) : Colors.white.withValues(alpha: 0.8),
          borderRadius: BorderRadius.circular(16),
          border: Border.all(
            color: isSelected ? const Color(0xFF8B1C28) : const Color(0xFF8B1C28).withValues(alpha: 0.1),
          ),
        ),
        child: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(8),
              decoration: BoxDecoration(
                color: const Color(0xFFF4B3B3).withValues(alpha: 0.2),
                shape: BoxShape.circle,
              ),
              child: const Icon(Icons.school_rounded, color: Color(0xFF8B1C28), size: 20),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Text(uni.name, style: GoogleFonts.poppins(
                color: const Color(0xFF4A0E13),
                fontWeight: isSelected ? FontWeight.bold : FontWeight.w500,
                fontSize: 15,
              )),
            ),
            if (isSelected) const Icon(Icons.check_circle_rounded, color: Color(0xFF8B1C28), size: 20),
          ],
        ),
      ),
    );
  }

  Widget _buildCampusCard(Restaurant uni, {required String subtitle, required bool isSelected, required VoidCallback onTap}) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        width: double.infinity,
        padding: const EdgeInsets.all(20),
        decoration: BoxDecoration(
          color: isSelected ? const Color(0xFFF4B3B3).withValues(alpha: 0.2) : Colors.white.withValues(alpha: 0.8),
          borderRadius: BorderRadius.circular(20),
          border: Border.all(
            color: isSelected ? const Color(0xFF8B1C28).withValues(alpha: 0.5) : const Color(0xFF8B1C28).withValues(alpha: 0.1), 
            width: 1.5,
          ),
          boxShadow: isSelected ? [
            BoxShadow(
              color: const Color(0xFF8B1C28).withValues(alpha: 0.1),
              blurRadius: 20,
              offset: const Offset(0, 10),
            ),
          ] : null,
        ),
        child: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: const Color(0xFFF4B3B3).withValues(alpha: 0.3),
                shape: BoxShape.circle,
              ),
              child: const Icon(Icons.school_rounded, color: Color(0xFF8B1C28), size: 28),
            ),
            const SizedBox(width: 16),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    uni.name,
                    style: GoogleFonts.poppins(
                      fontSize: 17,
                      fontWeight: FontWeight.bold,
                      color: const Color(0xFF4A0E13),
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    subtitle,
                    style: GoogleFonts.poppins(
                      fontSize: 12,
                      color: const Color(0xFF4A0E13).withValues(alpha: 0.7),
                    ),
                  ),
                ],
              ),
            ),
            if (isSelected) const Icon(Icons.check_circle_rounded, color: Color(0xFF8B1C28)),
          ],
        ),
      ).animate().fade(duration: 600.ms).scaleXY(begin: 0.95, end: 1.0, curve: Curves.easeOutBack),
    );
  }
}
