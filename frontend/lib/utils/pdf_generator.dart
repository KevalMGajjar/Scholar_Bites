import 'dart:typed_data';
import 'package:pdf/pdf.dart';
import 'package:pdf/widgets.dart' as pw;
import 'package:intl/intl.dart';

class PdfInvoiceGenerator {
  static Future<Uint8List> generate(Map<String, dynamic> invoice) async {
    final pdf = pw.Document();

    final university = (invoice['university'] ?? 'Ahmedabad University').toString().toUpperCase();
    final invoiceNo = invoice['invoice_number'] ?? '';
    final dateStr = invoice['created_at'] ?? '';
    final restaurant = invoice['restaurant']?['name'] ?? '';
    final status = (invoice['status'] ?? '').toString().toUpperCase();
    final customerName = invoice['customer']?['name'] ?? '';
    final customerPhone = invoice['customer']?['phone'] ?? '';
    final customerEmail = invoice['customer']?['email'] ?? '';
    
    final items = (invoice['items'] as List?) ?? [];
    final subtotal = invoice['subtotal'] ?? 0;
    final total = invoice['total'] ?? 0;
    final paymentMethod = invoice['payment_method'] ?? 'Online';
    final paymentId = (invoice['payment_id'] ?? '').toString().split('_').last;

    String formattedDate = '';
    try {
      final date = DateTime.parse(dateStr).toLocal();
      formattedDate = DateFormat('dd/MM/yyyy HH:mm').format(date);
    } catch (_) {
      formattedDate = dateStr;
    }

    pdf.addPage(
      pw.Page(
        pageFormat: PdfPageFormat.a4,
        margin: const pw.EdgeInsets.all(40),
        build: (pw.Context context) {
          return pw.Column(
            crossAxisAlignment: pw.CrossAxisAlignment.stretch,
            children: [
              // Header
              pw.Center(
                child: pw.Text(
                  university,
                  style: pw.TextStyle(
                    fontSize: 24,
                    fontWeight: pw.FontWeight.bold,
                    color: PdfColor.fromHex('#8B1C28'),
                  ),
                ),
              ),
              pw.SizedBox(height: 8),
              pw.Center(
                child: pw.Text(
                  'OFFICIAL RECEIPT',
                  style: pw.TextStyle(
                    fontSize: 14,
                    fontWeight: pw.FontWeight.bold,
                    color: PdfColors.grey700,
                    letterSpacing: 2,
                  ),
                ),
              ),
              pw.SizedBox(height: 24),
              pw.Divider(color: PdfColors.grey400),
              pw.SizedBox(height: 16),

              // Info Grid
              pw.Row(
                mainAxisAlignment: pw.MainAxisAlignment.spaceBetween,
                children: [
                  pw.Expanded(
                    child: pw.Column(
                      crossAxisAlignment: pw.CrossAxisAlignment.start,
                      children: [
                        _detailRow('Invoice No', invoiceNo),
                        pw.SizedBox(height: 8),
                        _detailRow('Date', formattedDate),
                      ],
                    ),
                  ),
                  pw.SizedBox(width: 16),
                  pw.Expanded(
                    child: pw.Column(
                      crossAxisAlignment: pw.CrossAxisAlignment.start,
                      children: [
                        _detailRow('Restaurant', restaurant),
                        pw.SizedBox(height: 8),
                        _detailRow('Status', status, isBold: true, color: PdfColor.fromHex('#8B1C28')),
                      ],
                    ),
                  ),
                ],
              ),
              
              pw.SizedBox(height: 16),
              pw.Divider(color: PdfColors.grey400),
              pw.SizedBox(height: 16),

              // Billed To
              pw.Text('Billed To', style: pw.TextStyle(fontWeight: pw.FontWeight.bold, fontSize: 12, color: PdfColors.grey700)),
              pw.SizedBox(height: 6),
              pw.Text(customerName, style: pw.TextStyle(fontWeight: pw.FontWeight.bold, fontSize: 14)),
              if (customerPhone.isNotEmpty) ...[
                pw.SizedBox(height: 2),
                pw.Text(customerPhone, style: const pw.TextStyle(fontSize: 12, color: PdfColors.grey800)),
              ],
              if (customerEmail.isNotEmpty) ...[
                pw.SizedBox(height: 2),
                pw.Text(customerEmail, style: const pw.TextStyle(fontSize: 12, color: PdfColors.grey800)),
              ],

              pw.SizedBox(height: 24),

              // Table Header
              pw.Container(
                padding: const pw.EdgeInsets.symmetric(vertical: 8, horizontal: 8),
                decoration: pw.BoxDecoration(
                  color: PdfColor.fromHex('#FCF9F5'),
                  borderRadius: const pw.BorderRadius.all(pw.Radius.circular(4)),
                ),
                child: pw.Row(
                  children: [
                    pw.Expanded(flex: 3, child: pw.Text('Item', style: pw.TextStyle(fontWeight: pw.FontWeight.bold))),
                    pw.Expanded(flex: 1, child: pw.Text('Qty', textAlign: pw.TextAlign.center, style: pw.TextStyle(fontWeight: pw.FontWeight.bold))),
                    pw.Expanded(flex: 1, child: pw.Text('Price', textAlign: pw.TextAlign.right, style: pw.TextStyle(fontWeight: pw.FontWeight.bold))),
                    pw.Expanded(flex: 1, child: pw.Text('Total', textAlign: pw.TextAlign.right, style: pw.TextStyle(fontWeight: pw.FontWeight.bold))),
                  ],
                ),
              ),
              pw.SizedBox(height: 8),

              // Table Body
              ...items.map((item) {
                return pw.Padding(
                  padding: const pw.EdgeInsets.symmetric(vertical: 6, horizontal: 8),
                  child: pw.Row(
                    children: [
                      pw.Expanded(flex: 3, child: pw.Text(item['name'] ?? '', style: const pw.TextStyle(fontSize: 12))),
                      pw.Expanded(flex: 1, child: pw.Text('${item['quantity']}', textAlign: pw.TextAlign.center, style: const pw.TextStyle(fontSize: 12))),
                      pw.Expanded(flex: 1, child: pw.Text('Rs.${item['unit_price']}', textAlign: pw.TextAlign.right, style: const pw.TextStyle(fontSize: 12))),
                      pw.Expanded(flex: 1, child: pw.Text('Rs.${item['total']}', textAlign: pw.TextAlign.right, style: pw.TextStyle(fontWeight: pw.FontWeight.bold, fontSize: 12))),
                    ],
                  ),
                );
              }),

              pw.SizedBox(height: 16),
              pw.Divider(color: PdfColors.grey400),
              pw.SizedBox(height: 16),

              // Totals
              _summaryRow('Subtotal', 'Rs.$subtotal'),
              pw.SizedBox(height: 8),
              _summaryRow('Platform Fee', 'Rs.0'),
              pw.SizedBox(height: 12),
              pw.Row(
                mainAxisAlignment: pw.MainAxisAlignment.spaceBetween,
                children: [
                  pw.Text('Grand Total', style: pw.TextStyle(fontSize: 18, fontWeight: pw.FontWeight.bold)),
                  pw.Text('Rs.$total', style: pw.TextStyle(fontSize: 20, fontWeight: pw.FontWeight.bold, color: PdfColor.fromHex('#8B1C28'))),
                ],
              ),

              pw.SizedBox(height: 32),
              pw.Divider(color: PdfColor.fromHex('#8B1C28'), thickness: 2),
              pw.SizedBox(height: 12),

              // Payment Info
              pw.Row(
                mainAxisAlignment: pw.MainAxisAlignment.spaceBetween,
                children: [
                  pw.Column(
                    crossAxisAlignment: pw.CrossAxisAlignment.start,
                    children: [
                      pw.Text('Payment Method', style: pw.TextStyle(fontWeight: pw.FontWeight.bold, fontSize: 10, color: PdfColors.grey700)),
                      pw.SizedBox(height: 4),
                      pw.Text(paymentMethod, style: pw.TextStyle(fontWeight: pw.FontWeight.bold, fontSize: 12)),
                    ],
                  ),
                  pw.Column(
                    crossAxisAlignment: pw.CrossAxisAlignment.end,
                    children: [
                      pw.Text('Payment ID', style: pw.TextStyle(fontWeight: pw.FontWeight.bold, fontSize: 10, color: PdfColors.grey700)),
                      pw.SizedBox(height: 4),
                      pw.Text(paymentId, style: pw.TextStyle(fontWeight: pw.FontWeight.bold, fontSize: 12)),
                    ],
                  ),
                ],
              ),
              
              pw.Spacer(),
              pw.Center(
                child: pw.Text(
                  'Thank you for using Ahmedabad University Canteen app!',
                  style: pw.TextStyle(fontSize: 10, color: PdfColors.grey600, fontStyle: pw.FontStyle.italic),
                ),
              ),
            ],
          );
        },
      ),
    );

    return pdf.save();
  }

  static pw.Widget _detailRow(String label, String value, {bool isBold = false, PdfColor? color}) {
    return pw.Column(
      crossAxisAlignment: pw.CrossAxisAlignment.start,
      children: [
        pw.Text(label, style: pw.TextStyle(fontWeight: pw.FontWeight.bold, fontSize: 10, color: PdfColors.grey700)),
        pw.SizedBox(height: 2),
        pw.Text(
          value,
          style: pw.TextStyle(
            fontWeight: isBold ? pw.FontWeight.bold : pw.FontWeight.normal,
            fontSize: 12,
            color: color ?? PdfColors.black,
          ),
        ),
      ],
    );
  }

  static pw.Widget _summaryRow(String label, String amount) {
    return pw.Row(
      mainAxisAlignment: pw.MainAxisAlignment.spaceBetween,
      children: [
        pw.Text(label, style: pw.TextStyle(color: PdfColors.grey800)),
        pw.Text(amount, style: pw.TextStyle(fontWeight: pw.FontWeight.bold)),
      ],
    );
  }
}
