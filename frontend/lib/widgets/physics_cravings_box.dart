import 'dart:math';
import 'package:flutter/material.dart';
import 'package:flutter/scheduler.dart';

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

  @override
  void initState() {
    super.initState();
    _initItems();
    _ticker = createTicker(_tick)..start();
  }

  void _initItems() {
    final random = Random();
    _items = [];
    for (int i = 0; i < widget.items.length; i++) {
      // Random initial positions and slow velocities
      _items.add(PhysicsItem(
        id: i,
        child: widget.items[i],
        position: Offset(
          random.nextDouble() * 300, // Will be clamped in tick
          random.nextDouble() * widget.boxHeight,
        ),
        velocity: Offset(
          (random.nextDouble() - 0.5) * 150,
          (random.nextDouble() - 0.5) * 150,
        ),
        radius: widget.itemRadius,
      ));
    }
  }

  @override
  void dispose() {
    _ticker.dispose();
    super.dispose();
  }

  void _tick(Duration elapsed) {
    if (_boxWidth == 0) return; // Wait for layout
    final dt = 16.0 / 1000.0; // Assume 60fps for stable physics step

    setState(() {
      // 1. Update positions & handle wall collisions
      for (var item in _items) {
        if (item.isDragged) continue;

        // Apply slight drag/friction so they don't bounce forever at high speed
        item.velocity *= 0.99; 
        
        // Add minimal gravity? "float around" implies floating, so no gravity.
        // float them around gently if too slow
        if (item.velocity.distance < 10) {
           item.velocity += Offset((Random().nextDouble() - 0.5) * 10, (Random().nextDouble() - 0.5) * 10);
        }

        item.position += item.velocity * dt;

        // Wall collisions (Elastic bounce)
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

      // 2. Handle Circle vs Circle collisions
      for (int i = 0; i < _items.length; i++) {
        for (int j = i + 1; j < _items.length; j++) {
          final a = _items[i];
          final b = _items[j];

          final dx = (b.position.dx + b.radius) - (a.position.dx + a.radius);
          final dy = (b.position.dy + b.radius) - (a.position.dy + a.radius);
          final distance = sqrt(dx * dx + dy * dy);
          final minDist = a.radius + b.radius;

          if (distance < minDist && distance > 0) {
            // Collision resolution
            final overlap = minDist - distance;
            final nx = dx / distance;
            final ny = dy / distance;

            // Separate overlapping items
            if (!a.isDragged) {
              a.position -= Offset(nx * overlap / 2, ny * overlap / 2);
            }
            if (!b.isDragged) {
              b.position += Offset(nx * overlap / 2, ny * overlap / 2);
            }

            // Exchange velocities along the normal vector
            final dpNorm1 = a.velocity.dx * nx + a.velocity.dy * ny;
            final dpNorm2 = b.velocity.dx * nx + b.velocity.dy * ny;

            final m1 = (dpNorm2 - dpNorm1) * 0.8; // 0.8 is bounce factor
            
            if (!a.isDragged) {
              a.velocity += Offset(nx * m1, ny * m1);
            }
            if (!b.isDragged) {
              b.velocity -= Offset(nx * m1, ny * m1); // Opposite direction
            }
          }
        }
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(builder: (context, constraints) {
      if (_boxWidth != constraints.maxWidth) {
        _boxWidth = constraints.maxWidth;
        // Reclamp items if width shrinks
        for (var item in _items) {
          if (item.position.dx > _boxWidth - item.radius * 2) {
            item.position = Offset(max(0, _boxWidth - item.radius * 2), item.position.dy);
          }
        }
      }

      return ClipRRect(
        borderRadius: BorderRadius.circular(24),
        child: Container(
          width: double.infinity,
          height: widget.boxHeight,
          decoration: const BoxDecoration(
            color: Colors.transparent,
          ),
          child: Stack(
            clipBehavior: Clip.none,
            children: _items.map((item) {
              return Positioned(
                left: item.position.dx,
                top: item.position.dy,
                child: GestureDetector(
                  onPanStart: (details) {
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
                       // Velocity for when released
                       item.velocity = details.delta * 60.0; // Scale up delta to pixels/sec
                    }
                    _lastDragPos = details.localPosition;
                    
                    setState(() {
                      item.position += details.delta;
                      // Clamp during drag
                      item.position = Offset(
                        item.position.dx.clamp(0.0, _boxWidth - item.radius * 2),
                        item.position.dy.clamp(0.0, widget.boxHeight - item.radius * 2),
                      );
                    });
                  },
                  onPanEnd: (details) {
                    item.isDragged = false;
                    _lastDragPos = null;
                    
                    // Detect tap: if drag distance was very short, treat as a tap
                    if (!_wasDraggedFar && widget.onItemTap != null) {
                      widget.onItemTap!(item.id);
                    } else {
                      // Add flick velocity from gesture
                      item.velocity = details.velocity.pixelsPerSecond;
                    }
                    _dragStartPos = null;
                  },
                  child: item.child,
                ),
              );
            }).toList(),
          ),
        ),
      );
    });
  }
}
