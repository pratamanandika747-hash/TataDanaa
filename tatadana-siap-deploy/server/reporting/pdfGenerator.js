// server/reporting/pdfGenerator.js
// Standard PDF Document Generator for TataDana
// Generates valid, downloadable PDF financial statements formatted in WIB

const { formatWIBFull, formatRupiah } = require('../utils/wib');

/**
 * Builds a clean, valid PDF 1.4 binary buffer
 */
function generateFinancialReportPDF({
  userName = 'Pengguna TataDana',
  periodStart = '2026-10-01',
  periodEnd = '2026-10-31',
  summary = { income: 0, expense: 0, net: 0 },
  transactions = []
}) {
  const generatedAt = formatWIBFull(new Date());

  // Construct PDF stream text
  let streamText = `BT\n/F1 18 Tf\n50 780 Td\n(TataDana - Laporan Keuangan Pribadi) Tj\nET\n`;
  streamText += `BT\n/F1 10 Tf\n50 760 Td\n(Nama Pengguna: ${userName} | Dibuat: ${generatedAt}) Tj\nET\n`;
  streamText += `BT\n/F1 10 Tf\n50 745 Td\n(Periode: ${periodStart} s.d. ${periodEnd} | Zona Waktu: Asia/Jakarta WIB) Tj\nET\n`;

  // Draw separator line
  streamText += `0.8 0.8 0.8 RG\n1 w\n50 735 m 550 735 l S\n`;

  // Summary box
  streamText += `BT\n/F1 12 Tf\n50 710 Td\n(RINGKASAN CASHFLOW) Tj\nET\n`;
  streamText += `BT\n/F1 10 Tf\n50 690 Td\n(Total Pemasukan  : ${formatRupiah(summary.income)}) Tj\nET\n`;
  streamText += `BT\n/F1 10 Tf\n50 675 Td\n(Total Pengeluaran: ${formatRupiah(summary.expense)}) Tj\nET\n`;
  streamText += `BT\n/F1 10 Tf\n50 660 Td\n(Net Cashflow    : ${formatRupiah(summary.net)}) Tj\nET\n`;

  // Transactions table header
  streamText += `0.9 0.9 0.9 RG\n50 630 500 18 re f\n`;
  streamText += `BT\n/F1 9 Tf\n55 635 Td\n(TANGGAL | JENIS | KATEGORI | DOMPET | CATATAN | NOMINAL) Tj\nET\n`;

  // Draw up to 25 transaction rows
  let y = 615;
  const rows = transactions.slice(0, 25);
  for (const tx of rows) {
    const d = (tx.transaction_date || '').split('T')[0] || '-';
    const typeLabel = tx.type === 'pemasukan' ? '(+)' : '(-)';
    const cat = (tx.category_name || '-').slice(0, 15);
    const wal = (tx.wallet_name || '-').slice(0, 10);
    const note = (tx.notes || '-').slice(0, 20).replace(/[()]/g, '');
    const amountStr = formatRupiah(tx.amount);

    streamText += `BT\n/F1 8 Tf\n55 ${y} Td\n(${d} | ${typeLabel} | ${cat} | ${wal} | ${note} | ${amountStr}) Tj\nET\n`;
    y -= 16;
    if (y < 80) break;
  }

  // Footer
  streamText += `BT\n/F1 8 Tf\n50 40 Td\n(Dokumen ini digenerate resmi oleh TataDana - FinTech Indonesia. 100% Tersimpan di Supabase.) Tj\nET\n`;

  const streamLen = Buffer.byteLength(streamText, 'utf-8');

  // Build standard PDF structure
  const pdfContent = `%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>
endobj
4 0 obj
<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>
endobj
5 0 obj
<< /Length ${streamLen} >>
stream
${streamText}
endstream
endobj
xref
0 6
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
0000000227 00000 n 
0000000305 00000 n 
trailer
<< /Size 6 /Root 1 0 R >>
startxref
${400 + streamLen}
%%EOF`;

  return Buffer.from(pdfContent, 'utf-8');
}

module.exports = {
  generateFinancialReportPDF
};
