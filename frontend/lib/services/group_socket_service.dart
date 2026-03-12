import 'package:flutter/foundation.dart';
import 'package:socket_io_client/socket_io_client.dart' as io;
import '../utils/app_config.dart';

/// Manages a Socket.IO connection for group ordering real-time events.
class GroupSocketService {
  io.Socket? _socket;
  String? _currentRoom;

  /// Connect to Socket.IO server and join the group room.
  void connect(String groupCode, {
    VoidCallback? onConnect,
    Function(dynamic)? onMemberJoined,
    Function(dynamic)? onMemberLeft,
    Function(dynamic)? onGroupDeleted,
    Function(dynamic)? onItemAdded,
    Function(dynamic)? onLobbyLocked,
    Function(dynamic)? onLobbyUnlocked,
    Function(dynamic)? onMemberPaid,
    Function(dynamic)? onOrderCompleted,
    VoidCallback? onDisconnect,
  }) {
    // Extract base URL without /api path
    final uri = AppConfig.baseUrl.replaceAll('/api', '');

    _socket = io.io(uri, io.OptionBuilder()
        .setTransports(['websocket'])
        .disableAutoConnect()
        .build());

    _socket!.onConnect((_) {
      debugPrint('🔌 Group socket connected');
      _currentRoom = 'group_$groupCode';
      _socket!.emit('join_room', _currentRoom);
      onConnect?.call();
    });

    // Listen for group events
    if (onMemberJoined != null) {
      _socket!.on('member_joined', onMemberJoined);
    }
    if (onMemberLeft != null) {
      _socket!.on('member_left', onMemberLeft);
    }
    if (onGroupDeleted != null) {
      _socket!.on('group_deleted', onGroupDeleted);
    }
    if (onItemAdded != null) {
      _socket!.on('item_added', onItemAdded);
    }
    if (onLobbyLocked != null) {
      _socket!.on('lobby_locked', onLobbyLocked);
    }
    if (onLobbyUnlocked != null) {
      _socket!.on('lobby_unlocked', onLobbyUnlocked);
    }
    if (onMemberPaid != null) {
      _socket!.on('member_paid', onMemberPaid);
    }
    if (onOrderCompleted != null) {
      _socket!.on('order_completed', onOrderCompleted);
    }

    _socket!.onDisconnect((_) {
      debugPrint('🔌 Group socket disconnected');
      onDisconnect?.call();
    });

    _socket!.connect();
  }

  /// Disconnect and clean up
  void disconnect() {
    _socket?.disconnect();
    _socket?.dispose();
    _socket = null;
    _currentRoom = null;
  }

  bool get isConnected => _socket?.connected ?? false;
}
