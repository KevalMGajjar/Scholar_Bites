import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:printing/printing.dart';
import '../services/order_service.dart';
import '../widgets/spoon_loader.dart';
import '../utils/pdf_generator.dart';

class InvoiceScreen extends StatefulWidget {
  final String orderId;

  const InvoiceScreen({super.key, required this.orderId});

  @override
  State<InvoiceScreen> createState() => _InvoiceScreenState();
}

class _InvoiceScreenState extends State<InvoiceScreen> {
  static const _maroon = Color(0xFF8B1C28);
  static const _darkText = Color(0xFF4A0E13);
  static const _bg = Color(0xFFFCF9F5);

  bool _isLoading = true;
  bool _isGeneratingPdf = false;
  Map<String, dynamic>? _invoice;
  String? _error;

  @override
  void initState() {
    super.initState();
    _fetchInvoice();
  }

  Future<void> _fetchInvoice() async {
    try {
      final invoice = await OrderService().getInvoice(widget.orderId);
      if (mounted) {
        setState(() {
          _invoice = invoice;
          _isLoading = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _error = 'Failed to load invoice';
          _isLoading = false;
        });
      }
    }
  }

  String _formatDate(String isoDate) {
    try {
      final date = DateTime.parse(isoDate).toLocal();
      return '${date.day.toString().padLeft(2, '0')}/${date.month.toString().padLeft(2, '0')}/${date.year} ${date.hour.toString().padLeft(2, '0')}:${date.minute.toString().padLeft(2, '0')}';
    } catch (_) {
      return '';
    }
  }

  Future<void> _downloadInvoice() async {
    if (_invoice == null) return;
    setState(() => _isGeneratingPdf = true);
    try {
      final pdfBytes = await PdfInvoiceGenerator.generate(_invoice!);
      await Printing.sharePdf(bytes: pdfBytes, filename: '${_invoice!['invoice_number'] ?? 'invoice'}.pdf');
    } catch (e) {
      debugPrint('Error generating PDF: $e');
    } finally {
      if (mounted) {
        setState(() => _isGeneratingPdf = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: _bg,
      appBar: AppBar(
        title: const Text('Invoice',
            style: TextStyle(fontWeight: FontWeight.w800, color: _darkText)),
        backgroundColor: Colors.transparent,
        elevation: 0,
        foregroundColor: _darkText,
        actions: [
          if (_invoice != null)
            _isGeneratingPdf
                ? const Padding(
                    padding: EdgeInsets.only(right: 20.0),
                    child: Center(
                      child: SizedBox(
                        width: 20,
                        height: 20,
                        child: CircularProgressIndicator(
                          color: _maroon,
                          strokeWidth: 2.5,
                        ),
                      ),
                    ),
                  )
                : IconButton(
                    icon: const Icon(Icons.download_rounded, color: _maroon, size: 28),
                    tooltip: 'Download Invoice',
                    onPressed: _downloadInvoice,
                  ).animate().fadeIn().scale(),
          const SizedBox(width: 8),
        ],
      ),
      body: _isLoading
          ? const Center(child: SpoonLoader(size: 40))
          : _error != null
              ? Center(child: Text(_error!, style: const TextStyle(color: Colors.red)))
              : SingleChildScrollView(
                  padding: const EdgeInsets.all(24),
                  child: Container(
                    padding: const EdgeInsets.all(28),
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(16),
                      boxShadow: [
                        BoxShadow(
                          color: _maroon.withOpacity(0.08),
                          blurRadius: 40,
                          offset: const Offset(0, 10),
                        ),
                      ],
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        // University Header
                        Center(
                          child: Text(
                            (_invoice?['university'] ?? 'Ahmedabad University').toString().toUpperCase(),
                            style: const TextStyle(
                              color: _maroon,
                              fontSize: 16,
                              fontWeight: FontWeight.w900,
                              letterSpacing: 2,
                            ),
                            textAlign: TextAlign.center,
                          ),
                        ),
                        const SizedBox(height: 12),
                        const Center(
                          child: Text(
                            'OFFICIAL RECEIPT',
                            style: TextStyle(
                              fontSize: 12,
                              fontWeight: FontWeight.w700,
                              color: Colors.grey,
                              letterSpacing: 1.5,
                            ),
                          ),
                        ),
                        const SizedBox(height: 24),
                        const Divider(),
                        const SizedBox(height: 16),

                        // Details Row
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  _detailRow('Invoice No', _invoice?['invoice_number'] ?? ''),
                                  const SizedBox(height: 8),
                                  _detailRow('Date', _formatDate(_invoice?['created_at'] ?? '')),
                                ],
                              ),
                            ),
                            const SizedBox(width: 16),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  _detailRow('Restaurant', _invoice?['restaurant']?['name'] ?? ''),
                                  const SizedBox(height: 8),
                                  _detailRow('Status', (_invoice?['status'] ?? '').toString().toUpperCase(), isBold: true),
                                ],
                              ),
                            ),
                          ],
                        ),

                        const SizedBox(height: 16),
                        const Divider(),
                        const SizedBox(height: 16),

                        // Customer Info
                        const Text('Billed To', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 12, color: Colors.grey)),
                        const SizedBox(height: 6),
                        Text(_invoice?['customer']?['name'] ?? '', style: const TextStyle(fontWeight: FontWeight.w800, color: _darkText)),
                        const SizedBox(height: 2),
                        Text(_invoice?['customer']?['phone'] ?? '', style: TextStyle(color: _darkText.withOpacity(0.7))),
                        const SizedBox(height: 2),
                        Text(_invoice?['customer']?['email'] ?? '', style: TextStyle(color: _darkText.withOpacity(0.7))),

                        const SizedBox(height: 24),

                        // Items Table
                        Container(
                          padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 8),
                          decoration: BoxDecoration(color: _bg, borderRadius: BorderRadius.circular(8)),
                          child: const Row(
                            children: [
                              Expanded(flex: 3, child: Text('Item', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 13))),
                              Expanded(flex: 1, child: Text('Qty', textAlign: TextAlign.center, style: TextStyle(fontWeight: FontWeight.w800, fontSize: 13))),
                              Expanded(flex: 1, child: Text('Price', textAlign: TextAlign.right, style: TextStyle(fontWeight: FontWeight.w800, fontSize: 13))),
                              Expanded(flex: 1, child: Text('Total', textAlign: TextAlign.right, style: TextStyle(fontWeight: FontWeight.w800, fontSize: 13))),
                            ],
                          ),
                        ),
                        const SizedBox(height: 8),
                        
                        ...((_invoice?['items'] as List?) ?? []).map((item) {
                          final isVeg = item['is_veg'] ?? true;
                          return Padding(
                            padding: const EdgeInsets.symmetric(vertical: 8, horizontal: 8),
                            child: Row(
                              children: [
                                Expanded(
                                  flex: 3,
                                  child: Row(
                                    children: [
                                      Container(
                                        width: 12,
                                        height: 12,
                                        decoration: BoxDecoration(
                                          border: Border.all(color: isVeg ? Colors.green : Colors.red, width: 1.5),
                                        ),
                                        child: Center(
                                          child: Container(
                                            width: 6,
                                            height: 6,
                                            decoration: BoxDecoration(
                                              shape: BoxShape.circle,
                                              color: isVeg ? Colors.green : Colors.red,
                                            ),
                                          ),
                                        ),
                                      ),
                                      const SizedBox(width: 8),
                                      Expanded(
                                        child: Text(item['name'] ?? '', style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13)),
                                      ),
                                    ],
                                  ),
                                ),
                                Expanded(flex: 1, child: Text('${item['quantity']}', textAlign: TextAlign.center, style: const TextStyle(fontSize: 13))),
                                Expanded(flex: 1, child: Text('\u{20B9}${item['unit_price']}', textAlign: TextAlign.right, style: const TextStyle(fontSize: 13))),
                                Expanded(flex: 1, child: Text('\u{20B9}${item['total']}', textAlign: TextAlign.right, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13))),
                              ],
                            ),
                          );
                        }),

                        const SizedBox(height: 16),
                        const Divider(),
                        const SizedBox(height: 16),

                        // Totals
                        _summaryRow('Subtotal', _invoice?['subtotal']),
                        const SizedBox(height: 8),
                        _summaryRow('Platform Fee', 0), // Optional
                        const SizedBox(height: 12),
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            const Text('Grand Total', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w900, color: _darkText)),
                            Text('\u{20B9}${_invoice?['total'] ?? '0'}', style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w900, color: _maroon)),
                          ],
                        ),
                        
                        const SizedBox(height: 32),
                        const Divider(thickness: 2, color: _maroon),
                        const SizedBox(height: 12),
                        
                        // payment Info
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                const Text('Payment Method', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 12, color: Colors.grey)),
                                const SizedBox(height: 4),
                                Text(_invoice?['payment_method'] ?? 'Online', style: const TextStyle(fontWeight: FontWeight.w800, color: _darkText)),
                              ],
                            ),
                            Column(
                              crossAxisAlignment: CrossAxisAlignment.end,
                              children: [
                                const Text('Payment ID', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 12, color: Colors.grey)),
                                const SizedBox(height: 4),
                                Text((_invoice?['payment_id'] ?? '').toString().split('_').last, style: const TextStyle(fontWeight: FontWeight.w800, color: _darkText)),
                              ],
                            ),
                          ],
                        ),
                      ],
                    ),
                  ).animate().fadeIn(duration: 400.ms).slideY(begin: 0.1),
                ),
    );
  }

  Widget _detailRow(String label, String value, {bool isBold = false}) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 11, color: Colors.grey)),
        const SizedBox(height: 2),
        Text(
          value,
          style: TextStyle(
            fontWeight: isBold ? FontWeight.w900 : FontWeight.w600,
            fontSize: 13,
            color: isBold ? _maroon : _darkText,
          ),
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
        ),
      ],
    );
  }

  Widget _summaryRow(String label, dynamic amount) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text(label, style: TextStyle(fontWeight: FontWeight.w600, color: _darkText.withOpacity(0.6))),
        Text('\u{20B9}$amount', style: const TextStyle(fontWeight: FontWeight.w700, color: _darkText)),
      ],
    );
  }
}
