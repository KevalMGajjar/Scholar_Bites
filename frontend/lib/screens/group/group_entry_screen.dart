import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:mobile_scanner/mobile_scanner.dart';
import '../../services/group_service.dart';
import '../../utils/custom_toast.dart';
import '../../widgets/spoon_loader.dart';
import 'group_lobby_screen.dart';

class GroupEntryScreen extends StatefulWidget {
  const GroupEntryScreen({super.key});

  @override
  State<GroupEntryScreen> createState() => _GroupEntryScreenState();
}

class _GroupEntryScreenState extends State<GroupEntryScreen> with SingleTickerProviderStateMixin {
  late TabController _tabController;
  final _nicknameController = TextEditingController();
  final _codeController = TextEditingController();
  final _groupService = GroupService();
  bool _isLoading = false;

  static const _maroon = Color(0xFF8B1C28);
  static const _darkText = Color(0xFF4A0E13);
  static const _bg = Color(0xFFFCF9F5);

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 2, vsync: this);
  }

  @override
  void dispose() {
    _tabController.dispose();
    _nicknameController.dispose();
    _codeController.dispose();
    super.dispose();
  }

  Future<void> _createGroup() async {
    final nickname = _nicknameController.text.trim();
    if (nickname.isEmpty) {
      CustomToast.showErrorToast(context, 'Enter a nickname first');
      return;
    }
    setState(() => _isLoading = true);
    try {
      final data = await _groupService.createGroup(nickname);
      if (!mounted) return;
      Navigator.pushReplacement(
        context,
        MaterialPageRoute(
          builder: (_) => GroupLobbyScreen(
            groupCode: data['code'],
            isLeader: true,
            myNickname: nickname,
            myUserId: data['creator_id'],
          ),
        ),
      );
    } catch (e) {
      if (mounted) {
        CustomToast.showErrorToast(context, 'Failed to create group');
        setState(() => _isLoading = false);
      }
    }
  }

  Future<void> _joinGroup(String code) async {
    final nickname = _nicknameController.text.trim();
    if (nickname.isEmpty) {
      CustomToast.showErrorToast(context, 'Enter a nickname first');
      return;
    }
    if (code.isEmpty) {
      CustomToast.showErrorToast(context, 'Enter a group code');
      return;
    }
    setState(() => _isLoading = true);
    try {
      final data = await _groupService.joinGroup(code.toUpperCase(), nickname);
      if (!mounted) return;
      final groupOrder = data['groupOrder'];
      Navigator.pushReplacement(
        context,
        MaterialPageRoute(
          builder: (_) => GroupLobbyScreen(
            groupCode: groupOrder['code'],
            isLeader: false,
            myNickname: nickname,
            myUserId: '', // Will be fetched from state
          ),
        ),
      );
    } catch (e) {
      if (mounted) {
        CustomToast.showErrorToast(context, 'Group not found or already locked');
        setState(() => _isLoading = false);
      }
    }
  }

  void _openQRScanner() {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.black,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (_) => SizedBox(
        height: MediaQuery.of(context).size.height * 0.6,
        child: Column(
          children: [
            const SizedBox(height: 16),
            Container(width: 40, height: 4, decoration: BoxDecoration(color: Colors.white38, borderRadius: BorderRadius.circular(2))),
            const SizedBox(height: 20),
            Text('Scan Group QR Code', style: GoogleFonts.poppins(color: Colors.white, fontSize: 18, fontWeight: FontWeight.w600)),
            const SizedBox(height: 20),
            Expanded(
              child: ClipRRect(
                borderRadius: BorderRadius.circular(16),
                child: MobileScanner(
                  onDetect: (capture) {
                    final barcode = capture.barcodes.firstOrNull;
                    if (barcode?.rawValue != null) {
                      Navigator.pop(context);
                      final code = barcode!.rawValue!;
                      _codeController.text = code;
                      _joinGroup(code);
                    }
                  },
                ),
              ),
            ),
            const SizedBox(height: 30),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: _bg,
      resizeToAvoidBottomInset: true,
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        elevation: 0,
        foregroundColor: _darkText,
        title: Text('Group Order', style: GoogleFonts.poppins(fontWeight: FontWeight.w800, fontSize: 22)),
      ),
      body: _isLoading
          ? Center(child: SpoonLoader(size: 60))
          : Column(
              children: [
                const SizedBox(height: 8),
                // ─── Nickname Field ───
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 24),
                  child: _buildNicknameField(),
                ).animate().fadeIn(duration: 400.ms).slideY(begin: 0.1),

                const SizedBox(height: 24),

                // ─── Tab Bar ───
                Container(
                  margin: const EdgeInsets.symmetric(horizontal: 24),
                  decoration: BoxDecoration(
                    color: _maroon.withValues(alpha: 0.08),
                    borderRadius: BorderRadius.circular(16),
                  ),
                  child: TabBar(
                    controller: _tabController,
                    indicator: BoxDecoration(
                      color: _maroon,
                      borderRadius: BorderRadius.circular(14),
                    ),
                    labelColor: Colors.white,
                    unselectedLabelColor: _maroon,
                    labelStyle: GoogleFonts.poppins(fontWeight: FontWeight.w700, fontSize: 14),
                    unselectedLabelStyle: GoogleFonts.poppins(fontWeight: FontWeight.w600, fontSize: 14),
                    dividerColor: Colors.transparent,
                    indicatorSize: TabBarIndicatorSize.tab,
                    padding: const EdgeInsets.all(4),
                    tabs: const [
                      Tab(text: '🚀 Create Group'),
                      Tab(text: '🔗 Join Group'),
                    ],
                  ),
                ).animate().fadeIn(delay: 200.ms, duration: 400.ms),

                const SizedBox(height: 24),

                // ─── Tab Views ───
                Expanded(
                  child: TabBarView(
                    controller: _tabController,
                    children: [
                      _buildCreateTab(),
                      _buildJoinTab(),
                    ],
                  ),
                ),
              ],
            ),
    );
  }

  Widget _buildNicknameField() {
    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: _maroon.withValues(alpha: 0.12)),
        boxShadow: [
          BoxShadow(color: _maroon.withValues(alpha: 0.06), blurRadius: 20, offset: const Offset(0, 6)),
        ],
      ),
      child: TextField(
        controller: _nicknameController,
        textCapitalization: TextCapitalization.words,
        style: GoogleFonts.poppins(fontSize: 16, fontWeight: FontWeight.w600, color: _darkText),
        decoration: InputDecoration(
          hintText: 'Your nickname...',
          hintStyle: GoogleFonts.poppins(color: _darkText.withValues(alpha: 0.35)),
          prefixIcon: const Icon(Icons.person_outline_rounded, color: _maroon),
          border: InputBorder.none,
          contentPadding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
        ),
      ),
    );
  }

  Widget _buildCreateTab() {
    return SingleChildScrollView(
      padding: const EdgeInsets.symmetric(horizontal: 24),
      child: Column(
        children: [
          // Illustration
          Container(
            padding: const EdgeInsets.all(32),
            decoration: BoxDecoration(
              gradient: LinearGradient(
                colors: [_maroon.withValues(alpha: 0.08), _maroon.withValues(alpha: 0.02)],
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              ),
              borderRadius: BorderRadius.circular(24),
            ),
            child: Column(
              children: [
                const Text('👥', style: TextStyle(fontSize: 64)),
                const SizedBox(height: 16),
                Text(
                  'Start a Group Order',
                  style: GoogleFonts.poppins(fontSize: 20, fontWeight: FontWeight.w800, color: _darkText),
                ),
                const SizedBox(height: 8),
                Text(
                  'Create a group and share the code\nwith your friends to order together!',
                  textAlign: TextAlign.center,
                  style: GoogleFonts.poppins(fontSize: 14, color: _darkText.withValues(alpha: 0.6), height: 1.5),
                ),
              ],
            ),
          ).animate().fadeIn(delay: 300.ms, duration: 500.ms).scaleXY(begin: 0.95),

          const SizedBox(height: 40),

          // Create Button
          GestureDetector(
            onTap: _createGroup,
            child: Container(
              width: double.infinity,
              padding: const EdgeInsets.symmetric(vertical: 18),
              decoration: BoxDecoration(
                gradient: const LinearGradient(colors: [_maroon, Color(0xFFB52A3A)]),
                borderRadius: BorderRadius.circular(18),
                boxShadow: [
                  BoxShadow(color: _maroon.withValues(alpha: 0.35), blurRadius: 20, offset: const Offset(0, 8)),
                ],
              ),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  const Icon(Icons.group_add_rounded, color: Colors.white, size: 22),
                  const SizedBox(width: 10),
                  Text('Create Group', style: GoogleFonts.poppins(color: Colors.white, fontSize: 16, fontWeight: FontWeight.w700)),
                ],
              ),
            ),
          ).animate().fadeIn(delay: 500.ms, duration: 500.ms).slideY(begin: 0.2),

          const SizedBox(height: 40),
        ],
      ),
    );
  }

  Widget _buildJoinTab() {
    return SingleChildScrollView(
      padding: const EdgeInsets.symmetric(horizontal: 24),
      child: Column(
        children: [
          // Code input
          Container(
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(18),
              border: Border.all(color: _maroon.withValues(alpha: 0.12)),
              boxShadow: [
                BoxShadow(color: _maroon.withValues(alpha: 0.06), blurRadius: 20, offset: const Offset(0, 6)),
              ],
            ),
            child: TextField(
              controller: _codeController,
              textCapitalization: TextCapitalization.characters,
              style: GoogleFonts.poppins(
                fontSize: 24,
                fontWeight: FontWeight.w800,
                color: _darkText,
                letterSpacing: 8,
              ),
              textAlign: TextAlign.center,
              maxLength: 6,
              decoration: InputDecoration(
                hintText: 'CODE',
                hintStyle: GoogleFonts.poppins(
                  color: _darkText.withValues(alpha: 0.2),
                  fontSize: 24,
                  fontWeight: FontWeight.w800,
                  letterSpacing: 8,
                ),
                counterText: '',
                border: InputBorder.none,
                contentPadding: const EdgeInsets.symmetric(vertical: 20),
              ),
            ),
          ).animate().fadeIn(delay: 300.ms, duration: 400.ms),

          const SizedBox(height: 16),

          // Join button
          GestureDetector(
            onTap: () => _joinGroup(_codeController.text.trim()),
            child: Container(
              width: double.infinity,
              padding: const EdgeInsets.symmetric(vertical: 18),
              decoration: BoxDecoration(
                gradient: const LinearGradient(colors: [_maroon, Color(0xFFB52A3A)]),
                borderRadius: BorderRadius.circular(18),
                boxShadow: [
                  BoxShadow(color: _maroon.withValues(alpha: 0.35), blurRadius: 20, offset: const Offset(0, 8)),
                ],
              ),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  const Icon(Icons.login_rounded, color: Colors.white, size: 22),
                  const SizedBox(width: 10),
                  Text('Join Group', style: GoogleFonts.poppins(color: Colors.white, fontSize: 16, fontWeight: FontWeight.w700)),
                ],
              ),
            ),
          ).animate().fadeIn(delay: 400.ms),

          const SizedBox(height: 24),

          // OR divider
          Row(
            children: [
              Expanded(child: Divider(color: _darkText.withValues(alpha: 0.1))),
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 16),
                child: Text('OR', style: GoogleFonts.poppins(color: _darkText.withValues(alpha: 0.35), fontWeight: FontWeight.w700)),
              ),
              Expanded(child: Divider(color: _darkText.withValues(alpha: 0.1))),
            ],
          ),

          const SizedBox(height: 24),

          // QR Scanner button
          GestureDetector(
            onTap: _openQRScanner,
            child: Container(
              width: double.infinity,
              padding: const EdgeInsets.symmetric(vertical: 18),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(18),
                border: Border.all(color: _maroon.withValues(alpha: 0.2), width: 1.5),
              ),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(Icons.qr_code_scanner_rounded, color: _maroon, size: 24),
                  const SizedBox(width: 10),
                  Text('Scan QR Code', style: GoogleFonts.poppins(color: _maroon, fontSize: 16, fontWeight: FontWeight.w700)),
                ],
              ),
            ),
          ).animate().fadeIn(delay: 500.ms).slideY(begin: 0.1),

          const SizedBox(height: 40),
        ],
      ),
    );
  }
}
