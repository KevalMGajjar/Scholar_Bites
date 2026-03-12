import 'dart:math';
import 'package:flutter/material.dart';
import 'package:flutter/scheduler.dart';
import '../utils/token_storage.dart';

class PhysicsItem {
  final int id;
  final Widget child;
  Offset position;
  Offset velocity;
  final double radius;
  bool isDragged;

  PhysicsItem({
    required this.id,
    required this.child,
    required this.position,
    required this.velocity,
    required this.radius,
    this.isDragged = false,
  });
}

class PhysicsCravingsBox extends StatefulWidget {
  final List<Widget> items;
  final double itemRadius;
  final double boxHeight;
  final Function(int)? onItemTap;

  const PhysicsCravingsBox({
    super.key,
    required this.items,
    this.itemRadius = 45.0,
    this.boxHeight = 200.0,
    this.onItemTap,
  });

  @override
  State<PhysicsCravingsBox> createState() => _PhysicsCravingsBoxState();
}

class _PhysicsCravingsBoxState extends State<PhysicsCravingsBox>
    with SingleTickerProviderStateMixin {
  late Ticker _ticker;
  late List<PhysicsItem> _items;
  double _boxWidth = 0;
  Offset? _lastDragPos;
  Offset? _dragStartPos;
  bool _wasDraggedFar = false;
  
  bool _hasSeenHint = true;
  int _hintIndex = 0;

  // Use a ValueNotifier to trigger repaints without calling setState
  final ValueNotifier<int> _frameNotifier = ValueNotifier<int>(0);

  @override
  void initState() {
    super.initState();
    _initItems();
    _ticker = createTicker(_tick)..start();
    _checkHintStatus();
  }

  Future<void> _checkHintStatus() async {
    final hasSeen = await TokenStorage.getHasSeenFlickHint();
    if (!hasSeen && mounted) {
      setState(() {
        _hasSeenHint = false;
        _hintIndex = Random().nextInt(widget.items.length);
      });
    }
  }

  void _initItems() {
    final random = Random();
    _items = [];
    for (int i = 0; i < widget.items.length; i++) {
      Widget content = widget.items[i];
      _items.add(PhysicsItem(
        id: i,
        child: content,
        position: Offset(
          random.nextDouble() * 300,
          random.nextDouble() * widget.boxHeight,
        ),
        velocity: Offset(
          (random.nextDouble() - 0.5) * 600,
          (random.nextDouble() - 0.5) * 600,
        ),
        radius: widget.itemRadius,
      ));
    }
  }

  @override
  void dispose() {
    _ticker.dispose();
    _frameNotifier.dispose();
    super.dispose();
  }

  void _tick(Duration elapsed) {
    if (_boxWidth == 0) return;
    const dt = 16.0 / 1000.0;

    // Update physics WITHOUT calling setState
    for (var item in _items) {
      if (item.isDragged) continue;

      item.velocity *= 0.99;

      if (item.velocity.distance < 10) {
        item.velocity += Offset(
          (Random().nextDouble() - 0.5) * 10,
          (Random().nextDouble() - 0.5) * 10,
        );
      }

      item.position += item.velocity * dt;

      // Wall collisions
      if (item.position.dx < 0) {
        item.position = Offset(0, item.position.dy);
        item.velocity = Offset(item.velocity.dx.abs() * 0.8, item.velocity.dy);
      } else if (item.position.dx > _boxWidth - item.radius * 2) {
        item.position = Offset(_boxWidth - item.radius * 2, item.position.dy);
        item.velocity = Offset(-item.velocity.dx.abs() * 0.8, item.velocity.dy);
      }

      if (item.position.dy < 0) {
        item.position = Offset(item.position.dx, 0);
        item.velocity = Offset(item.velocity.dx, item.velocity.dy.abs() * 0.8);
      } else if (item.position.dy > widget.boxHeight - item.radius * 2) {
        item.position = Offset(item.position.dx, widget.boxHeight - item.radius * 2);
        item.velocity = Offset(item.velocity.dx, -item.velocity.dy.abs() * 0.8);
      }
    }

    // Circle vs Circle collisions
    for (int i = 0; i < _items.length; i++) {
      for (int j = i + 1; j < _items.length; j++) {
        final a = _items[i];
        final b = _items[j];

        final dx = (b.position.dx + b.radius) - (a.position.dx + a.radius);
        final dy = (b.position.dy + b.radius) - (a.position.dy + a.radius);
        final distance = sqrt(dx * dx + dy * dy);
        final minDist = a.radius + b.radius;

        if (distance < minDist && distance > 0) {
          final overlap = minDist - distance;
          final nx = dx / distance;
          final ny = dy / distance;

          if (!a.isDragged) {
            a.position -= Offset(nx * overlap / 2, ny * overlap / 2);
          }
          if (!b.isDragged) {
            b.position += Offset(nx * overlap / 2, ny * overlap / 2);
          }

          final dpNorm1 = a.velocity.dx * nx + a.velocity.dy * ny;
          final dpNorm2 = b.velocity.dx * nx + b.velocity.dy * ny;
          final m1 = (dpNorm2 - dpNorm1) * 0.8;

          if (!a.isDragged) {
            a.velocity += Offset(nx * m1, ny * m1);
          }
          if (!b.isDragged) {
            b.velocity -= Offset(nx * m1, ny * m1);
          }
        }
      }
    }

    // Trigger repaint via ValueNotifier (no setState!)
    _frameNotifier.value++;
  }

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(builder: (context, constraints) {
      if (_boxWidth != constraints.maxWidth) {
        _boxWidth = constraints.maxWidth;
        for (var item in _items) {
          if (item.position.dx > _boxWidth - item.radius * 2) {
            item.position = Offset(max(0, _boxWidth - item.radius * 2), item.position.dy);
          }
        }
      }

      return ClipRRect(
        borderRadius: BorderRadius.circular(24),
        child: SizedBox(
          width: double.infinity,
          height: widget.boxHeight,
          child: ValueListenableBuilder<int>(
            valueListenable: _frameNotifier,
            builder: (context, _, __) {
              return Stack(
                clipBehavior: Clip.none,
                children: _items.map((item) {
                  return Positioned(
                    left: item.position.dx,
                    top: item.position.dy,
                    child: GestureDetector(
                      onPanStart: (details) {
                        if (!_hasSeenHint) {
                          setState(() => _hasSeenHint = true);
                          TokenStorage.saveHasSeenFlickHint();
                        }
                        item.isDragged = true;
                        item.velocity = Offset.zero;
                        _lastDragPos = details.localPosition;
                        _dragStartPos = details.localPosition;
                        _wasDraggedFar = false;
                      },
                      onPanUpdate: (details) {
                        if (_dragStartPos != null) {
                          if ((details.localPosition - _dragStartPos!).distance > 8) {
                            _wasDraggedFar = true;
                          }
                        }
                        if (_lastDragPos != null) {
                          item.velocity = details.delta * 60.0;
                        }
                        _lastDragPos = details.localPosition;
                        
                        item.position += details.delta;
                        item.position = Offset(
                          item.position.dx.clamp(0.0, _boxWidth - item.radius * 2),
                          item.position.dy.clamp(0.0, widget.boxHeight - item.radius * 2),
                        );
                        // No setState needed — the ticker's ValueNotifier handles repaints
                      },
                      onPanEnd: (details) {
                        item.isDragged = false;
                        _lastDragPos = null;
                        
                        if (!_wasDraggedFar && widget.onItemTap != null) {
                          widget.onItemTap!(item.id);
                        } else {
                          item.velocity = details.velocity.pixelsPerSecond;
                        }
                        _dragStartPos = null;
                      },
                      onTap: () {
                        if (widget.onItemTap != null) {
                          widget.onItemTap!(item.id);
                        }
                      },
                      child: Stack(
                        clipBehavior: Clip.none,
                        children: [
                          item.child,
                          if (!_hasSeenHint && item.id == _hintIndex)
                            Positioned(
                              top: -8,
                              right: -20,
                              child: Transform.rotate(
                                angle: 0.2,
                                child: Container(
                                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                                  decoration: BoxDecoration(
                                    color: const Color(0xFF8B1C28),
                                    borderRadius: BorderRadius.circular(12),
                                    boxShadow: [
                                      BoxShadow(
                                        color: const Color(0xFF8B1C28).withValues(alpha: 0.3),
                                        blurRadius: 4,
                                        offset: const Offset(0, 2),
                                      )
                                    ],
                                  ),
                                  child: const Text(
                                    'Flick me!',
                                    style: TextStyle(
                                      color: Colors.white,
                                      fontSize: 10,
                                      fontWeight: FontWeight.bold,
                                    ),
                                  ),
                                ),
                              ),
                            ),
                        ],
                      ),
                    ),
                  );
                }).toList(),
              );
            },
          ),
        ),
      );
    });
  }
}
