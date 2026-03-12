import 'package:flutter/foundation.dart';
import 'package:speech_to_text/speech_to_text.dart';
import 'package:permission_handler/permission_handler.dart';

class SpeechService extends ChangeNotifier {
  static final SpeechService _instance = SpeechService._internal();
  factory SpeechService() => _instance;
  SpeechService._internal();

  final SpeechToText _speech = SpeechToText();
  
  bool _isInitialized = false;
  bool _isListening = false;
  String _lastWords = '';

  bool get isListening => _isListening;
  String get lastWords => _lastWords;
  bool get isInitialized => _isInitialized;

  /// Call once at app startup or before first use
  Future<bool> initialize() async {
    if (_isInitialized) return true;

    // Check microphone permission
    var status = await Permission.microphone.status;
    if (!status.isGranted) {
      status = await Permission.microphone.request();
      if (!status.isGranted) {
        if (kDebugMode) print('Microphone permission denied');
        return false;
      }
    }

    try {
      _isInitialized = await _speech.initialize(
        onStatus: _onSpeechStatus,
        onError: (val) {
          if (kDebugMode) print('Speech recognition error: ${val.errorMsg}');
          _isListening = false;
          notifyListeners();
        },
      );
    } catch (e) {
      if (kDebugMode) print('Speech initialize failed: $e');
      _isInitialized = false;
    }
    
    notifyListeners();
    return _isInitialized;
  }

  void _onSpeechStatus(String status) {
    if (kDebugMode) print('Speech status: $status');
    if (status == 'done' || status == 'notListening') {
      _isListening = false;
      notifyListeners();
    }
  }

  /// Start listening for speech
  Future<void> startListening({
    required Function(String) onResult,
    bool continuous = false,
  }) async {
    if (!_isInitialized) {
      bool initSuccess = await initialize();
      if (!initSuccess) return;
    }

    _lastWords = '';
    _isListening = true;
    notifyListeners();

    await _speech.listen(
      onResult: (result) {
        _lastWords = result.recognizedWords;
        onResult(_lastWords);
        
        // If final result, stop automatically
        if (result.finalResult && !continuous) {
          stopListening();
        }
        notifyListeners();
      },
      listenFor: const Duration(seconds: 10),
      pauseFor: const Duration(seconds: 3),
      partialResults: true,
      cancelOnError: true,
      listenMode: ListenMode.search,
    );
  }

  Future<void> stopListening() async {
    if (!_isListening) return;
    await _speech.stop();
    _isListening = false;
    notifyListeners();
  }

  Future<void> cancelListening() async {
    if (!_isListening) return;
    await _speech.cancel();
    _isListening = false;
    _lastWords = '';
    notifyListeners();
  }
}
