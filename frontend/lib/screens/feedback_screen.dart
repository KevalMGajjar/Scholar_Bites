import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter/services.dart';
import '../services/university_service.dart';
import '../utils/token_storage.dart';

// ─── Colors ──────────────────────────────────────────
const _maroon = Color(0xFF8B1C28);
const _darkText = Color(0xFF4A0E13);
const _bg = Color(0xFFFCF9F5);

// ─── AI Knowledge Base ───────────────────────────────
class _FAQEntry {
  final String question;
  final String answer;
  final List<String> keywords;

  const _FAQEntry({
    required this.question,
    required this.answer,
    required this.keywords,
  });
}

const _knowledgeBase = <_FAQEntry>[
  _FAQEntry(
    question: 'Where is my order?',
    answer:
        'You can track your order in real-time from the Order History section in your profile. '
        'Once your food is being prepared, you\'ll receive a notification. '
        'Most orders are delivered within 15-25 minutes during peak hours.',
    keywords: [
      'order',
      'track',
      'where',
      'status',
      'delivery',
      'late',
      'waiting'
    ],
  ),
  _FAQEntry(
    question: 'I received the wrong order',
    answer:
        'We\'re sorry about that! Please contact the canteen staff directly using the contact options below. '
        'Keep your order receipt handy. Wrong orders are usually resolved within 10 minutes. '
        'If the canteen is closed, email us and we\'ll issue a credit to your wallet.',
    keywords: ['wrong', 'incorrect', 'mistake', 'different', 'not what'],
  ),
  _FAQEntry(
    question: 'How do I pay?',
    answer: 'We support multiple payment methods:\n'
        '\u{2022} UPI (Google Pay, PhonePe, Paytm)\n'
        '\u{2022} Debit/Credit Cards\n'
        '\u{2022} Wallet\n\n'
        'All payments are processed securely through Razorpay. '
        'You can add money to your wallet for faster checkout.',
    keywords: ['pay', 'payment', 'upi', 'card', 'wallet', 'money', 'razorpay'],
  ),
  _FAQEntry(
    question: 'I want a refund',
    answer:
        'Refunds are processed within 3-5 business days to your original payment method. '
        'To request a refund:\n'
        '1. Go to Order History\n'
        '2. Select the order\n'
        '3. Tap "Request Refund"\n\n'
        'If the option isn\'t available, please email us with your order ID.',
    keywords: ['refund', 'money back', 'return', 'cancel', 'cancelled'],
  ),
  _FAQEntry(
    question: 'The app is slow or crashing',
    answer: 'Try these steps:\n'
        '1. Close and reopen the app\n'
        '2. Check your internet connection\n'
        '3. Clear the app cache from your phone settings\n'
        '4. Update to the latest version\n\n'
        'If the issue persists, please email us with your phone model and Android version.',
    keywords: [
      'slow',
      'crash',
      'bug',
      'error',
      'not working',
      'lag',
      'freeze',
      'stuck'
    ],
  ),
  _FAQEntry(
    question: 'How do I change my university?',
    answer: 'To switch your university:\n'
        '1. Go to Profile\n'
        '2. Log out\n'
        '3. Log in again with your phone number\n'
        '4. You\'ll be prompted to select a new university\n\n'
        'Your wallet balance and order history will carry over.',
    keywords: ['university', 'change', 'switch', 'campus', 'college'],
  ),
  _FAQEntry(
    question: 'Food quality issue',
    answer: 'We take food quality very seriously! Please:\n'
        '1. Take a photo of the food item\n'
        '2. Contact the canteen staff immediately using the options below\n'
        '3. We\'ll investigate and take appropriate action\n\n'
        'Your feedback helps us maintain high standards across all canteens.',
    keywords: [
      'quality',
      'bad',
      'stale',
      'cold',
      'taste',
      'hygiene',
      'dirty',
      'hair'
    ],
  ),
  _FAQEntry(
    question: 'Canteen operating hours',
    answer: 'Operating hours vary by canteen. Generally:\n'
        '\u{2022} Breakfast: 7:30 AM - 10:00 AM\n'
        '\u{2022} Lunch: 12:00 PM - 3:00 PM\n'
        '\u{2022} Snacks: 4:00 PM - 6:00 PM\n'
        '\u{2022} Dinner: 7:00 PM - 9:30 PM\n\n'
        'Check individual restaurant pages for exact timings.',
    keywords: ['hours', 'time', 'open', 'close', 'timing', 'when', 'schedule'],
  ),
];

class FeedbackScreen extends StatefulWidget {
  const FeedbackScreen({super.key});

  @override
  State<FeedbackScreen> createState() => _FeedbackScreenState();
}

class _FeedbackScreenState extends State<FeedbackScreen> {
  final TextEditingController _chatController = TextEditingController();
  final ScrollController _scrollController = ScrollController();
  final List<_ChatMessage> _messages = [];
  bool _showQuickTopics = true;
  Map<String, dynamic>? _university;

  @override
  void initState() {
    super.initState();
    _loadUniversity();
    
    // Welcome message
    _messages.add(_ChatMessage(
      text: 'Hey there! \u{1F44B} I\'m your Ahmedabad University Canteen assistant.\n\n'
          'Ask me anything about orders, payments, refunds, or food quality — '
          'or tap a topic below to get started!',
      isBot: true,
    ));
  }

  @override
  void dispose() {
    _chatController.dispose();
    _scrollController.dispose();
    super.dispose();
  }
  void _loadUniversity() async {
    final uniId = await TokenStorage.getUniversityId();
    if (uniId != null) {
      final uni = await UniversityService().getUniversityById(uniId);
      if (mounted) {
        setState(() {
          _university = uni;
        });
      }
    }
  }

  void _handleSend() {
    final text = _chatController.text.trim();
    if (text.isEmpty) return;

    setState(() {
      _messages.add(_ChatMessage(text: text, isBot: false));
      _showQuickTopics = false;
    });
    _chatController.clear();
    _scrollToBottom();

    // Simulate typing delay
    Future.delayed(const Duration(milliseconds: 600), () {
      final response = _findBestResponse(text);
      if (mounted) {
        setState(() {
          _messages.add(_ChatMessage(text: response, isBot: true));
          _showQuickTopics = true;
        });
        _scrollToBottom();
      }
    });
  }

  void _handleQuickTopic(_FAQEntry entry) {
    setState(() {
      _messages.add(_ChatMessage(text: entry.question, isBot: false));
      _showQuickTopics = false;
    });
    _scrollToBottom();

    Future.delayed(const Duration(milliseconds: 400), () {
      if (mounted) {
        setState(() {
          _messages.add(_ChatMessage(text: entry.answer, isBot: true));
          _showQuickTopics = true;
        });
        _scrollToBottom();
      }
    });
  }

  String _findBestResponse(String query) {
    final lower = query.toLowerCase();

    // Score each FAQ based on keyword matches
    int bestScore = 0;
    String bestAnswer = '';

    for (final faq in _knowledgeBase) {
      int score = 0;
      for (final keyword in faq.keywords) {
        if (lower.contains(keyword.toLowerCase())) {
          score += 2;
        }
      }
      // Also check question similarity
      final questionWords = faq.question.toLowerCase().split(' ');
      for (final word in questionWords) {
        if (word.length > 3 && lower.contains(word)) {
          score += 1;
        }
      }
      if (score > bestScore) {
        bestScore = score;
        bestAnswer = faq.answer;
      }
    }

    if (bestScore >= 2) {
      return bestAnswer;
    }

    // Greeting detection
    if (lower.contains('hi') ||
        lower.contains('hello') ||
        lower.contains('hey')) {
      return 'Hello! \u{1F60A} How can I help you today? Feel free to ask about orders, payments, food quality, or anything else!';
    }

    // Thank you detection
    if (lower.contains('thank') || lower.contains('thanks')) {
      return 'You\'re welcome! \u{1F60A} Happy to help! If you have more questions, feel free to ask.';
    }

    // Fallback
    return 'I\'m not sure I understand that query. \u{1F914}\n\n'
        'Here are some things I can help with:\n'
        '\u{2022} Order tracking & delivery\n'
        '\u{2022} Payments & refunds\n'
        '\u{2022} Food quality issues\n'
        '\u{2022} Canteen hours\n\n'
        'Or you can use the contact options below to reach our team directly!';
  }

  void _scrollToBottom() {
    Future.delayed(const Duration(milliseconds: 100), () {
      if (_scrollController.hasClients) {
        _scrollController.animateTo(
          _scrollController.position.maxScrollExtent + 100,
          duration: const Duration(milliseconds: 300),
          curve: Curves.easeOut,
        );
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: _bg,
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        elevation: 0,
        foregroundColor: _darkText,
        title: Row(
          children: [
            Container(
              width: 34,
              height: 34,
              decoration: BoxDecoration(
                gradient: const LinearGradient(
                  colors: [_maroon, Color(0xFFB33A3A)],
                ),
                borderRadius: BorderRadius.circular(10),
              ),
              child: const Icon(Icons.support_agent_rounded,
                  color: Colors.white, size: 20),
            ),
            const SizedBox(width: 10),
            const Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Help & Support',
                  style: TextStyle(
                    fontSize: 17,
                    fontWeight: FontWeight.w800,
                    color: _darkText,
                  ),
                ),
                Text(
                  'Always here to help',
                  style: TextStyle(
                    fontSize: 11,
                    color: Color(0xFF999999),
                    fontWeight: FontWeight.w500,
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
      body: Column(
        children: [
          // Chat messages
          Expanded(
            child: ListView.builder(
              controller: _scrollController,
              physics: const BouncingScrollPhysics(),
              padding: const EdgeInsets.fromLTRB(16, 8, 16, 16),
              itemCount: _messages.length + (_showQuickTopics ? 1 : 0),
              itemBuilder: (context, index) {
                if (index < _messages.length) {
                  final msg = _messages[index];
                  return _buildChatBubble(msg, index);
                }
                // Quick topics section
                return _buildQuickTopics();
              },
            ),
          ),

          // Contact bar
          _buildContactBar(),

          // Input bar
          _buildInputBar(),
        ],
      ),
    );
  }

  Widget _buildChatBubble(_ChatMessage msg, int index) {
    return Align(
      alignment: msg.isBot ? Alignment.centerLeft : Alignment.centerRight,
      child: Container(
        constraints:
            BoxConstraints(maxWidth: MediaQuery.of(context).size.width * 0.8),
        margin: EdgeInsets.only(
          top: index == 0 ? 4 : 8,
          bottom: 4,
          left: msg.isBot ? 0 : 40,
          right: msg.isBot ? 40 : 0,
        ),
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
        decoration: BoxDecoration(
          color: msg.isBot ? Colors.white : _maroon,
          borderRadius: BorderRadius.only(
            topLeft: const Radius.circular(20),
            topRight: const Radius.circular(20),
            bottomLeft: Radius.circular(msg.isBot ? 6 : 20),
            bottomRight: Radius.circular(msg.isBot ? 20 : 6),
          ),
          boxShadow: [
            BoxShadow(
              color:
                  (msg.isBot ? Colors.black : _maroon).withValues(alpha: 0.08),
              blurRadius: 12,
              offset: const Offset(0, 3),
            ),
          ],
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            if (msg.isBot) ...[
              const Text('\u{1F916}', style: TextStyle(fontSize: 16)),
              const SizedBox(width: 8),
            ],
            Flexible(
              child: Text(
                msg.text,
                style: TextStyle(
                  color: msg.isBot ? _darkText : Colors.white,
                  fontSize: 14,
                  fontWeight: FontWeight.w500,
                  height: 1.45,
                ),
              ),
            ),
          ],
        ),
      ),
    ).animate().fadeIn(duration: 250.ms).slideY(begin: 0.1, end: 0);
  }

  Widget _buildQuickTopics() {
    final quickTopics = [
      _knowledgeBase[0], // Where is my order
      _knowledgeBase[2], // How do I pay
      _knowledgeBase[3], // Refund
      _knowledgeBase[4], // App issues
      _knowledgeBase[6], // Food quality
      _knowledgeBase[7], // Hours
    ];

    return Padding(
      padding: const EdgeInsets.only(top: 8),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: const EdgeInsets.only(left: 4, bottom: 10),
            child: Text(
              'Quick Topics',
              style: TextStyle(
                fontSize: 13,
                fontWeight: FontWeight.w700,
                color: _darkText.withValues(alpha: 0.4),
                letterSpacing: 0.5,
              ),
            ),
          ),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: quickTopics.map((faq) {
              return GestureDetector(
                onTap: () => _handleQuickTopic(faq),
                child: Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(
                        color: _maroon.withValues(alpha: 0.12), width: 1),
                    boxShadow: [
                      BoxShadow(
                        color: _maroon.withValues(alpha: 0.04),
                        blurRadius: 8,
                        offset: const Offset(0, 2),
                      ),
                    ],
                  ),
                  child: Text(
                    faq.question,
                    style: TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.w600,
                      color: _maroon.withValues(alpha: 0.8),
                    ),
                  ),
                ),
              );
            }).toList(),
          ),
        ],
      ),
    ).animate().fadeIn(duration: 400.ms, delay: 200.ms);
  }

  Widget _buildContactBar() {
    final supportEmail = _university?['support_email'] as String?;
    final supportPhone = _university?['support_phone'] as String?;

    final hasCustomEmail = supportEmail != null && supportEmail.trim().isNotEmpty;
    final hasCustomPhone = supportPhone != null && supportPhone.trim().isNotEmpty;

    final List<Widget> chips = [];

    chips.add(Expanded(
      child: _buildContactChip(
        icon: Icons.email_rounded,
        label: 'Email Us',
        color: const Color(0xFF5C6BC0),
        onTap: () => _showContactInfo(
          'Email Support',
          'scholarbites@gmail.com',
          'Send us an email for detailed issues, refund requests, or suggestions. We typically respond within 24 hours.',
          Icons.email_rounded,
        ),
      ),
    ));

    String staffDetails = 'Visit the canteen counter and ask for the manager. They can help with immediate orders and food quality.';
    if (hasCustomEmail || hasCustomPhone) {
      staffDetails += '\n\nUniversity Contact Details:';
      if (hasCustomPhone) staffDetails += '\nPhone: $supportPhone';
      if (hasCustomEmail) staffDetails += '\nEmail: $supportEmail';
    }

    chips.add(Expanded(
      child: _buildContactChip(
        icon: Icons.people_alt_rounded,
        label: 'Staff',
        color: const Color(0xFF2E7D32),
        onTap: () => _showContactInfo(
          'University Staff',
          'Canteen Manager',
          staffDetails,
          Icons.people_alt_rounded,
        ),
      ),
    ));

    chips.add(Expanded(
      child: _buildContactChip(
        icon: Icons.phone_rounded,
        label: 'Call',
        color: const Color(0xFFE65100),
        onTap: () => _showContactInfo(
          'Call Support',
          '7016806164',
          'Available Monday - Saturday\n9:00 AM - 6:00 PM\n\nFor urgent issues during canteen hours, call the helpline directly.',
          Icons.phone_rounded,
        ),
      ),
    ));

    final List<Widget> spacedChips = [];
    for (int i = 0; i < chips.length; i++) {
      spacedChips.add(chips[i]);
      if (i < chips.length - 1) {
        spacedChips.add(const SizedBox(width: 10));
      }
    }

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
      decoration: BoxDecoration(
        color: Colors.white,
        border: Border(
          top: BorderSide(color: _darkText.withValues(alpha: 0.06)),
        ),
      ),
      child: Row(children: spacedChips),
    );
  }

  Widget _buildContactChip({
    required IconData icon,
    required String label,
    required Color color,
    required VoidCallback onTap,
  }) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 10),
        decoration: BoxDecoration(
          color: color.withValues(alpha: 0.08),
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: color.withValues(alpha: 0.15)),
        ),
        child: Column(
          children: [
            Icon(icon, color: color, size: 20),
            const SizedBox(height: 4),
            Text(
              label,
              style: TextStyle(
                fontSize: 11,
                fontWeight: FontWeight.w700,
                color: color,
              ),
            ),
          ],
        ),
      ),
    );
  }

  void _showContactInfo(
      String title, String detail, String description, IconData icon) {
    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.transparent,
      builder: (context) => Container(
        padding: const EdgeInsets.all(24),
        decoration: const BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 40,
              height: 4,
              decoration: BoxDecoration(
                color: Colors.grey[300],
                borderRadius: BorderRadius.circular(2),
              ),
            ),
            const SizedBox(height: 20),
            Container(
              width: 56,
              height: 56,
              decoration: BoxDecoration(
                color: _maroon.withValues(alpha: 0.08),
                shape: BoxShape.circle,
              ),
              child: Icon(icon, color: _maroon, size: 28),
            ),
            const SizedBox(height: 16),
            Text(
              title,
              style: const TextStyle(
                fontSize: 20,
                fontWeight: FontWeight.w800,
                color: _darkText,
              ),
            ),
            const SizedBox(height: 8),
            GestureDetector(
              onTap: () {
                Clipboard.setData(ClipboardData(text: detail));
                ScaffoldMessenger.of(context).showSnackBar(
                  SnackBar(
                    content: const Text('Copied to clipboard!'),
                    backgroundColor: _maroon,
                    behavior: SnackBarBehavior.floating,
                    shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(12)),
                  ),
                );
              },
              child: Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 20, vertical: 10),
                decoration: BoxDecoration(
                  color: _maroon.withValues(alpha: 0.06),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(
                      detail,
                      style: const TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.w700,
                        color: _maroon,
                      ),
                    ),
                    const SizedBox(width: 8),
                    Icon(Icons.copy_rounded,
                        color: _maroon.withValues(alpha: 0.5), size: 16),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 16),
            Text(
              description,
              textAlign: TextAlign.center,
              style: TextStyle(
                fontSize: 13.5,
                color: _darkText.withValues(alpha: 0.55),
                fontWeight: FontWeight.w500,
                height: 1.5,
              ),
            ),
            const SizedBox(height: 24),
          ],
        ),
      ),
    );
  }

  Widget _buildInputBar() {
    return Container(
      padding: EdgeInsets.fromLTRB(
          16, 12, 16, MediaQuery.of(context).padding.bottom + 12),
      decoration: BoxDecoration(
        color: Colors.white,
        border: Border(
          top: BorderSide(color: _darkText.withValues(alpha: 0.04)),
        ),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.03),
            blurRadius: 10,
            offset: const Offset(0, -4),
          ),
        ],
      ),
      child: Row(
        children: [
          Expanded(
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              decoration: BoxDecoration(
                color: _bg,
                borderRadius: BorderRadius.circular(24),
                border: Border.all(color: _darkText.withValues(alpha: 0.06)),
              ),
              child: TextField(
                controller: _chatController,
                onSubmitted: (_) => _handleSend(),
                textInputAction: TextInputAction.send,
                style: const TextStyle(
                  fontSize: 14,
                  color: _darkText,
                  fontWeight: FontWeight.w500,
                ),
                decoration: InputDecoration(
                  hintText: 'Type your question...',
                  hintStyle: TextStyle(
                    color: _darkText.withValues(alpha: 0.3),
                    fontWeight: FontWeight.w500,
                  ),
                  border: InputBorder.none,
                  contentPadding: const EdgeInsets.symmetric(vertical: 12),
                ),
              ),
            ),
          ),
          const SizedBox(width: 10),
          GestureDetector(
            onTap: _handleSend,
            child: Container(
              width: 44,
              height: 44,
              decoration: BoxDecoration(
                gradient: const LinearGradient(
                  colors: [_maroon, Color(0xFFB33A3A)],
                ),
                borderRadius: BorderRadius.circular(14),
                boxShadow: [
                  BoxShadow(
                    color: _maroon.withValues(alpha: 0.3),
                    blurRadius: 10,
                    offset: const Offset(0, 4),
                  ),
                ],
              ),
              child:
                  const Icon(Icons.send_rounded, color: Colors.white, size: 20),
            ),
          ),
        ],
      ),
    );
  }
}

class _ChatMessage {
  final String text;
  final bool isBot;

  const _ChatMessage({required this.text, required this.isBot});
}
