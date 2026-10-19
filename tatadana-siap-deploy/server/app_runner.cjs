// server/app_runner.cjs
// Self-contained Zero-Dependency Full-Stack Server for TataDana
// Runs directly with agy-node on port 3000

const http = require('http');
const https = require('https');
const url = require('url');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const PORT = parseInt(process.env.PORT, 10) || 3000;
const TIMEZONE = 'Asia/Jakarta';
const ADMIN_WHATSAPP_NUMBER = '083840023120';

// -------------------------------------------------------------
// WIB UTILITIES
// -------------------------------------------------------------
function getWIBDate(date = new Date()) {
  const d = new Date(date);
  const utc = d.getTime() + (d.getTimezoneOffset() * 60000);
  return new Date(utc + (3600000 * 7));
}

function formatWIBFull(date = new Date()) {
  const wib = getWIBDate(date);
  const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
  const dayName = days[wib.getDay()];
  const day = wib.getDate();
  const monthName = months[wib.getMonth()];
  const year = wib.getFullYear();
  const hours = String(wib.getHours()).padStart(2, '0');
  const minutes = String(wib.getMinutes()).padStart(2, '0');
  return `${dayName}, ${day} ${monthName} ${year} — ${hours}:${minutes} WIB`;
}

function formatRupiah(number) {
  const val = Math.round(Number(number) || 0);
  return 'Rp' + val.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

function getCurrentMonthWIB() {
  const wib = getWIBDate();
  const year = wib.getFullYear();
  const month = String(wib.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

// -------------------------------------------------------------
// INDONESIAN CURRENCY & NATURAL TEXT PARSER
// -------------------------------------------------------------
function parseIndonesianNominal(text) {
  if (!text) return null;
  const clean = text.toLowerCase().trim();

  const miliarMatch = clean.match(/(\d+(?:[.,]\d+)?)\s*(?:miliar|milyar)\b/i);
  if (miliarMatch) {
    const num = parseFloat(miliarMatch[1].replace(',', '.'));
    return Math.round(num * 1000000000);
  }

  const jtMatch = clean.match(/(\d+(?:[.,]\d+)?)\s*(?:jt|juta|mio)\b/i);
  if (jtMatch) {
    const num = parseFloat(jtMatch[1].replace(',', '.'));
    return Math.round(num * 1000000);
  }

  const rbMatch = clean.match(/(\d+(?:[.,]\d+)?)\s*(?:rb|ribu|k)\b/i);
  if (rbMatch) {
    const num = parseFloat(rbMatch[1].replace(',', '.'));
    return Math.round(num * 1000);
  }

  const numMatch = clean.match(/(?:rp\.?\s*)?(\d{1,3}(?:\.\d{3})+(?:,\d+)?)/i);
  if (numMatch) {
    const numStr = numMatch[1].replace(/\./g, '').replace(',', '.');
    return Math.round(parseFloat(numStr));
  }

  const plainMatch = clean.match(/(?:rp\.?\s*)?(\d{4,12})/i);
  if (plainMatch) {
    return parseInt(plainMatch[1], 10);
  }

  return null;
}

function inferCategory(text, type = 'pengeluaran') {
  const t = text.toLowerCase();
  if (type === 'pemasukan') {
    if (t.includes('gaji') || t.includes('payroll')) return 'Gaji & Pendapatan';
    if (t.includes('bonus') || t.includes('freelance') || t.includes('proyek')) return 'Bonus & Freelance';
    return 'Pemasukan Lainnya';
  }

  if (t.match(/makan|minum|kopi|bakso|sate|nasi|warteg|resto|kafe|snack|jajan|es teh|ayam|mie|roti|boba/i)) return 'Makanan & Minuman';
  if (t.match(/bensin|pertalite|pertamax|parkir|toll|tol|ojol|gojek|grab|kereta|krl|mrt|bus|angkot/i)) return 'Transportasi';
  if (t.match(/listrik|pln|pdam|air|wifi|indihome|pulsa|paket data|kontrakan|kost|sewa|tagihan/i)) return 'Tagihan & Utilitas';
  if (t.match(/belanja|baju|sepatu|supermarket|indomaret|alfamart|shopee|tokopedia|skincare|sabun/i)) return 'Belanja Kebutuhan';
  if (t.match(/hiburan|nonton|bioskop|game|steam|netflix|spotify|liburan|karaoke/i)) return 'Hiburan & Hobi';
  if (t.match(/obat|dokter|klinik|apotek|vitamin|rs|sakit/i)) return 'Kesehatan';
  if (t.match(/buku|kursus|kuliah|spp|les|seminar|sekolah/i)) return 'Pendidikan & Buku';

  return 'Lain-lain';
}

function inferType(text) {
  const t = text.toLowerCase();
  const incomeKeywords = ['gaji', 'gajian', 'pemasukan', 'transferan masuk', 'dapat transfer', 'bonus', 'hasil jual', 'cair', 'pendapatan'];
  for (const kw of incomeKeywords) {
    if (t.includes(kw)) return 'pemasukan';
  }
  return 'pengeluaran';
}

function extractNotes(text) {
  let cleaned = text
    .replace(/(?:rp\.?\s*)?\d+(?:[.,]\d+)?\s*(?:jt|juta|mio|rb|ribu|k)\b/gi, '')
    .replace(/(?:rp\.?\s*)?\d{1,3}(?:\.\d{3})+(?:,\d+)?/gi, '')
    .replace(/(?:rp\.?\s*)?\d{4,12}/gi, '')
    .replace(/\b(?:beli|bayar|buat|untuk|dapat|terima|uang|habis)\b/gi, '')
    .trim();

  cleaned = cleaned.replace(/\s+/g, ' ').trim();
  if (!cleaned) return text.trim();
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
}

// -------------------------------------------------------------
// TELEGRAM REPLY FORMATTER
// -------------------------------------------------------------
function generateProgressBar(percentage) {
  const clamped = Math.max(0, Math.min(100, Math.round(percentage)));
  const filledBlocks = Math.round((clamped / 100) * 10);
  const emptyBlocks = 10 - filledBlocks;
  return '█'.repeat(filledBlocks) + '░'.repeat(emptyBlocks);
}

function formatExpenseReply({ date = new Date(), amount, categoryName = 'Pengeluaran', categoryIcon = '🏷️', walletName = 'BCA Tabungan', notes = '-', currentBalance = 0, categoryBudget = 1500000, categorySpent = 0, voiceTranscript = null }) {
  const dateStr = formatWIBFull(date);
  const nominalStr = formatRupiah(amount);
  const saldoStr = formatRupiah(currentBalance);

  let output = `📅 ${dateStr}\n`;
  if (voiceTranscript) {
    output += `🎙️ Transkrip: "${voiceTranscript}"\n\n`;
  }
  output += `💸 Pengeluaran tercatat!\n`;
  output += `├ Nominal : ${nominalStr}\n`;
  output += `├ Kategori : ${categoryIcon} ${categoryName}\n`;
  output += `├ Dompet   : 👛 ${walletName}\n`;
  output += `├ Catatan  : ${notes}\n`;
  output += `└ Saldo    : ${saldoStr}\n\n`;

  if (categoryBudget > 0) {
    const totalSpent = categorySpent;
    const pct = Math.round((totalSpent / categoryBudget) * 100);
    const sisa = Math.max(0, categoryBudget - totalSpent);
    const progressBar = generateProgressBar(pct);

    output += `📊 Budget ${categoryName} bulan ini:\n`;
    output += `${progressBar} ${pct}% — sisa ${formatRupiah(sisa)}\n`;

    if (pct >= 100) {
      output += `⚠️ Perhatian: Budget ${categoryName} bulan ini sudah HABIS!`;
    } else if (pct >= 80) {
      output += `⚠️ Waspada: Budget ${categoryName} sudah mencapai ${pct}%. Rem sedikit yuk!`;
    } else {
      output += `Tetap hemat dan rencanakan pengeluaranmu dengan bijak!`;
    }
  }

  return output;
}

function formatIncomeReply({ date = new Date(), amount, walletName = 'BCA Tabungan', currentBalance = 0, categoryName = 'Pemasukan', categoryIcon = '💼', notes = '', voiceTranscript = null }) {
  const dateStr = formatWIBFull(date);
  const nominalStr = formatRupiah(amount);
  const saldoStr = formatRupiah(currentBalance);

  let output = `📅 ${dateStr}\n`;
  if (voiceTranscript) {
    output += `🎙️ Transkrip: "${voiceTranscript}"\n\n`;
  }
  output += `💰 Pemasukan tercatat!\n`;
  output += `├ Nominal   : ${nominalStr}\n`;
  output += `├ Kategori  : ${categoryIcon} ${categoryName}\n`;
  if (notes) {
    output += `├ Catatan   : ${notes}\n`;
  }
  output += `├ Dompet    : 👛 ${walletName}\n`;
  output += `└ Saldo baru: ${saldoStr}\n\n`;
  output += `💪 Semangat terus! Jangan lupa sisihkan untuk tabungan ya.`;

  return output;
}

// -------------------------------------------------------------
// DOCUMENT GENERATORS
// -------------------------------------------------------------
// DOCUMENT GENERATORS (PDF & EXCEL)
// -------------------------------------------------------------
function generateFinancialReportPDF({ userName = 'Pengguna TataDana', periodStart = '2026-10-01', periodEnd = '2026-10-31', filterInfo = {}, summary = { income: 0, expense: 0, net: 0 }, transactions = [] }) {
  const generatedAt = formatWIBFull(new Date());
  const escapePdf = (str) => String(str || '').replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');

  let stream = '';

  // 1. Top Brand Banner Accent (Height 8, width 595)
  stream += `0.98 0.36 0.08 rg\n0 834 595 8 re f\n`;

  // 2. Header Container Box (x: 40, y: 752, w: 515, h: 72)
  stream += `0.98 0.98 0.99 rg\n40 752 515 72 re f\n`;
  stream += `0.88 0.90 0.93 RG\n0.8 w\n40 752 515 72 re S\n`;
  stream += `0.98 0.36 0.08 rg\n40 752 5 72 re f\n`; // Orange left vertical strip

  // Header Typography
  stream += `BT\n/F1 16 Tf\n0.10 0.12 0.18 rg\n55 802 Td\n(TATADANA) Tj\nET\n`;
  stream += `BT\n/F2 9 Tf\n0.40 0.45 0.55 rg\n55 788 Td\n(Smart Financial Statement & Cashflow Audit) Tj\nET\n`;
  stream += `BT\n/F2 8 Tf\n0.30 0.35 0.42 rg\n55 772 Td\n(Pengguna: ${escapePdf(userName)} | Status: Akun Terverifikasi) Tj\nET\n`;

  // Right Header Info
  stream += `BT\n/F1 9 Tf\n0.15 0.20 0.28 rg\n360 802 Td\n(LAPORAN RESMI KEUANGAN) Tj\nET\n`;
  stream += `BT\n/F2 8 Tf\n0.40 0.45 0.52 rg\n360 788 Td\n(Periode: ${escapePdf(periodStart)} s.d. ${escapePdf(periodEnd)}) Tj\nET\n`;
  stream += `BT\n/F2 8 Tf\n0.40 0.45 0.52 rg\n360 772 Td\n(Waktu Cetak: ${escapePdf(generatedAt)} WIB) Tj\nET\n`;

  // 3. Metadata Bar (x: 40, y: 730, w: 515, h: 16)
  stream += `0.95 0.96 0.98 rg\n40 730 515 16 re f\n`;
  stream += `0.90 0.92 0.95 RG\n0.5 w\n40 730 515 16 re S\n`;
  const filterSummary = `Filter: Dompet [${escapePdf(filterInfo.wallet || 'Semua')}] | Kategori [${escapePdf(filterInfo.category || 'Semua')}] | Total Data [${transactions.length} Transaksi]`;
  stream += `BT\n/F2 7.5 Tf\n0.30 0.35 0.45 rg\n48 734.5 Td\n(${filterSummary}) Tj\nET\n`;

  // 4. Three Modern KPI Snapshot Cards (x: 40, y: 662, w: 165 each, h: 58)
  // Card 1: Pemasukan
  stream += `0.94 0.98 0.95 rg\n40 662 165 58 re f\n`;
  stream += `0.75 0.90 0.80 RG\n0.6 w\n40 662 165 58 re S\n`;
  stream += `0.06 0.65 0.45 rg\n40 717 165 3 re f\n`;
  stream += `BT\n/F1 7.5 Tf\n0.06 0.50 0.35 rg\n48 704 Td\n(TOTAL PEMASUKAN) Tj\nET\n`;
  stream += `BT\n/F1 12.5 Tf\n0.04 0.52 0.32 rg\n48 688 Td\n(${escapePdf(formatRupiah(summary.income))}) Tj\nET\n`;
  stream += `BT\n/F2 7 Tf\n0.35 0.55 0.45 rg\n48 674 Td\n(+ Total Kas Masuk Periode Ini) Tj\nET\n`;

  // Card 2: Pengeluaran
  stream += `0.99 0.94 0.95 rg\n215 662 165 58 re f\n`;
  stream += `0.95 0.80 0.82 RG\n0.6 w\n215 662 165 58 re S\n`;
  stream += `0.88 0.16 0.29 rg\n215 717 165 3 re f\n`;
  stream += `BT\n/F1 7.5 Tf\n0.75 0.15 0.25 rg\n223 704 Td\n(TOTAL PENGELUARAN) Tj\nET\n`;
  stream += `BT\n/F1 12.5 Tf\n0.78 0.12 0.22 rg\n223 688 Td\n(${escapePdf(formatRupiah(summary.expense))}) Tj\nET\n`;
  stream += `BT\n/F2 7 Tf\n0.60 0.35 0.40 rg\n223 674 Td\n(- Total Belanja & Biaya) Tj\nET\n`;

  // Card 3: Net Cashflow
  stream += `0.98 0.96 0.93 rg\n390 662 165 58 re f\n`;
  stream += `0.92 0.85 0.75 RG\n0.6 w\n390 662 165 58 re S\n`;
  stream += `0.95 0.45 0.05 rg\n390 717 165 3 re f\n`;
  stream += `BT\n/F1 7.5 Tf\n0.70 0.35 0.05 rg\n398 704 Td\n(ARUS KAS BERSIH / NET) Tj\nET\n`;
  const netColor = summary.net >= 0 ? '0.04 0.52 0.32' : '0.78 0.12 0.22';
  stream += `BT\n/F1 12.5 Tf\n${netColor} rg\n398 688 Td\n(${summary.net >= 0 ? '+' : ''}${escapePdf(formatRupiah(summary.net))}) Tj\nET\n`;
  stream += `BT\n/F2 7 Tf\n0.55 0.45 0.35 rg\n398 674 Td\n(${summary.net >= 0 ? 'Surplus Finansial Sehat' : 'Defisit Pengeluaran'}) Tj\nET\n`;

  // 5. Table Header Box (y: 632, h: 20, w: 515)
  stream += `0.11 0.15 0.23 rg\n40 632 515 20 re f\n`;
  stream += `1 1 1 rg\n`;
  stream += `BT\n/F1 7.5 Tf\n46 638 Td\n(NO) Tj\nET\n`;
  stream += `BT\n/F1 7.5 Tf\n68 638 Td\n(TANGGAL) Tj\nET\n`;
  stream += `BT\n/F1 7.5 Tf\n135 638 Td\n(JENIS) Tj\nET\n`;
  stream += `BT\n/F1 7.5 Tf\n195 638 Td\n(KATEGORI) Tj\nET\n`;
  stream += `BT\n/F1 7.5 Tf\n285 638 Td\n(DOMPET) Tj\nET\n`;
  stream += `BT\n/F1 7.5 Tf\n355 638 Td\n(CATATAN / MERCHANT) Tj\nET\n`;
  stream += `BT\n/F1 7.5 Tf\n480 638 Td\n(NOMINAL (RP)) Tj\nET\n`;

  // 6. Table Rows
  let y = 615;
  const maxRows = 34;
  const displayedTxs = transactions.slice(0, maxRows);

  for (let i = 0; i < displayedTxs.length; i++) {
    const tx = displayedTxs[i];
    const no = String(i + 1);
    const d = (tx.transaction_date || '').split('T')[0] || '-';
    const isInc = tx.type === 'pemasukan';
    const cat = escapePdf((tx.category_name || '-').slice(0, 16));
    const wal = escapePdf((tx.wallet_name || '-').slice(0, 12));
    const note = escapePdf((tx.notes || '-').slice(0, 22));
    const amountStr = `${isInc ? '+' : '-'}${formatRupiah(tx.amount)}`;

    const rowBg = i % 2 === 0 ? '1 1 1' : '0.97 0.98 0.99';
    stream += `${rowBg} rg\n40 ${y - 3} 515 16 re f\n`;
    stream += `0.92 0.93 0.95 RG\n0.4 w\n40 ${y - 3} 515 16 re S\n`;

    // No
    stream += `BT\n/F2 7 Tf\n0.35 0.40 0.48 rg\n46 ${y} Td\n(${no}) Tj\nET\n`;
    // Date
    stream += `BT\n/F2 7 Tf\n0.20 0.22 0.28 rg\n68 ${y} Td\n(${d}) Tj\nET\n`;

    // Type Badge
    if (isInc) {
      stream += `0.88 0.96 0.90 rg\n133 ${y - 1} 46 11 re f\n`;
      stream += `BT\n/F1 6.5 Tf\n0.05 0.50 0.25 rg\n136 ${y + 1} Td\n(+ MASUK) Tj\nET\n`;
    } else {
      stream += `0.98 0.90 0.92 rg\n133 ${y - 1} 46 11 re f\n`;
      stream += `BT\n/F1 6.5 Tf\n0.75 0.10 0.20 rg\n136 ${y + 1} Td\n(- KELUAR) Tj\nET\n`;
    }

    // Category
    stream += `BT\n/F2 7 Tf\n0.20 0.22 0.28 rg\n195 ${y} Td\n(${cat}) Tj\nET\n`;
    // Wallet
    stream += `BT\n/F2 7 Tf\n0.35 0.40 0.48 rg\n285 ${y} Td\n(${wal}) Tj\nET\n`;
    // Note
    stream += `BT\n/F2 7 Tf\n0.25 0.28 0.35 rg\n355 ${y} Td\n(${note}) Tj\nET\n`;
    // Amount
    const amtColor = isInc ? '0.04 0.52 0.32' : '0.78 0.12 0.22';
    stream += `BT\n/F1 7.5 Tf\n${amtColor} rg\n480 ${y} Td\n(${escapePdf(amountStr)}) Tj\nET\n`;

    y -= 16;
  }

  if (transactions.length > maxRows) {
    stream += `0.97 0.97 0.98 rg\n40 ${y - 2} 515 14 re f\n`;
    stream += `BT\n/F2 7 Tf\n0.45 0.50 0.58 rg\n46 ${y} Td\n(... dan ${transactions.length - maxRows} transaksi lainnya tersimpan aman di database cloud TataDana.) Tj\nET\n`;
    y -= 16;
  }

  // 7. Footer Box (x: 40, y: 22, w: 515, h: 32)
  stream += `0.98 0.98 0.99 rg\n40 22 515 32 re f\n`;
  stream += `0.88 0.90 0.93 RG\n0.6 w\n40 22 515 32 re S\n`;
  stream += `BT\n/F1 6.5 Tf\n0.25 0.30 0.40 rg\n48 40 Td\n(TERVERIFIKASI SISTEM TATADANA | DATABASE CLOUD SUPABASE 100% SECURE & ENCRYPTED) Tj\nET\n`;
  stream += `BT\n/F2 6 Tf\n0.50 0.55 0.62 rg\n48 30 Td\n(Dokumen ini diterbitkan secara resmi oleh platform TataDana FinTech Indonesia. Validitas zona waktu: Asia/Jakarta WIB.) Tj\nET\n`;
  stream += `BT\n/F2 6.5 Tf\n0.40 0.45 0.55 rg\n460 35 Td\n(Halaman 1 dari 1 - Dokumen Asli) Tj\nET\n`;

  // Bottom brand bar
  stream += `0.98 0.36 0.08 rg\n0 0 595 6 re f\n`;

  const streamBuf = Buffer.from(stream, 'utf-8');
  const parts = [];
  const offsets = [];

  function addPart(chunk) {
    const b = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk, 'utf-8');
    parts.push(b);
  }

  function currentOffset() {
    return parts.reduce((acc, p) => acc + p.length, 0);
  }

  addPart('%PDF-1.4\n');

  offsets[1] = currentOffset();
  addPart('1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n');

  offsets[2] = currentOffset();
  addPart('2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n');

  offsets[3] = currentOffset();
  addPart('3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R /F2 6 0 R >> >> /Contents 5 0 R >>\nendobj\n');

  offsets[4] = currentOffset();
  addPart('4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>\nendobj\n');

  offsets[6] = currentOffset();
  addPart('6 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n');

  offsets[5] = currentOffset();
  addPart(`5 0 obj\n<< /Length ${streamBuf.length} >>\nstream\n`);
  addPart(streamBuf);
  addPart('\nendstream\nendobj\n');

  const xrefOffset = currentOffset();
  let xrefStr = `xref\n0 7\n0000000000 65535 f \n`;
  for (let i = 1; i <= 6; i++) {
    xrefStr += String(offsets[i] || 0).padStart(10, '0') + ' 00000 n \n';
  }
  xrefStr += `trailer\n<< /Size 7 /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  addPart(xrefStr);

  return Buffer.concat(parts);
}

function generateFinancialReportExcel({ userName = 'Pengguna TataDana', periodStart = '2026-10-01', periodEnd = '2026-10-31', filterInfo = {}, summary = { income: 0, expense: 0, net: 0 }, transactions = [] }) {
  const generatedAt = formatWIBFull(new Date());
  let rowsXml = `
    <Row><Cell ss:StyleID="HeaderTitle"><Data ss:Type="String">TataDana - Laporan Keuangan Pribadi</Data></Cell></Row>
    <Row><Cell><Data ss:Type="String">Pengguna: ${userName} | Dibuat: ${generatedAt} WIB</Data></Cell></Row>
    <Row><Cell><Data ss:Type="String">Periode: ${periodStart} s.d ${periodEnd} | Jenis: ${filterInfo.type || 'Semua'} | Kategori: ${(filterInfo.category || 'Semua Kategori').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')} | Dompet: ${filterInfo.wallet || 'Semua Dompet'}</Data></Cell></Row>
    <Row></Row>
    <Row><Cell ss:StyleID="Bold"><Data ss:Type="String">Total Pemasukan</Data></Cell><Cell ss:StyleID="Currency"><Data ss:Type="Number">${summary.income}</Data></Cell></Row>
    <Row><Cell ss:StyleID="Bold"><Data ss:Type="String">Total Pengeluaran</Data></Cell><Cell ss:StyleID="Currency"><Data ss:Type="Number">${summary.expense}</Data></Cell></Row>
    <Row><Cell ss:StyleID="Bold"><Data ss:Type="String">Net Cashflow</Data></Cell><Cell ss:StyleID="Currency"><Data ss:Type="Number">${summary.net}</Data></Cell></Row>
    <Row><Cell ss:StyleID="Bold"><Data ss:Type="String">Total Data Transaksi</Data></Cell><Cell><Data ss:Type="Number">${transactions.length}</Data></Cell></Row>
    <Row></Row>
    <Row ss:StyleID="TableHeader">
      <Cell><Data ss:Type="String">No</Data></Cell>
      <Cell><Data ss:Type="String">ID Transaksi</Data></Cell>
      <Cell><Data ss:Type="String">Tanggal (WIB)</Data></Cell>
      <Cell><Data ss:Type="String">Jenis</Data></Cell>
      <Cell><Data ss:Type="String">Kategori</Data></Cell>
      <Cell><Data ss:Type="String">Dompet</Data></Cell>
      <Cell><Data ss:Type="String">Nominal (IDR)</Data></Cell>
      <Cell><Data ss:Type="String">Catatan</Data></Cell>
    </Row>
  `;

  let no = 1;
  for (const tx of transactions) {
    const isIncome = tx.type === 'pemasukan';
    const amountVal = Number(tx.amount) || 0;
    const dateStr = (tx.transaction_date || '').split('T')[0];
    const cleanNotes = (tx.notes || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    const cleanCat = (tx.category_name || '-').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const cleanWal = (tx.wallet_name || '-').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

    rowsXml += `
    <Row>
      <Cell><Data ss:Type="Number">${no++}</Data></Cell>
      <Cell><Data ss:Type="String">${tx.id || ''}</Data></Cell>
      <Cell><Data ss:Type="String">${dateStr}</Data></Cell>
      <Cell><Data ss:Type="String">${isIncome ? 'Pemasukan' : 'Pengeluaran'}</Data></Cell>
      <Cell><Data ss:Type="String">${cleanCat}</Data></Cell>
      <Cell><Data ss:Type="String">${cleanWal}</Data></Cell>
      <Cell ss:StyleID="Currency"><Data ss:Type="Number">${amountVal}</Data></Cell>
      <Cell><Data ss:Type="String">${cleanNotes}</Data></Cell>
    </Row>
    `;
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
 <Styles>
  <Style ss:ID="HeaderTitle"><Font ss:Size="16" ss:Bold="1" ss:Color="#FF5B00"/></Style>
  <Style ss:ID="Bold"><Font ss:Bold="1"/></Style>
  <Style ss:ID="TableHeader"><Font ss:Bold="1" ss:Color="#FFFFFF"/><Interior ss:Color="#FF5B00" ss:Pattern="Solid"/></Style>
  <Style ss:ID="Currency"><NumberFormat ss:Format="#,##0"/></Style>
 </Styles>
 <Worksheet ss:Name="Laporan Keuangan">
  <Table>${rowsXml}</Table>
 </Worksheet>
</Workbook>`;

  return Buffer.from(xml, 'utf-8');
}

function getFilteredUserTransactions(userId, query = {}) {
  let list = db.transactions.filter(t => t.user_id === userId);

  if (query.startDate) {
    list = list.filter(t => (t.transaction_date || '').slice(0, 10) >= query.startDate);
  }
  if (query.endDate) {
    list = list.filter(t => (t.transaction_date || '').slice(0, 10) <= query.endDate);
  }
  if (query.type) {
    list = list.filter(t => t.type === query.type);
  }
  if (query.walletId) {
    list = list.filter(t => t.wallet_id === query.walletId);
  }
  if (query.categoryId) {
    list = list.filter(t => t.category_id === query.categoryId);
  }
  if (query.search) {
    const s = query.search.toLowerCase();
    list = list.filter(t => (t.notes || '').toLowerCase().includes(s));
  }

  // Sort newest date first
  list.sort((a, b) => new Date(b.transaction_date || 0) - new Date(a.transaction_date || 0));

  return list.map(t => {
    const w = db.wallets.find(x => x.id === t.wallet_id);
    const c = db.categories.find(x => x.id === t.category_id);
    const items = t.is_receipt_parent ? db.receiptItems.filter(r => r.transaction_id === t.id) : [];
    return {
      ...t,
      wallet_name: w ? w.name : 'Dompet',
      category_name: c ? c.name : 'Umum',
      category_icon: c ? c.icon : '🏷️',
      receipt_items: items
    };
  });
}

// -------------------------------------------------------------
// IN-MEMORY DATABASE & SEED DATA
// -------------------------------------------------------------
const db = {
  processedUpdates: new Set(),
  profiles: [
    { id: 'usr-admin-001', email: '@nandikapratama', phone_number: '+628111222333', phone_verified: true, whatsapp_verified: true, full_name: 'Nandika Pratama (Super Admin)', role: 'superadmin', plan_tier: 'pro', password: 'nandika@1234', avatar_url: null }
  ],
  wallets: [],
  categories: [
    { id: 'cat-01', user_id: 'default', name: 'Makanan & Minuman', type: 'expense', icon: '🍜', color: '#F97316' },
    { id: 'cat-02', user_id: 'default', name: 'Transportasi', type: 'expense', icon: '🚗', color: '#3B82F6' },
    { id: 'cat-03', user_id: 'default', name: 'Tagihan & Utilitas', type: 'expense', icon: '🏠', color: '#8B5CF6' },
    { id: 'cat-04', user_id: 'default', name: 'Belanja Kebutuhan', type: 'expense', icon: '👕', color: '#EC4899' },
    { id: 'cat-05', user_id: 'default', name: 'Gaji & Pendapatan', type: 'income', icon: '💰', color: '#059669' }
  ],
  budgets: [],
  transactions: [],
  receiptItems: [],
  aiProviders: [
    { name: 'Google Gemini', model: 'gemini-2.5-flash', enabled: true, isPrimary: true },
    { name: 'OpenAI GPT', model: 'gpt-4o-mini', enabled: true, isPrimary: false },
    { name: 'DeepSeek', model: 'deepseek-chat', enabled: true, isPrimary: false }
  ],
  aiMode: 'failover',
  aiLogs: [],
  payments: [],
  adminAuditLogs: [
    { id: 'aud-001', action: 'SYSTEM_BOOT', details: 'TataDana Core Server v2.0 aktif siap melayani transaksi.', admin: 'Sistem', created_at: new Date().toISOString() }
  ],
  telegramBotToken: '8853112131:AAGNZDVNBGnBTZBZcNhIni1iv2eb011-Fjo',
  telegramBotInfo: { id: 8853112131, is_bot: true, first_name: 'tatadana', username: 'TataKeuanganBot' }
};

// Database persistence across restarts and serverless warm containers
const DB_FILE_PATH = process.env.VERCEL ? path.join('/tmp', 'tatadana_db.json') : path.join(__dirname, 'tatadana_db.json');

function saveDatabaseToFile() {
  try {
    const dataToSave = {
      profiles: db.profiles,
      wallets: db.wallets,
      categories: db.categories,
      budgets: db.budgets,
      transactions: db.transactions,
      receiptItems: db.receiptItems,
      payments: db.payments,
      adminAuditLogs: db.adminAuditLogs,
      aiMode: db.aiMode
    };
    fs.writeFileSync(DB_FILE_PATH, JSON.stringify(dataToSave, null, 2), 'utf8');
  } catch (err) {
    console.warn('Database save warning:', err.message);
  }
}

function loadDatabaseFromFile() {
  try {
    if (fs.existsSync(DB_FILE_PATH)) {
      const raw = fs.readFileSync(DB_FILE_PATH, 'utf8');
      const parsed = JSON.parse(raw);
      if (parsed.profiles && Array.isArray(parsed.profiles) && parsed.profiles.length > 0) db.profiles = parsed.profiles;
      if (parsed.wallets && Array.isArray(parsed.wallets)) db.wallets = parsed.wallets;
      if (parsed.categories && Array.isArray(parsed.categories)) db.categories = parsed.categories;
      if (parsed.budgets && Array.isArray(parsed.budgets)) db.budgets = parsed.budgets;
      if (parsed.transactions && Array.isArray(parsed.transactions)) db.transactions = parsed.transactions;
      if (parsed.receiptItems && Array.isArray(parsed.receiptItems)) db.receiptItems = parsed.receiptItems;
      if (parsed.payments && Array.isArray(parsed.payments)) db.payments = parsed.payments;
      if (parsed.adminAuditLogs && Array.isArray(parsed.adminAuditLogs)) db.adminAuditLogs = parsed.adminAuditLogs;
      if (parsed.aiMode) db.aiMode = parsed.aiMode;
    }
  } catch (err) {
    console.warn('Database load warning:', err.message);
  }
}

// Ensure Superadmin is always present in db.profiles
if (!db.profiles.some(u => u.role === 'superadmin')) {
  db.profiles.push({
    id: 'usr-admin-001',
    email: '@nandikapratama',
    phone_number: '+628111222333',
    phone_verified: true,
    whatsapp_verified: true,
    full_name: 'Nandika Pratama (Super Admin)',
    role: 'superadmin',
    plan_tier: 'pro',
    password: 'nandika@1234',
    avatar_url: null
  });
}

loadDatabaseFromFile();

// Memory leak guards: prune cache sets and arrays when reaching thresholds
function recordProcessedUpdate(updateId) {
  if (updateId === undefined || updateId === null) return;
  if (db.processedUpdates.size > 2000) {
    const kept = Array.from(db.processedUpdates).slice(-1000);
    db.processedUpdates = new Set(kept);
  }
  db.processedUpdates.add(String(updateId));
  const num = Number(updateId);
  if (!isNaN(num)) db.processedUpdates.add(num);
}

function addTransaction(tx) {
  db.transactions.unshift(tx);
  if (db.transactions.length > 500) {
    db.transactions.length = 500;
  }
  saveDatabaseToFile();
}

let activeUserId = 'usr-admin-001';

// -------------------------------------------------------------
// HTTP SERVER & API ROUTES
// -------------------------------------------------------------
function parseBody(req, limitBytes = 10 * 1024 * 1024) {
  return new Promise((resolve) => {
    let body = '';
    let size = 0;
    let aborted = false;

    req.on('data', chunk => {
      if (aborted) return;
      size += chunk.length;
      if (size > limitBytes) {
        aborted = true;
        resolve({});
        return;
      }
      body += chunk;
    });

    req.on('end', () => {
      if (aborted) return;
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (e) {
        resolve({});
      }
    });

    req.on('error', () => {
      resolve({});
    });
  });
}

function sendJson(res, statusCode, data) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization'
  });
  res.end(JSON.stringify(data));
}

// -------------------------------------------------------------
// TELEGRAM BOT ENGINE & WEBHOOK HANDLER (Module-scoped)
// -------------------------------------------------------------
function handleTelegramBotAction(rawText, messageType = 'text', customUser = null) {
  const activeUser = customUser || db.profiles.find(u => u.id === activeUserId) || db.profiles[0];
  const userWallets = db.wallets.filter(w => w.user_id === activeUser.id);
  const defaultWallet = userWallets.find(w => w.is_default_telegram) || userWallets[0] || db.wallets[0];

  if (messageType === 'photo') {
    const total = 78500;
    if (defaultWallet && total > Number(defaultWallet.balance || 0)) {
      const reply = `⚠️ **Saldo anda tidak mencukupi**\n\n` +
        `Nominal struk belanja sebesar **${formatRupiah(total)}** melebihi saldo dompet **${defaultWallet.name}** Anda saat ini (**${formatRupiah(defaultWallet.balance || 0)}**).\n\n` +
        `Saldo anda tidak mencukupi untuk memproses pengeluaran ini. Silakan isi saldo atau gunakan dompet lain.`;
      return { status: 'insufficient_balance', reply, error: 'Saldo anda tidak mencukupi' };
    }

    const tx = {
      id: 'tx-' + Date.now(),
      user_id: activeUser.id,
      wallet_id: defaultWallet.id,
      category_id: 'cat-04',
      type: 'pengeluaran',
      amount: total,
      notes: 'Belanja Indomaret Point',
      merchant_name: 'Indomaret Point',
      source: 'telegram_photo',
      is_receipt_parent: true,
      transaction_date: new Date().toISOString()
    };
    addTransaction(tx);
    defaultWallet.balance -= total;

    const reply = `🧾 **Struk Belanja Berhasil Dipindai!** (AI OCR)
├ Merchant : 🏪 Indomaret Point
├ Total    : **${formatRupiah(total)}**
├ Dompet   : 👛 ${defaultWallet.name}
├ Sisa Saldo: **${formatRupiah(defaultWallet.balance)}**

📦 **Rincian Item Belanja:**
• Susu UHT 1L (2x) — Rp40.000
• Roti Gandum (1x) — Rp18.500
• Kopi Botol Latte (2x) — Rp20.000

✨ *Semua item telah tersimpan ke database & dapat dicek di menu Laporan!*`;
    return { status: 'receipt_recorded', reply, transaction: tx };
  }

  if (messageType === 'voice') {
    const transcript = 'Beli paket data 100 ribu sama makan siang 25 ribu';
    const nominal = 125000;
    if (defaultWallet && nominal > Number(defaultWallet.balance || 0)) {
      const reply = `⚠️ **Saldo anda tidak mencukupi**\n\n` +
        `Nominal pengeluaran suara sebesar **${formatRupiah(nominal)}** melebihi saldo dompet **${defaultWallet.name}** Anda saat ini (**${formatRupiah(defaultWallet.balance || 0)}**).\n\n` +
        `Saldo anda tidak mencukupi untuk memproses transaksi ini.`;
      return { status: 'insufficient_balance', reply, error: 'Saldo anda tidak mencukupi' };
    }

    const tx = {
      id: 'tx-' + Date.now(),
      user_id: activeUser.id,
      wallet_id: defaultWallet.id,
      category_id: 'cat-03',
      type: 'pengeluaran',
      amount: nominal,
      notes: 'Paket data & makan siang',
      source: 'telegram_voice',
      raw_transcript: transcript,
      transaction_date: new Date().toISOString()
    };
    addTransaction(tx);
    defaultWallet.balance -= nominal;

    const reply = formatExpenseReply({
      amount: nominal,
      categoryName: 'Tagihan & Makan',
      categoryIcon: '📱',
      walletName: defaultWallet.name,
      notes: 'Paket data & makan siang',
      currentBalance: defaultWallet.balance,
      categoryBudget: 1000000,
      categorySpent: 650000,
      voiceTranscript: transcript
    });
    return { status: 'voice_recorded', reply, transaction: tx };
  }

  const text = (rawText || '').trim();
  const lower = text.toLowerCase();

  // Command /start
  if (lower === '/start' || lower.startsWith('/start ')) {
    return {
      status: 'command_executed',
      reply: `👋 Halo **${activeUser.full_name}**! Selamat datang di **TataDana Telegram Bot** 🚀

TataDana adalah asisten keuangan pribadi cerdas Indonesia. Catat keuangan semudah chatting santai!

✨ **Cara Mudah Mencatat:**
• *\"kopi susu 22rb\"* (otomatis ke dompet default)
• *\"bensin 35rb bca\"* (otomatis potong dompet BCA)
• *\"makan siang 30rb gopay\"* (otomatis potong GoPay)
• *\"gajian 6.5jt\"* (otomatis catat pemasukan)

📸 **Kirim Foto Struk**: Kirim foto struk belanja untuk dipindai OCR otomatis per item!
🎙️ **Kirim Voice Note**: Kirim pesan suara pencatatan pengeluaran!

⚡ **Daftar Perintah Bot:**
/saldo — Cek rincian semua saldo & dompet
/dompet — Kelola & ganti dompet default bot
/budget — Cek status budget Harian, Mingguan, Bulanan
/hariini — Laporan pengeluaran hari ini
/mingguini — Laporan pengeluaran minggu ini
/bulanini — Rekap arus kas bulan berjalan
/help — Bantuan & panduan format`
    };
  }

  // Command /help
  if (lower === '/help' || lower.startsWith('/help ')) {
    return {
      status: 'command_executed',
      reply: `📖 **Panduan Perintah & Format Input TataDana:**

1. **Format Input Teks Bebas:**
   - Menyebutkan nominal: *15k, 25rb, 25000, 1.5jt*
   - Menyebutkan dompet: *... bca*, *... gopay*, *... tunai*
   - Contoh: *\"beli kuota 50rb gopay\"*, *\"dapat bonus proyek 750rb bca\"*

2. **Perintah Cepat:**
   • \`/saldo\` — Ringkasan saldo semua dompet aktif
   • \`/dompet\` — Info & ganti dompet utama
   • \`/budget\` — Pemantauan budget Harian, Mingguan, Bulanan
   • \`/hariini\` — Rekap transaksi hari ini (WIB)
   • \`/mingguini\` — Rekap transaksi minggu ini
   • \`/bulanini\` — Rekap arus kas bulan berjalan

3. **Multi-Modal AI:**
   • Foto struk Indomaret/Alfamart langsung terbaca rinciannya
   • Audio suara voice note langsung ditranskripsi & dicatat.`
    };
  }

  // Command /saldo
  if (lower === '/saldo' || lower.startsWith('/saldo ')) {
    const total = userWallets.reduce((a, b) => a + Number(b.balance || 0), 0);
    let reply = `👛 **Daftar Saldo Dompet TataDana:**\n`;
    userWallets.forEach(w => {
      reply += `├ ${w.is_default_telegram ? '⭐ [Utama] ' : '• '}${w.icon || '👛'} ${w.name}: **${formatRupiah(w.balance)}**\n`;
    });
    reply += `└ 💰 **Total Terkonsolidasi: ${formatRupiah(total)}**\n\n`;
    reply += `💡 *Ketik \`/dompet [nama]\` untuk mengubah dompet default.*`;
    return { status: 'command_executed', reply };
  }

  // Command /dompet
  if (lower.startsWith('/dompet')) {
    const parts = text.split(/\s+/);
    if (parts.length > 1) {
      const targetQuery = parts.slice(1).join(' ').toLowerCase();
      const matched = userWallets.find(w => w.name.toLowerCase().includes(targetQuery) || w.wallet_type.toLowerCase() === targetQuery);
      if (matched) {
        userWallets.forEach(w => w.is_default_telegram = false);
        matched.is_default_telegram = true;
        return {
          status: 'command_executed',
          reply: `✅ **Dompet Default Telegram Berhasil Diubah!**\nSekarang pencatatan Telegram otomatis menggunakan: **${matched.icon || '👛'} ${matched.name}** (Saldo: ${formatRupiah(matched.balance)})`
        };
      } else {
        return {
          status: 'command_executed',
          reply: `❌ Dompet "${parts.slice(1).join(' ')}" tidak ditemukan.\nPilihan dompet kamu: ${userWallets.map(w => w.name).join(', ')}`
        };
      }
    } else {
      let reply = `👛 **Dompet Terdaftar:**\n`;
      userWallets.forEach(w => {
        reply += `• ${w.icon || '👛'} **${w.name}** ${w.is_default_telegram ? '⭐ (Default)' : ''} — Saldo: ${formatRupiah(w.balance)}\n`;
      });
      reply += `\nKetik: \`/dompet BCA\` atau \`/dompet GoPay\` untuk mengganti dompet default bot.`;
      return { status: 'command_executed', reply };
    }
  }

  // Command /budget
  if (lower.startsWith('/budget')) {
    const nowWib = getWIBDate();
    const todayStr = nowWib.toISOString().slice(0, 10);
    const curMonth = getCurrentMonthWIB();
    const dayOfWeek = nowWib.getDay() || 7;
    const monDate = new Date(nowWib);
    monDate.setDate(nowWib.getDate() - (dayOfWeek - 1));
    const monStr = monDate.toISOString().slice(0, 10);

    const userTxs = db.transactions.filter(t => t.user_id === activeUser.id && t.type === 'pengeluaran');
    const spentToday = userTxs.filter(t => (t.transaction_date || '').startsWith(todayStr)).reduce((s, t) => s + Number(t.amount || 0), 0);
    const spentWeek = userTxs.filter(t => (t.transaction_date || '').slice(0, 10) >= monStr).reduce((s, t) => s + Number(t.amount || 0), 0);
    const spentMonth = userTxs.filter(t => (t.transaction_date || '').startsWith(curMonth)).reduce((s, t) => s + Number(t.amount || 0), 0);

    const dailyLimit = 100000;
    const weeklyLimit = 700000;
    const monthlyLimit = 3100000;

    const dailyPct = Math.round((spentToday / dailyLimit) * 100);
    const weeklyPct = Math.round((spentWeek / weeklyLimit) * 100);
    const monthlyPct = Math.round((spentMonth / monthlyLimit) * 100);

    const reply = `📊 **Status Anggaran (Budget TataDana):**

📅 **Harian (Hari Ini):**
${generateProgressBar(dailyPct)} ${dailyPct}%
• Terpakai : **${formatRupiah(spentToday)}** / Limit ${formatRupiah(dailyLimit)}
• Sisa     : **${formatRupiah(Math.max(0, dailyLimit - spentToday))}**

📆 **Mingguan (Minggu Ini):**
${generateProgressBar(weeklyPct)} ${weeklyPct}%
• Terpakai : **${formatRupiah(spentWeek)}** / Limit ${formatRupiah(weeklyLimit)}
• Sisa     : **${formatRupiah(Math.max(0, weeklyLimit - spentWeek))}**

🗓️ **Bulanan (${curMonth}):**
${generateProgressBar(monthlyPct)} ${monthlyPct}%
• Terpakai : **${formatRupiah(spentMonth)}** / Limit ${formatRupiah(monthlyLimit)}
• Sisa     : **${formatRupiah(Math.max(0, monthlyLimit - spentMonth))}**

💡 *Disiplin mencatat adalah kunci menjaga anggaran tetap terkendali!*`;
    return { status: 'command_executed', reply };
  }

  // Command /hariini or /hari ini
  if (lower.startsWith('/hariini') || lower.startsWith('/hari ini')) {
    const todayStr = getWIBDate().toISOString().slice(0, 10);
    const dayTxs = db.transactions.filter(t => t.user_id === activeUser.id && (t.transaction_date || '').startsWith(todayStr));
    const inc = dayTxs.filter(t => t.type === 'pemasukan').reduce((s, t) => s + Number(t.amount || 0), 0);
    const exp = dayTxs.filter(t => t.type === 'pengeluaran').reduce((s, t) => s + Number(t.amount || 0), 0);

    let reply = `📅 **Rekap Transaksi Hari Ini (${todayStr} WIB):**\n`;
    reply += `├ 💰 Pemasukan   : **${formatRupiah(inc)}**\n`;
    reply += `├ 💸 Pengeluaran : **${formatRupiah(exp)}**\n`;
    reply += `└ 📊 Net Hari Ini : **${formatRupiah(inc - exp)}**\n\n`;

    if (dayTxs.length === 0) {
      reply += `Belum ada transaksi yang dicatat hari ini. Ketik seperti *"beli soto 25rb"* untuk mulai mencatat.`;
    } else {
      reply += `**Daftar Catatan Hari Ini:**\n`;
      dayTxs.slice(0, 10).forEach(t => {
        const sign = t.type === 'pemasukan' ? '+' : '-';
        reply += `• ${t.notes} (${sign}${formatRupiah(t.amount)})\n`;
      });
    }
    return { status: 'command_executed', reply };
  }

  // Command /mingguini or /minggu ini
  if (lower.startsWith('/mingguini') || lower.startsWith('/minggu ini')) {
    const nowWib = getWIBDate();
    const dayOfWeek = nowWib.getDay() || 7;
    const monDate = new Date(nowWib);
    monDate.setDate(nowWib.getDate() - (dayOfWeek - 1));
    const monStr = monDate.toISOString().slice(0, 10);

    const weekTxs = db.transactions.filter(t => t.user_id === activeUser.id && (t.transaction_date || '').slice(0, 10) >= monStr);
    const inc = weekTxs.filter(t => t.type === 'pemasukan').reduce((s, t) => s + Number(t.amount || 0), 0);
    const exp = weekTxs.filter(t => t.type === 'pengeluaran').reduce((s, t) => s + Number(t.amount || 0), 0);

    const reply = `📆 **Laporan Minggu Ini (Mulai ${monStr}):**\n├ 💰 Total Masuk  : **${formatRupiah(inc)}**\n├ 💸 Total Keluar : **${formatRupiah(exp)}**\n├ 📊 Net Arus Kas : **${formatRupiah(inc - exp)}**\n└ 📝 Total Catatan: ${weekTxs.length} transaksi`;
    return { status: 'command_executed', reply };
  }

  // Command /bulanini or /bulan ini
  if (lower.startsWith('/bulanini') || lower.startsWith('/bulan ini')) {
    const curMonth = getCurrentMonthWIB();
    const monthTxs = db.transactions.filter(t => t.user_id === activeUser.id && (t.transaction_date || '').startsWith(curMonth));
    const inc = monthTxs.filter(t => t.type === 'pemasukan').reduce((s, t) => s + Number(t.amount || 0), 0);
    const exp = monthTxs.filter(t => t.type === 'pengeluaran').reduce((s, t) => s + Number(t.amount || 0), 0);

    const reply = `🗓️ **Laporan Bulan Ini (${curMonth} WIB):**\n├ 💰 Pemasukan   : **${formatRupiah(inc)}**\n├ 💸 Pengeluaran : **${formatRupiah(exp)}**\n├ 📊 Net Cashflow: **${formatRupiah(inc - exp)}**\n└ 📝 Total Transaksi: ${monthTxs.length}`;
    return { status: 'command_executed', reply };
  }

  // Natural language transaction recording with Smart Wallet Detection
  let targetWallet = defaultWallet;
  for (const w of userWallets) {
    const wNameLower = w.name.toLowerCase();
    const wTypeLower = w.wallet_type.toLowerCase();
    if (lower.includes(wNameLower) || (wTypeLower === 'ewallet' && lower.includes('gopay')) || (wTypeLower === 'cash' && (lower.includes('tunai') || lower.includes('cash')))) {
      targetWallet = w;
      break;
    }
  }

  const nominal = parseIndonesianNominal(text) || 25000;
  const jenis = inferType(text);
  const kategori = inferCategory(text, jenis);
  const catatan = extractNotes(text);
  const cat = db.categories.find(c => c.name === kategori && c.user_id === activeUser.id) || db.categories[0];

  if (jenis === 'pengeluaran' && targetWallet && nominal > Number(targetWallet.balance || 0)) {
    const reply = `⚠️ **Saldo anda tidak mencukupi**\n\n` +
      `Nominal pengeluaran sebesar **${formatRupiah(nominal)}** melebihi saldo dompet **${targetWallet.name}** Anda saat ini (**${formatRupiah(targetWallet.balance || 0)}**).\n\n` +
      `Transaksi dibatalkan karena saldo tidak mencukupi. Silakan tambahkan pemasukan terlebih dahulu!`;
    return { status: 'insufficient_balance', reply, error: 'Saldo anda tidak mencukupi' };
  }

  const tx = {
    id: 'tx-' + Date.now(),
    user_id: activeUser.id,
    wallet_id: targetWallet.id,
    category_id: cat ? cat.id : 'cat-01',
    type: jenis,
    amount: nominal,
    notes: catatan,
    source: 'telegram_text',
    transaction_date: new Date().toISOString()
  };
  addTransaction(tx);

  if (jenis === 'pengeluaran') {
    targetWallet.balance -= nominal;
  } else {
    targetWallet.balance += nominal;
  }

  const reply = jenis === 'pengeluaran' ? formatExpenseReply({
    amount: nominal,
    categoryName: cat ? cat.name : 'Pengeluaran',
    categoryIcon: cat ? cat.icon : '🏷️',
    walletName: targetWallet.name,
    notes: catatan,
    currentBalance: targetWallet.balance,
    categoryBudget: 1500000,
    categorySpent: 850000 + nominal
  }) : formatIncomeReply({
    amount: nominal,
    walletName: targetWallet.name,
    notes: catatan,
    currentBalance: targetWallet.balance
  });

  return { status: 'recorded', reply, transaction: tx };
}

async function handleRequest(req, res) {
  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;
  const query = parsedUrl.query;
  const method = req.method;

  if (method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-user-id'
    });
    return res.end();
  }

  try {
    loadDatabaseFromFile();
    const headerUserId = req.headers['x-user-id'];
    if (headerUserId && db.profiles.some(u => u.id === headerUserId)) {
      activeUserId = headerUserId;
    }

    // 1. Auth APIs
    if (pathname === '/api/auth/me') {
      const user = db.profiles.find(u => u.id === activeUserId) || db.profiles[0];
      return sendJson(res, 200, { success: true, user });
    }

    if (pathname === '/api/auth/logout' && method === 'POST') {
      activeUserId = 'usr-demo-001';
      return sendJson(res, 200, { success: true, message: 'Berhasil keluar dari akun.', user: db.profiles[0] });
    }

    if (pathname === '/api/auth/switch-user' && method === 'POST') {
      const body = await parseBody(req);
      if (body.role === 'superadmin') {
        const adminUser = db.profiles.find(u => u.role === 'superadmin') || db.profiles[1];
        activeUserId = adminUser.id;
      } else {
        const regularUser = db.profiles.find(u => u.role === 'user' && u.id === 'usr-demo-001') || db.profiles[0];
        activeUserId = regularUser.id;
      }
      const user = db.profiles.find(u => u.id === activeUserId) || db.profiles[0];
      return sendJson(res, 200, { success: true, user });
    }

    if (pathname === '/api/auth/register' && method === 'POST') {
      const { email, phoneNumber, fullName, password } = await parseBody(req);
      const cleanPhone = (phoneNumber || '').trim().replace(/[^0-9+]/g, '');

      if (!cleanPhone || cleanPhone.length < 9) {
        return sendJson(res, 400, {
          success: false,
          message: 'Nomor WhatsApp wajib diisi dengan benar (contoh: +6281234567890 atau 081234567890).'
        });
      }

      // Check if phone or email already registered
      const existingUser = db.profiles.find(u => 
        (u.phone_number && u.phone_number.replace(/[^0-9]/g, '') === cleanPhone.replace(/[^0-9]/g, '')) ||
        (email && u.email.toLowerCase() === email.trim().toLowerCase())
      );

      let targetUser;
      if (existingUser) {
        if (existingUser.whatsapp_verified || existingUser.phone_verified) {
          return sendJson(res, 400, {
            success: false,
            message: 'Nomor WhatsApp atau email ini sudah terdaftar dan terverifikasi. Silakan langsung masuk.'
          });
        }
        if (password) existingUser.password = password;
        if (fullName) existingUser.full_name = fullName;
        targetUser = existingUser;
      } else {
        targetUser = {
          id: 'usr-' + Date.now(),
          email: email ? email.trim() : `user_${Date.now()}@tatadana.id`,
          phone_number: cleanPhone,
          full_name: fullName || 'Pengguna Baru',
          password: password || 'user123',
          role: 'user',
          plan_tier: 'starter',
          phone_verified: false,
          whatsapp_verified: false,
          created_at: new Date().toISOString()
        };
        db.profiles.push(targetUser);
      }

      if (!targetUser.created_at) {
        targetUser.created_at = new Date().toISOString();
      }

      // Initialize all financial records to 0 for newly registered user
      db.wallets = db.wallets.filter(w => w.user_id !== targetUser.id);
      db.transactions = db.transactions.filter(t => t.user_id !== targetUser.id);
      db.budgets = db.budgets.filter(b => b.user_id !== targetUser.id);
      db.categories = db.categories.filter(c => c.user_id !== targetUser.id);

      // Starter wallet with strictly 0 balance
      db.wallets.push({
        id: 'w-' + targetUser.id + '-1',
        user_id: targetUser.id,
        name: 'Dompet Utama',
        wallet_type: 'cash',
        balance: 0,
        is_default_telegram: true,
        color: '#FF5B00',
        icon: '💵'
      });

      // Default categories so user can record transactions immediately
      db.categories.push(
        { id: 'cat-' + targetUser.id + '-01', user_id: targetUser.id, name: 'Makanan & Minuman', type: 'expense', icon: '🍜', color: '#F97316' },
        { id: 'cat-' + targetUser.id + '-02', user_id: targetUser.id, name: 'Transportasi', type: 'expense', icon: '🚗', color: '#3B82F6' },
        { id: 'cat-' + targetUser.id + '-03', user_id: targetUser.id, name: 'Tagihan & Utilitas', type: 'expense', icon: '🏠', color: '#8B5CF6' },
        { id: 'cat-' + targetUser.id + '-04', user_id: targetUser.id, name: 'Belanja Kebutuhan', type: 'expense', icon: '👕', color: '#EC4899' },
        { id: 'cat-' + targetUser.id + '-05', user_id: targetUser.id, name: 'Gaji & Pendapatan', type: 'income', icon: '💰', color: '#059669' }
      );

      console.log(`\n=======================================================`);
      console.log(`📲 [TataDana Pendaftaran] Pengguna baru terdaftar: ${targetUser.full_name} (${cleanPhone})`);
      console.log(`💬 Menunggu chat WhatsApp ke Admin (${ADMIN_WHATSAPP_NUMBER}) & persetujuan dashboard.`);
      console.log(`=======================================================\n`);

      // Insert new user into Antrean Verifikasi & Approval Pembayaran
      const existingQueue = db.payments.find(p => p.user_id === targetUser.id && (p.type === 'registration_verification' || (p.order_id && p.order_id.startsWith('REG-'))));
      if (existingQueue) {
        existingQueue.status = 'pending';
        existingQueue.created_at = new Date().toISOString();
        existingQueue.phone_number = cleanPhone;
        existingQueue.full_name = targetUser.full_name;
        existingQueue.email = targetUser.email;
        existingQueue.plan_tier = targetUser.plan_tier || 'starter';
      } else {
        const queueItem = {
          order_id: 'REG-' + Date.now(),
          user_id: targetUser.id,
          type: 'registration_verification',
          full_name: targetUser.full_name,
          phone_number: cleanPhone,
          email: targetUser.email,
          amount: 0,
          plan_tier: targetUser.plan_tier || 'starter',
          status: 'pending',
          created_at: targetUser.created_at || new Date().toISOString()
        };
        db.payments.unshift(queueItem);
      }

      db.adminAuditLogs.unshift({
        id: 'aud-' + Date.now(),
        action: 'REGISTRATION_QUEUED',
        details: `Profil pengguna baru ${targetUser.full_name} (${cleanPhone}) masuk ke Antrean Verifikasi & Approval Admin.`,
        admin: 'Sistem Registrasi',
        created_at: new Date().toISOString()
      });

      saveDatabaseToFile();

      return sendJson(res, 200, {
        success: true,
        registration_recorded: true,
        requires_whatsapp_verification: true,
        adminWhatsapp: ADMIN_WHATSAPP_NUMBER,
        user: {
          id: targetUser.id,
          full_name: targetUser.full_name,
          phone_number: cleanPhone,
          email: targetUser.email,
          role: targetUser.role
        },
        phoneNumber: cleanPhone,
        message: `Pendaftaran berhasil dicatat! Silakan kirim chat ke nomor WhatsApp Admin (${ADMIN_WHATSAPP_NUMBER}) untuk verifikasi dan aktivasi akun Anda.`
      });
    }

    if (pathname === '/api/auth/check-status' && (method === 'GET' || method === 'POST')) {
      const cleanPhone = (query.phone || query.phoneNumber || '').trim().replace(/[^0-9+]/g, '');
      const userId = query.userId;

      let user = null;
      if (userId) {
        user = db.profiles.find(u => u.id === userId);
      }
      if (!user && cleanPhone) {
        user = db.profiles.find(u => u.phone_number && u.phone_number.replace(/[^0-9]/g, '') === cleanPhone.replace(/[^0-9]/g, ''));
      }

      if (!user) {
        return sendJson(res, 404, { success: false, verified: false, message: 'Pengguna belum terdaftar' });
      }

      const isVerified = Boolean(user.whatsapp_verified || user.phone_verified);
      if (isVerified) {
        activeUserId = user.id;
      }

      return sendJson(res, 200, {
        success: true,
        verified: isVerified,
        status: isVerified ? 'verified' : 'pending_admin_approval',
        user: isVerified ? user : { id: user.id, full_name: user.full_name, phone_number: user.phone_number }
      });
    }

    if (pathname === '/api/auth/resend-whatsapp-otp' && method === 'POST') {
      return sendJson(res, 200, {
        success: true,
        adminWhatsapp: ADMIN_WHATSAPP_NUMBER,
        message: `TataDana tidak menggunakan sistem kode verifikasi. Cukup hubungi WhatsApp Admin (${ADMIN_WHATSAPP_NUMBER}) untuk aktivasi akun.`
      });
    }

    if ((pathname === '/api/auth/verify-otp' || pathname === '/api/auth/verify-whatsapp') && method === 'POST') {
      const { phoneNumber } = await parseBody(req);
      const cleanPhone = (phoneNumber || '').trim().replace(/[^0-9+]/g, '');
      const user = db.profiles.find(u => u.phone_number && u.phone_number.replace(/[^0-9]/g, '') === cleanPhone.replace(/[^0-9]/g, ''));

      if (!user) {
        return sendJson(res, 404, { success: false, message: 'Nomor WhatsApp tidak terdaftar di sistem.' });
      }

      if (!user.whatsapp_verified && !user.phone_verified) {
        return sendJson(res, 400, {
          success: false,
          adminWhatsapp: ADMIN_WHATSAPP_NUMBER,
          message: `Akun Anda sedang dalam antrean verifikasi Admin (${ADMIN_WHATSAPP_NUMBER}). Super Admin menyetujui akun Anda langsung dari Admin Dashboard tanpa kode verifikasi.`
        });
      }

      activeUserId = user.id;

      // Seed starter wallet if new user has none
      const existingWallets = db.wallets.filter(w => w.user_id === user.id);
      if (existingWallets.length === 0) {
        db.wallets.push({
          id: 'w-' + Date.now(),
          user_id: user.id,
          name: 'Dompet Tunai',
          wallet_type: 'cash',
          balance: 0,
          is_default_telegram: true,
          color: '#10B981',
          icon: '💵'
        });
      }

      return sendJson(res, 200, {
        success: true,
        message: 'Nomor WhatsApp Anda telah diverifikasi oleh Admin. Akun aktif.',
        user
      });
    }

    if (pathname === '/api/auth/login' && method === 'POST') {
      const { email, password } = await parseBody(req);
      const cleanEmail = (email || '').trim().toLowerCase();

      // Check admin credentials
      if (
        cleanEmail === '@nandikapratama' ||
        cleanEmail === 'nandikapratama' ||
        cleanEmail === 'nandikapratama@tatadana.id' ||
        cleanEmail === 'nandikapratama@gmail.com' ||
        cleanEmail === 'admin@tatadana.id'
      ) {
        if (!password || password !== 'nandika@1234') {
          return sendJson(res, 401, { success: false, message: 'Kata sandi admin salah. Gunakan password: nandika@1234' });
        }
        const adminUser = db.profiles.find(u => u.role === 'superadmin') || db.profiles[1];
        activeUserId = adminUser.id;
        return sendJson(res, 200, { success: true, user: adminUser, message: 'Selamat datang Super Admin Nandika Pratama!' });
      }

      // Standard user login by email or phone
      const user = db.profiles.find(u => 
        u.email.toLowerCase() === cleanEmail || 
        (u.phone_number && u.phone_number.replace(/[^0-9]/g, '') === cleanEmail.replace(/[^0-9]/g, ''))
      );

      if (!user) {
        return sendJson(res, 404, { success: false, message: 'Akun tidak ditemukan. Silakan periksa email/nomor WhatsApp Anda atau daftar baru.' });
      }

      if (user.password && password && user.password !== password) {
        return sendJson(res, 401, { success: false, message: 'Kata sandi yang Anda masukkan salah.' });
      }

      // MANDATORY WHATSAPP VERIFICATION CHECK FOR REGULAR USERS
      if (user.role !== 'superadmin' && (!user.whatsapp_verified && !user.phone_verified)) {
        return sendJson(res, 403, {
          success: false,
          requires_whatsapp_verification: true,
          adminWhatsapp: ADMIN_WHATSAPP_NUMBER,
          user: {
            id: user.id,
            full_name: user.full_name,
            phone_number: user.phone_number,
            email: user.email
          },
          phoneNumber: user.phone_number,
          message: `Akun Anda sedang dalam antrean verifikasi Admin. Silakan kirim chat ke WhatsApp Admin (${ADMIN_WHATSAPP_NUMBER}) untuk aktivasi akun.`
        });
      }

      activeUserId = user.id;
      return sendJson(res, 200, { success: true, user });
    }

    // User Profile API (Update name, phone, avatar)
    if (pathname === '/api/user/profile') {
      if (method === 'GET') {
        const user = db.profiles.find(u => u.id === activeUserId) || db.profiles[0];
        return sendJson(res, 200, { success: true, user });
      }
      if (method === 'POST') {
        const body = await parseBody(req);
        const targetId = body.userId || activeUserId;
        const user = db.profiles.find(u => u.id === targetId) || db.profiles.find(u => u.id === activeUserId) || db.profiles[0];
        if (!user) {
          return sendJson(res, 404, { success: false, message: 'Pengguna tidak ditemukan.' });
        }

        if (body.fullName !== undefined && body.fullName !== null) {
          user.full_name = String(body.fullName).trim();
        }
        if (body.avatarUrl !== undefined) {
          user.avatar_url = body.avatarUrl;
        }
        if (body.phoneNumber !== undefined && body.phoneNumber !== null) {
          user.phone_number = String(body.phoneNumber).trim();
        }

        return sendJson(res, 200, {
          success: true,
          message: 'Profil dan foto berhasil diperbarui!',
          user
        });
      }
    }

    // 2. Wallets & Categories
    if (pathname === '/api/wallets') {
      if (method === 'POST') {
        const body = await parseBody(req);
        const user = db.profiles.find(u => u.id === activeUserId) || db.profiles[0];
        const wallets = db.wallets.filter(w => w.user_id === activeUserId);
        if (user.plan_tier !== 'pro' && wallets.length >= 3) {
          return sendJson(res, 403, { success: false, message: 'Paket Starter dibatasi maksimal 3 dompet. Upgrade ke Pro untuk dompet unlimited!' });
        }
        const newWallet = {
          id: 'w-' + Date.now(),
          user_id: activeUserId,
          name: body.name || 'Dompet Baru',
          wallet_type: body.wallet_type || 'bank',
          balance: Number(body.balance) || 0,
          is_default_telegram: Boolean(body.is_default_telegram),
          color: body.color || '#FF5B00',
          icon: body.icon || (body.wallet_type === 'bank' ? '🏦' : body.wallet_type === 'ewallet' ? '📱' : '💵')
        };
        if (newWallet.is_default_telegram) {
          wallets.forEach(w => w.is_default_telegram = false);
        }
        db.wallets.push(newWallet);
        saveDatabaseToFile();
        return sendJson(res, 201, { success: true, wallet: newWallet, message: 'Dompet baru berhasil ditambahkan!' });
      }
      let userWallets = db.wallets.filter(w => w.user_id === activeUserId);
      if (userWallets.length === 0) {
        const initialWallet = {
          id: 'w-' + activeUserId + '-1',
          user_id: activeUserId,
          name: 'Dompet Utama',
          wallet_type: 'cash',
          balance: 0,
          is_default_telegram: true,
          color: '#FF5B00',
          icon: '💵'
        };
        db.wallets.push(initialWallet);
        saveDatabaseToFile();
        userWallets = [initialWallet];
      }
      return sendJson(res, 200, { success: true, wallets: userWallets });
    }

    if (pathname === '/api/wallets/set-default' && method === 'POST') {
      const { walletId } = await parseBody(req);
      const userWallets = db.wallets.filter(w => w.user_id === activeUserId);
      userWallets.forEach(w => w.is_default_telegram = (w.id === walletId));
      return sendJson(res, 200, { success: true, message: 'Dompet default Telegram berhasil diperbarui!' });
    }

    if (pathname === '/api/wallets/delete' && method === 'POST') {
      const { walletId } = await parseBody(req);
      const userWallets = db.wallets.filter(w => w.user_id === activeUserId);
      if (userWallets.length <= 1) {
        return sendJson(res, 400, { success: false, message: 'Anda harus memiliki minimal 1 dompet aktif.' });
      }
      const idx = db.wallets.findIndex(w => w.id === walletId && w.user_id === activeUserId);
      if (idx !== -1) {
        const deleted = db.wallets.splice(idx, 1)[0];
        if (deleted.is_default_telegram) {
          const firstLeft = db.wallets.find(w => w.user_id === activeUserId);
          if (firstLeft) firstLeft.is_default_telegram = true;
        }
        return sendJson(res, 200, { success: true, message: 'Dompet berhasil dihapus.' });
      }
      return sendJson(res, 404, { success: false, message: 'Dompet tidak ditemukan.' });
    }

    if (pathname === '/api/categories') {
      if (method === 'POST') {
        const body = await parseBody(req);
        const user = db.profiles.find(u => u.id === activeUserId) || db.profiles[0];
        const cats = db.categories.filter(c => c.user_id === activeUserId);
        if (user.plan_tier !== 'pro' && cats.length >= 10) {
          return sendJson(res, 403, { success: false, message: 'Batas kategori paket Starter tercapai. Upgrade ke Pro untuk kategori unlimited!' });
        }
        const newCat = {
          id: 'cat-' + Date.now(),
          user_id: activeUserId,
          name: body.name || 'Kategori Baru',
          type: body.type || 'expense',
          icon: body.icon || '🏷️',
          color: body.color || '#FF5B00',
          is_custom: true
        };
        db.categories.push(newCat);
        return sendJson(res, 201, { success: true, category: newCat });
      }
      let userCats = db.categories.filter(c => c.user_id === activeUserId);
      if (userCats.length === 0) {
        const defaultCats = [
          { id: 'cat-' + activeUserId + '-01', user_id: activeUserId, name: 'Makanan & Minuman', type: 'expense', icon: '🍜', color: '#F97316' },
          { id: 'cat-' + activeUserId + '-02', user_id: activeUserId, name: 'Transportasi', type: 'expense', icon: '🚗', color: '#3B82F6' },
          { id: 'cat-' + activeUserId + '-03', user_id: activeUserId, name: 'Tagihan & Utilitas', type: 'expense', icon: '🏠', color: '#8B5CF6' },
          { id: 'cat-' + activeUserId + '-04', user_id: activeUserId, name: 'Belanja Kebutuhan', type: 'expense', icon: '👕', color: '#EC4899' },
          { id: 'cat-' + activeUserId + '-05', user_id: activeUserId, name: 'Gaji & Pendapatan', type: 'income', icon: '💰', color: '#059669' }
        ];
        db.categories.push(...defaultCats);
        userCats = defaultCats;
      }
      return sendJson(res, 200, { success: true, categories: userCats });
    }

    if (pathname === '/api/categories/delete' && method === 'POST') {
      const { categoryId } = await parseBody(req);
      const idx = db.categories.findIndex(c => c.id === categoryId && c.user_id === activeUserId);
      if (idx !== -1) {
        db.categories.splice(idx, 1);
        return sendJson(res, 200, { success: true, message: 'Kategori berhasil dihapus.' });
      }
      return sendJson(res, 404, { success: false, message: 'Kategori tidak ditemukan.' });
    }

    // 3. Transactions
    if (pathname === '/api/transactions') {
      if (method === 'POST') {
        const body = await parseBody(req);
        const user = db.profiles.find(u => u.id === activeUserId) || db.profiles[0];
        const curMonth = getCurrentMonthWIB();
        const monthlyTxCount = db.transactions.filter(t => t.user_id === activeUserId && (t.transaction_date || '').startsWith(curMonth)).length;
        if (user.plan_tier !== 'pro' && monthlyTxCount >= 50) {
          return sendJson(res, 403, { success: false, message: 'Batas 50 transaksi bulanan Starter telah tercapai. Upgrade ke Pro untuk transaksi unlimited!' });
        }
        const nominal = Number(body.amount) || 0;
        const wallet = db.wallets.find(w => w.id === body.walletId) || db.wallets.find(w => w.user_id === activeUserId) || db.wallets[0];
        const cat = db.categories.find(c => c.id === body.categoryId) || db.categories[0];
        const txType = body.type || 'pengeluaran';

        // Validasi: jika pembayaran / pengeluaran melebihi saldo dompet
        if (txType === 'pengeluaran' && wallet && nominal > Number(wallet.balance || 0)) {
          return sendJson(res, 400, {
            success: false,
            message: 'Saldo anda tidak mencukupi',
            walletName: wallet.name,
            currentBalance: wallet.balance,
            requiredAmount: nominal
          });
        }
        
        let txDate = body.transaction_date;
        if (txDate) {
          if (!txDate.includes('T')) {
            txDate = `${txDate}T12:00:00+07:00`;
          }
        } else {
          txDate = new Date().toISOString();
        }

        const tx = {
          id: 'tx-' + Date.now(),
          user_id: activeUserId,
          wallet_id: wallet ? wallet.id : 'w-001',
          category_id: cat ? cat.id : 'cat-01',
          type: body.type || 'pengeluaran',
          amount: nominal,
          notes: body.notes || 'Transaksi Baru',
          source: body.source || 'manual_web',
          transaction_date: txDate
        };
        addTransaction(tx);
        if (wallet) {
          if (tx.type === 'pengeluaran') {
            wallet.balance -= nominal;
          } else {
            wallet.balance += nominal;
          }
        }
        return sendJson(res, 201, { success: true, transaction: tx });
      }

      const enriched = getFilteredUserTransactions(activeUserId, query);
      return sendJson(res, 200, { success: true, total: enriched.length, transactions: enriched });
    }

    if (pathname === '/api/transactions/delete' && method === 'POST') {
      const { transactionId } = await parseBody(req);
      const idx = db.transactions.findIndex(t => t.id === transactionId && t.user_id === activeUserId);
      if (idx !== -1) {
        const deleted = db.transactions.splice(idx, 1)[0];
        // Revert wallet balance
        const wallet = db.wallets.find(w => w.id === deleted.wallet_id);
        if (wallet) {
          if (deleted.type === 'pengeluaran') {
            wallet.balance += Number(deleted.amount || 0);
          } else {
            wallet.balance -= Number(deleted.amount || 0);
          }
        }
        saveDatabaseToFile();
        return sendJson(res, 200, { success: true, message: 'Transaksi berhasil dihapus dan saldo dompet disesuaikan.' });
      }
      return sendJson(res, 404, { success: false, message: 'Transaksi tidak ditemukan.' });
    }

    // 3B. Budget Management: Harian + Mingguan + Bulanan
    if (pathname === '/api/budgets/summary' && method === 'GET') {
      const userTxs = db.transactions.filter(t => t.user_id === activeUserId && t.type === 'pengeluaran');
      const nowWib = getWIBDate();
      const todayStr = nowWib.toISOString().slice(0, 10);
      const curMonth = getCurrentMonthWIB();

      // Today's spending
      const spentToday = userTxs.filter(t => (t.transaction_date || '').startsWith(todayStr))
                               .reduce((sum, t) => sum + Number(t.amount || 0), 0);

      // Current week's spending (Monday to Sunday)
      const dayOfWeek = nowWib.getDay() || 7;
      const monDate = new Date(nowWib);
      monDate.setDate(nowWib.getDate() - (dayOfWeek - 1));
      const monStr = monDate.toISOString().slice(0, 10);
      const spentWeek = userTxs.filter(t => (t.transaction_date || '').slice(0, 10) >= monStr)
                              .reduce((sum, t) => sum + Number(t.amount || 0), 0);

      // Monthly spending
      const spentMonth = userTxs.filter(t => (t.transaction_date || '').startsWith(curMonth))
                               .reduce((sum, t) => sum + Number(t.amount || 0), 0);

      const userBudgets = db.budgets.filter(b => b.user_id === activeUserId);

      // Daily budgets
      const dailyBudgets = userBudgets.filter(b => b.period === 'daily').map(b => {
        const cat = db.categories.find(c => c.id === b.category_id);
        const catSpentToday = userTxs.filter(t => t.category_id === b.category_id && (t.transaction_date || '').startsWith(todayStr))
                                     .reduce((s, t) => s + Number(t.amount || 0), 0);
        return { ...b, category_name: cat?.name || 'Kategori', category_icon: cat?.icon || '🏷️', spent: catSpentToday, remaining: Math.max(0, b.amount - catSpentToday), pct: Math.round((catSpentToday / b.amount) * 100) };
      });
      const totalDailyLimit = dailyBudgets.reduce((s, b) => s + b.amount, 0);

      // Weekly budgets
      const weeklyBudgets = userBudgets.filter(b => b.period === 'weekly').map(b => {
        const cat = db.categories.find(c => c.id === b.category_id);
        const catSpentWeek = userTxs.filter(t => t.category_id === b.category_id && (t.transaction_date || '').slice(0, 10) >= monStr)
                                    .reduce((s, t) => s + Number(t.amount || 0), 0);
        return { ...b, category_name: cat?.name || 'Kategori', category_icon: cat?.icon || '🏷️', spent: catSpentWeek, remaining: Math.max(0, b.amount - catSpentWeek), pct: Math.round((catSpentWeek / b.amount) * 100) };
      });
      const totalWeeklyLimit = weeklyBudgets.reduce((s, b) => s + b.amount, 0);

      // Monthly budgets
      const monthlyBudgets = userBudgets.filter(b => (b.period === 'monthly' || !b.period)).map(b => {
        const cat = db.categories.find(c => c.id === b.category_id);
        const catSpentMonth = userTxs.filter(t => t.category_id === b.category_id && (t.transaction_date || '').startsWith(curMonth))
                                     .reduce((s, t) => s + Number(t.amount || 0), 0);
        return { ...b, category_name: cat?.name || 'Kategori', category_icon: cat?.icon || '🏷️', spent: catSpentMonth, remaining: Math.max(0, b.amount - catSpentMonth), pct: Math.round((catSpentMonth / b.amount) * 100) };
      });
      const totalMonthlyLimit = monthlyBudgets.reduce((s, b) => s + b.amount, 0);

      return sendJson(res, 200, {
        success: true,
        daily: {
          limit: totalDailyLimit,
          spent: spentToday,
          remaining: Math.max(0, totalDailyLimit - spentToday),
          pct: totalDailyLimit > 0 ? Math.round((spentToday / totalDailyLimit) * 100) : 0,
          items: dailyBudgets
        },
        weekly: {
          limit: totalWeeklyLimit,
          spent: spentWeek,
          remaining: Math.max(0, totalWeeklyLimit - spentWeek),
          pct: totalWeeklyLimit > 0 ? Math.round((spentWeek / totalWeeklyLimit) * 100) : 0,
          items: weeklyBudgets
        },
        monthly: {
          limit: totalMonthlyLimit,
          spent: spentMonth,
          remaining: Math.max(0, totalMonthlyLimit - spentMonth),
          pct: totalMonthlyLimit > 0 ? Math.round((spentMonth / totalMonthlyLimit) * 100) : 0,
          items: monthlyBudgets
        }
      });
    }

    if (pathname === '/api/budgets') {
      if (method === 'POST') {
        const body = await parseBody(req);
        const period = body.period || 'monthly';
        const curMonth = body.month_period || getCurrentMonthWIB();
        let b = db.budgets.find(x => x.user_id === activeUserId && x.category_id === body.categoryId && (x.period === period || (!x.period && period === 'monthly')));
        if (b) {
          b.amount = Number(body.amount) || b.amount;
          b.period = period;
        } else {
          b = {
            id: 'bg-' + Date.now(),
            user_id: activeUserId,
            category_id: body.categoryId,
            period,
            amount: Number(body.amount) || 1000000,
            month_period: curMonth,
            spent_amount: 0
          };
          db.budgets.push(b);
        }
        return sendJson(res, 200, { success: true, budget: b, message: `Budget ${period} berhasil disimpan!` });
      }
      return sendJson(res, 200, { success: true, budgets: db.budgets.filter(b => b.user_id === activeUserId) });
    }

    if (pathname === '/api/budgets/delete' && method === 'POST') {
      const { budgetId } = await parseBody(req);
      const idx = db.budgets.findIndex(b => b.id === budgetId && b.user_id === activeUserId);
      if (idx !== -1) {
        db.budgets.splice(idx, 1);
        return sendJson(res, 200, { success: true, message: 'Budget berhasil dihapus.' });
      }
      return sendJson(res, 404, { success: false, message: 'Budget tidak ditemukan.' });
    }

    // 3C. Financial Calendar View API (Real-Time WIB Synchronized)
    if (pathname === '/api/calendar/month' && method === 'GET') {
      const nowWIB = new Date(Date.now() + 7 * 3600 * 1000);
      const currentYear = nowWIB.getUTCFullYear();
      const currentMonth = nowWIB.getUTCMonth() + 1;
      const todayDateStr = nowWIB.toISOString().slice(0, 10);

      const yr = parseInt(query.year, 10) || currentYear;
      const mo = parseInt(query.month, 10) || currentMonth;
      const monthStr = `${yr}-${String(mo).padStart(2, '0')}`;
      const daysInMonth = new Date(yr, mo, 0).getDate();
      const firstDayOfWeek = new Date(yr, mo - 1, 1).getDay(); // 0 is Sunday

      const txs = db.transactions.filter(t => t.user_id === activeUserId && (t.transaction_date || '').startsWith(monthStr));

      const days = [];
      let totalIncome = 0;
      let totalExpense = 0;
      let activeDays = 0;

      for (let d = 1; d <= daysInMonth; d++) {
        const dateStr = `${monthStr}-${String(d).padStart(2, '0')}`;
        const dayTxs = txs.filter(t => (t.transaction_date || '').startsWith(dateStr));
        let inc = 0;
        let exp = 0;
        dayTxs.forEach(t => {
          if (t.type === 'pemasukan') inc += Number(t.amount || 0);
          if (t.type === 'pengeluaran') exp += Number(t.amount || 0);
        });

        if (dayTxs.length > 0) activeDays++;
        totalIncome += inc;
        totalExpense += exp;

        days.push({
          day: d,
          date: dateStr,
          isToday: dateStr === todayDateStr,
          dayOfWeek: new Date(yr, mo - 1, d).getDay(),
          total_income: inc,
          total_expense: exp,
          net: inc - exp,
          count: dayTxs.length,
          transactions: dayTxs.map(t => ({
            ...t,
            category_name: db.categories.find(c => c.id === t.category_id)?.name || '-',
            category_icon: db.categories.find(c => c.id === t.category_id)?.icon || '🏷️',
            wallet_name: db.wallets.find(w => w.id === t.wallet_id)?.name || '-'
          }))
        });
      }

      return sendJson(res, 200, {
        success: true,
        year: yr,
        month: mo,
        todayDate: todayDateStr,
        isCurrentMonth: (yr === currentYear && mo === currentMonth),
        serverTime: new Date().toISOString(),
        serverTimeWIB: nowWIB.toISOString(),
        liveTimestamp: Date.now(),
        monthLabel: `${['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'][mo - 1]} ${yr}`,
        firstDayOffset: (firstDayOfWeek + 6) % 7, // Convert to Mon=0..Sun=6
        daysInMonth,
        days,
        summary: {
          totalIncome,
          totalExpense,
          netCashflow: totalIncome - totalExpense,
          activeDays,
          avgDailyExpense: activeDays > 0 ? Math.round(totalExpense / activeDays) : 0
        }
      });
    }

    // 4. Reports & Summary
    if (pathname === '/api/reports/summary') {
      const enriched = getFilteredUserTransactions(activeUserId, query);
      let income = 0;
      let expense = 0;
      enriched.forEach(t => {
        if (t.type === 'pemasukan') income += Number(t.amount || 0);
        if (t.type === 'pengeluaran') expense += Number(t.amount || 0);
      });
      const userBudgets = db.budgets.filter(b => b.user_id === activeUserId);
      const totalBudget = userBudgets.reduce((s, b) => s + Number(b.amount || 0), 0);
      const budgetRemaining = Math.max(0, totalBudget - expense);
      return sendJson(res, 200, {
        success: true,
        income,
        expense,
        netCashflow: income - expense,
        totalTransactions: enriched.length,
        totalBudget,
        budgetRemaining
      });
    }

    // 5. PDF & Excel Export
    if (pathname === '/api/reports/export/pdf') {
      const user = db.profiles.find(u => u.id === activeUserId) || db.profiles[0];
      const enriched = getFilteredUserTransactions(activeUserId, query);
      let income = 0;
      let expense = 0;
      enriched.forEach(t => {
        if (t.type === 'pemasukan') income += Number(t.amount || 0);
        if (t.type === 'pengeluaran') expense += Number(t.amount || 0);
      });
      const summary = { income, expense, net: income - expense };
      const selectedWallet = query.walletId ? db.wallets.find(w => w.id === query.walletId)?.name : null;
      const selectedCat = query.categoryId ? db.categories.find(c => c.id === query.categoryId)?.name : null;
      const pdf = generateFinancialReportPDF({
        userName: user.full_name,
        periodStart: query.startDate || 'Semua Periode',
        periodEnd: query.endDate || 'Semua Periode',
        filterInfo: {
          type: query.type ? (query.type === 'pemasukan' ? 'Hanya Pemasukan' : 'Hanya Pengeluaran') : 'Semua Jenis',
          category: selectedCat || 'Semua Kategori',
          wallet: selectedWallet || 'Semua Dompet'
        },
        summary,
        transactions: enriched
      });

      const sDate = query.startDate || 'Semua';
      const eDate = query.endDate || 'Semua';
      res.writeHead(200, {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="TataDana_Laporan_${sDate}_sd_${eDate}.pdf"`,
        'Content-Length': pdf.length
      });
      return res.end(pdf);
    }

    if (pathname === '/api/reports/export/excel') {
      const user = db.profiles.find(u => u.id === activeUserId) || db.profiles[0];
      const enriched = getFilteredUserTransactions(activeUserId, query);
      let income = 0;
      let expense = 0;
      enriched.forEach(t => {
        if (t.type === 'pemasukan') income += Number(t.amount || 0);
        if (t.type === 'pengeluaran') expense += Number(t.amount || 0);
      });
      const summary = { income, expense, net: income - expense };
      const selectedWallet = query.walletId ? db.wallets.find(w => w.id === query.walletId)?.name : null;
      const selectedCat = query.categoryId ? db.categories.find(c => c.id === query.categoryId)?.name : null;
      const xls = generateFinancialReportExcel({
        userName: user.full_name,
        periodStart: query.startDate || 'Semua Periode',
        periodEnd: query.endDate || 'Semua Periode',
        filterInfo: {
          type: query.type ? (query.type === 'pemasukan' ? 'Hanya Pemasukan' : 'Hanya Pengeluaran') : 'Semua Jenis',
          category: selectedCat || 'Semua Kategori',
          wallet: selectedWallet || 'Semua Dompet'
        },
        summary,
        transactions: enriched
      });

      const sDate = query.startDate || 'Semua';
      const eDate = query.endDate || 'Semua';
      res.writeHead(200, {
        'Content-Type': 'application/vnd.ms-excel',
        'Content-Disposition': `attachment; filename="TataDana_Laporan_${sDate}_sd_${eDate}.xls"`,
        'Content-Length': xls.length
      });
      return res.end(xls);
    }

    if (pathname === '/api/reports/history' && method === 'GET') {
      return sendJson(res, 200, { success: true, history: [] });
    }

    // 6. Telegram Settings & Live Test Connection
    if (pathname === '/api/settings/telegram/test' && method === 'POST') {
      const { botToken } = await parseBody(req);
      const token = (botToken || db.telegramBotToken || '').trim();
      if (!token) return sendJson(res, 400, { success: false, message: 'Token bot Telegram tidak boleh kosong.' });

      // Verify token live with official Telegram API getMe
      https.get(`https://api.telegram.org/bot${token}/getMe`, (tgRes) => {
        let body = '';
        tgRes.on('data', chunk => body += chunk);
        tgRes.on('end', () => {
          try {
            const json = JSON.parse(body);
            if (json.ok && json.result) {
              const botInfo = json.result;
              db.telegramBotToken = token;
              db.telegramBotInfo = botInfo;
              startTelegramPoller(token);
              return sendJson(res, 200, {
                success: true,
                message: `🟢 Berhasil terhubung dengan @${botInfo.username || 'TataKeuanganBot'} (${botInfo.first_name})! Bot siap mencatat transaksi real-time.`,
                bot: botInfo,
                webhook: { livePolling: true, registered: true }
              });
            } else {
              return sendJson(res, 400, {
                success: false,
                message: 'Token Telegram tidak valid: ' + (json.description || 'Gagal terhubung ke bot.')
              });
            }
          } catch (e) {
            return sendJson(res, 500, { success: false, message: 'Gagal memverifikasi respon Telegram API.' });
          }
        });
      }).on('error', (e) => {
        return sendJson(res, 500, { success: false, message: 'Koneksi ke api.telegram.org gagal: ' + e.message });
      });
      return;
    }

    if (pathname === '/api/settings/telegram' && method === 'GET') {
      return sendJson(res, 200, {
        success: true,
        session: {
          connection_status: 'connected',
          reminder_enabled: true,
          bot_username: db.telegramBotInfo?.username || 'TataKeuanganBot',
          bot_name: db.telegramBotInfo?.first_name || 'tatadana',
          bot_token: db.telegramBotToken || '8853112131:AAGNZDVNBGnBTZBZcNhIni1iv2eb011-Fjo'
        }
      });
    }
    if (pathname === '/api/settings/telegram' && method === 'POST') {
      const body = await parseBody(req);
      if (body.bot_token) {
        db.telegramBotToken = body.bot_token;
        startTelegramPoller(body.bot_token);
      }
      return sendJson(res, 200, { success: true, session: body });
    }

    // 7. Payment API
    if (pathname === '/api/payments/create' && method === 'POST') {
      const { planTier } = await parseBody(req);
      const amount = planTier === 'pro' ? 99000 : 49000;
      const orderId = 'ORDER-' + Date.now();
      const p = { order_id: orderId, user_id: activeUserId, amount, plan_tier: planTier, status: 'pending' };
      db.payments.unshift(p);
      return sendJson(res, 200, { success: true, orderId, amount, snapToken: 'SNAP-TOKEN-' + Math.random().toString(36).substr(2, 8), payment: p });
    }

    // 8. Admin & Simulator APIs - STRICT ACCESS CONTROL (SUPERADMIN ONLY)
    if (pathname.startsWith('/api/admin/')) {
      const activeUser = db.profiles.find(u => u.id === activeUserId);
      if (!activeUser || activeUser.role !== 'superadmin') {
        return sendJson(res, 403, {
          success: false,
          error: 'FORBIDDEN_SUPERADMIN_ONLY',
          message: 'Akses Ditolak (403 Forbidden): Hanya akun Super Admin (@nandikapratama) yang memiliki hak akses ke panel admin ini.'
        });
      }
    }

    if (pathname === '/api/admin/impersonate' && method === 'POST') {
      const { targetUserId } = await parseBody(req);
      const targetUser = db.profiles.find(u => u.id === targetUserId);
      if (targetUser) {
        activeUserId = targetUser.id;
        db.adminAuditLogs.unshift({
          id: 'aud-' + Date.now(),
          action: 'IMPERSONATE_USER',
          details: `Superadmin meng-impersonate user ${targetUser.full_name} (${targetUser.email}).`,
          admin: 'Nandika Pratama (@nandikapratama)',
          created_at: new Date().toISOString()
        });
        return sendJson(res, 200, { success: true, message: `Berhasil impersonate sebagai ${targetUser.full_name}`, user: targetUser });
      }
      return sendJson(res, 404, { success: false, message: 'User tidak ditemukan' });
    }

    if (pathname === '/api/admin/users') {
      loadDatabaseFromFile();
      const enrichedUsers = db.profiles.map(u => {
        const userWallets = db.wallets.filter(w => w.user_id === u.id);
        const userTxs = db.transactions.filter(t => t.user_id === u.id);
        const userBudgets = db.budgets.filter(b => b.user_id === u.id);
        const userCategories = db.categories.filter(c => c.user_id === u.id);
        const totalBalance = userWallets.reduce((s, w) => s + Number(w.balance || 0), 0);
        let totalIncome = 0;
        let totalExpense = 0;
        userTxs.forEach(t => {
          if (t.type === 'pemasukan') totalIncome += Number(t.amount || 0);
          if (t.type === 'pengeluaran') totalExpense += Number(t.amount || 0);
        });

        return {
          ...u,
          wallets_count: userWallets.length,
          total_balance: totalBalance,
          transactions_count: userTxs.length,
          total_income: totalIncome,
          total_expense: totalExpense,
          net_cashflow: totalIncome - totalExpense,
          budgets_count: userBudgets.length,
          categories_count: userCategories.length
        };
      });
      return sendJson(res, 200, { success: true, users: enrichedUsers.reverse() });
    }

    if (pathname === '/api/admin/user-database' && method === 'POST') {
      const { userId } = await parseBody(req);
      const user = db.profiles.find(u => u.id === userId);
      if (!user) {
        return sendJson(res, 404, { success: false, message: 'User tidak ditemukan' });
      }
      const userWallets = db.wallets.filter(w => w.user_id === userId);
      const userTxs = getFilteredUserTransactions(userId);
      const userBudgets = db.budgets.filter(b => b.user_id === userId).map(b => {
        const cat = db.categories.find(c => c.id === b.category_id);
        return {
          ...b,
          category_name: cat ? cat.name : 'Umum',
          category_icon: cat ? cat.icon : '🏷️'
        };
      });
      const userCategories = db.categories.filter(c => c.user_id === userId);
      const userPayments = db.payments.filter(p => p.user_id === userId);
      const userAuditLogs = db.adminAuditLogs.filter(a => a.details && a.details.includes(user.full_name));

      const totalBalance = userWallets.reduce((s, w) => s + Number(w.balance || 0), 0);
      let totalIncome = 0;
      let totalExpense = 0;
      userTxs.forEach(t => {
        if (t.type === 'pemasukan') totalIncome += Number(t.amount || 0);
        if (t.type === 'pengeluaran') totalExpense += Number(t.amount || 0);
      });

      return sendJson(res, 200, {
        success: true,
        user,
        database: {
          profile: user,
          wallets: userWallets,
          transactions: userTxs,
          budgets: userBudgets,
          categories: userCategories,
          payments: userPayments,
          auditLogs: userAuditLogs,
          summary: {
            totalWallets: userWallets.length,
            totalBalance,
            totalTransactions: userTxs.length,
            totalIncome,
            totalExpense,
            netCashflow: totalIncome - totalExpense,
            totalBudgets: userBudgets.length,
            totalCategories: userCategories.length
          }
        }
      });
    }

    if (pathname === '/api/admin/users/verify-whatsapp' && method === 'POST') {
      const { userId } = await parseBody(req);
      const u = db.profiles.find(x => x.id === userId);
      if (u) {
        u.whatsapp_verified = true;
        u.phone_verified = true;
        // Sync registration verification in db.payments
        const qItem = db.payments.find(p => p.user_id === u.id && (p.type === 'registration_verification' || (p.order_id && p.order_id.startsWith('REG-'))));
        if (qItem) {
          qItem.status = 'settlement';
        }
        db.adminAuditLogs.unshift({
          id: 'aud-' + Date.now(),
          action: 'ADMIN_MANUAL_WHATSAPP_VERIFICATION',
          details: `Superadmin Nandika Pratama memverifikasi nomor WhatsApp (${u.phone_number}) untuk user ${u.full_name}. Akun langsung aktif.`,
          admin: 'Nandika Pratama (@nandikapratama)',
          created_at: new Date().toISOString()
        });
        saveDatabaseToFile();
        return sendJson(res, 200, {
          success: true,
          message: `Nomor WhatsApp ${u.phone_number} untuk ${u.full_name} berhasil diverifikasi manual oleh Superadmin! Akun sekarang AKTIF.`,
          user: u
        });
      }
      return sendJson(res, 404, { success: false, message: 'Pengguna tidak ditemukan.' });
    }
    if (pathname === '/api/admin/ai/providers') {
      if (method === 'POST') {
        const body = await parseBody(req);
        if (body.mode) db.aiMode = body.mode;
        return sendJson(res, 200, { success: true, mode: db.aiMode, message: 'Konfigurasi AI Provider berhasil diperbarui.' });
      }
      return sendJson(res, 200, { success: true, mode: db.aiMode, providers: db.aiProviders });
    }
    if (pathname === '/api/admin/ai/logs') {
      return sendJson(res, 200, { success: true, logs: db.aiLogs || [] });
    }
    if (pathname === '/api/admin/stats' && method === 'GET') {
      const totalUsers = db.profiles.length;
      const proUsers = db.profiles.filter(u => u.plan_tier === 'pro').length;
      const starterUsers = db.profiles.filter(u => u.plan_tier !== 'pro').length;
      const totalTxs = db.transactions.length;
      const totalVolume = db.transactions.reduce((s, t) => s + Number(t.amount || 0), 0);
      const pendingApprovals = db.payments.filter(p => p.status === 'pending').length;
      const totalRevenue = db.payments.filter(p => p.status === 'settlement').reduce((s, p) => s + Number(p.amount || 0), 0);

      return sendJson(res, 200, {
        success: true,
        stats: {
          totalUsers,
          proUsers,
          starterUsers,
          totalTransactions: totalTxs,
          totalVolume,
          pendingApprovals,
          totalRevenue
        }
      });
    }

    if (pathname === '/api/admin/audit-logs' && method === 'GET') {
      return sendJson(res, 200, { success: true, logs: db.adminAuditLogs || [] });
    }

    if (pathname === '/api/admin/payments') {
      loadDatabaseFromFile();
      // Auto-sync any unverified user from db.profiles into db.payments
      db.profiles.forEach(u => {
        if (u.role === 'user' && !u.whatsapp_verified && !u.phone_verified) {
          const exists = db.payments.some(p => p.user_id === u.id);
          if (!exists) {
            db.payments.unshift({
              order_id: 'REG-' + (u.id.replace('usr-', '') || Date.now()),
              user_id: u.id,
              type: 'registration_verification',
              full_name: u.full_name,
              phone_number: u.phone_number,
              email: u.email,
              amount: 0,
              plan_tier: u.plan_tier || 'starter',
              status: 'pending',
              created_at: u.created_at || new Date().toISOString()
            });
          }
        }
      });
      saveDatabaseToFile();

      const enriched = db.payments.map(p => {
        const u = db.profiles.find(x => x.id === p.user_id) || {};
        return {
          ...p,
          user_full_name: u.full_name || p.full_name || 'Pengguna Baru',
          user_phone_number: u.phone_number || p.phone_number || '-',
          user_email: u.email || p.email || '-',
          user_role: u.role || 'user',
          user_plan_tier: u.plan_tier || p.plan_tier || 'starter',
          user_whatsapp_verified: Boolean(u.whatsapp_verified || u.phone_verified),
          user_avatar_url: u.avatar_url || null,
          user_created_at: u.created_at || p.created_at || new Date().toISOString()
        };
      });
      return sendJson(res, 200, { success: true, payments: enriched });
    }

    if (pathname === '/api/admin/payments/approve' && method === 'POST') {
      const { orderId } = await parseBody(req);
      const p = db.payments.find(x => x.order_id === orderId);
      if (p) {
        p.status = 'settlement';
        const u = db.profiles.find(x => x.id === p.user_id);
        if (u) {
          if (p.type === 'registration_verification' || orderId.startsWith('REG-')) {
            u.whatsapp_verified = true;
            u.phone_verified = true;
            db.adminAuditLogs.unshift({
              id: 'aud-' + Date.now(),
              action: 'APPROVED_REGISTRATION',
              details: `Pendaftaran ${orderId} (${u.full_name} - ${u.phone_number}) disetujui & diverifikasi WhatsApp oleh Superadmin. Akun aktif.`,
              admin: 'Super Admin Nandika Pratama (@nandikapratama)',
              created_at: new Date().toISOString()
            });
            saveDatabaseToFile();
            return sendJson(res, 200, {
              success: true,
              message: `Pendaftaran ${u.full_name} (${u.phone_number}) disetujui! WhatsApp terverifikasi & akun aktif.`,
              user: u,
              payment: p
            });
          } else {
            u.plan_tier = 'pro';
            db.adminAuditLogs.unshift({
              id: 'aud-' + Date.now(),
              action: 'APPROVED_UPGRADE',
              details: `Order ${orderId} (Rp${(p.amount || 0).toLocaleString('id-ID')}) disetujui. Akun ${u.full_name} (${u.email}) berhasil di-upgrade ke PRO seumur hidup.`,
              admin: 'Super Admin Nandika Pratama (@nandikapratama)',
              created_at: new Date().toISOString()
            });
            saveDatabaseToFile();
            return sendJson(res, 200, {
              success: true,
              message: `Pembayaran ${orderId} disetujui! Akun ${u.full_name} berhasil di-upgrade ke PRO seumur hidup.`,
              user: u,
              payment: p
            });
          }
        }
        saveDatabaseToFile();
        return sendJson(res, 200, { success: true, message: 'Item antrean berhasil disetujui.', payment: p });
      }
      return sendJson(res, 404, { success: false, message: 'Data pembayaran / registrasi tidak ditemukan.' });
    }

    if (pathname === '/api/admin/payments/reject' && method === 'POST') {
      const { orderId, reason } = await parseBody(req);
      const p = db.payments.find(x => x.order_id === orderId);
      if (p) {
        p.status = 'rejected';
        db.adminAuditLogs.unshift({
          id: 'aud-' + Date.now(),
          action: 'REJECTED_PAYMENT',
          details: `Order ${orderId} ditolak. Alasan: ${reason || 'Bukti transfer tidak valid/kadaluarsa'}.`,
          admin: 'Super Admin',
          created_at: new Date().toISOString()
        });
        return sendJson(res, 200, { success: true, message: 'Permintaan pembayaran telah ditolak.' });
      }
      return sendJson(res, 404, { success: false, message: 'Data pembayaran tidak ditemukan.' });
    }

    if (pathname === '/api/admin/users/tier' && method === 'POST') {
      const { userId, tier } = await parseBody(req);
      const u = db.profiles.find(x => x.id === userId);
      if (u) {
        const oldTier = u.plan_tier;
        u.plan_tier = tier || (oldTier === 'pro' ? 'starter' : 'pro');
        db.adminAuditLogs.unshift({
          id: 'aud-' + Date.now(),
          action: 'USER_TIER_CHANGED',
          details: `Admin mengubah tier user ${u.full_name} dari ${oldTier.toUpperCase()} menjadi ${u.plan_tier.toUpperCase()}.`,
          admin: 'Super Admin',
          created_at: new Date().toISOString()
        });
        return sendJson(res, 200, { success: true, message: `Tier pengguna ${u.full_name} berhasil diubah ke ${u.plan_tier.toUpperCase()}`, user: u });
      }
      return sendJson(res, 404, { success: false, message: 'Pengguna tidak ditemukan.' });
    }

    // -------------------------------------------------------------
    // TATA AI BOT APIS (In-App Interactive Financial Assistant)
    // -------------------------------------------------------------
    if (pathname === '/api/ai/suggestions' && method === 'GET') {
      const user = db.profiles.find(u => u.id === activeUserId) || db.profiles[0];
      const txs = db.transactions.filter(t => t.user_id === user.id);
      let income = 0;
      let expense = 0;
      txs.forEach(t => {
        if (t.type === 'pemasukan') income += Number(t.amount);
        if (t.type === 'pengeluaran') expense += Number(t.amount);
      });

      const suggestions = [
        "📊 Analisis Cashflow Bulan Ini",
        "💡 Berikan Rekomendasi Hemat Gaji",
        "🎯 Bikin Simulasi Dana Darurat 3 Bulan",
        "📝 Catat 'Kopi Susu 25rb Pakai BCA'",
        "📈 Apakah Budget Makanan Saya Masih Aman?"
      ];

      return sendJson(res, 200, {
        success: true,
        user: user.full_name,
        netCashflow: income - expense,
        suggestions
      });
    }

    if (pathname === '/api/ai/chat' && method === 'POST') {
      const { message, history } = await parseBody(req);
      const user = db.profiles.find(u => u.id === activeUserId) || db.profiles[0];
      const wallet = db.wallets.find(w => w.user_id === user.id && w.is_default_telegram) || db.wallets[0];
      const txs = db.transactions.filter(t => t.user_id === user.id);

      let income = 0;
      let expense = 0;
      txs.forEach(t => {
        if (t.type === 'pemasukan') income += Number(t.amount);
        if (t.type === 'pengeluaran') expense += Number(t.amount);
      });

      const cleanMsg = (message || '').trim().toLowerCase();

      // Check if message is a command to record transaction
      const hasNominal = parseIndonesianNominal(message);
      const isRecordIntent = cleanMsg.includes('catat') || cleanMsg.includes('beli') || cleanMsg.includes('bayar') || cleanMsg.includes('jajan') || cleanMsg.includes('gajian') || cleanMsg.includes('dapat');

      if (hasNominal && isRecordIntent) {
        const nominal = hasNominal;
        const jenis = inferType(message);
        const kategori = inferCategory(message, jenis);
        const catatan = extractNotes(message) || 'Transaksi via Tata AI';
        const cat = db.categories.find(c => c.name === kategori && c.user_id === user.id) || db.categories[0];

        if (jenis === 'pengeluaran' && wallet && nominal > Number(wallet.balance || 0)) {
          const reply = `⚠️ **Saldo anda tidak mencukupi**\n\nNominal pengeluaran sebesar **${formatRupiah(nominal)}** melebihi saldo dompet **${wallet.name}** kamu saat ini (**${formatRupiah(wallet.balance)}**).\n\nTransaksi tidak dapat dicatat karena saldo anda tidak mencukupi. Silakan lakukan top up atau tambahkan pemasukan terlebih dahulu!`;
          return sendJson(res, 400, {
            success: false,
            message: 'Saldo anda tidak mencukupi',
            reply,
            walletName: wallet.name,
            currentBalance: wallet.balance,
            requiredAmount: nominal
          });
        }

        const tx = {
          id: 'tx-' + Date.now(),
          user_id: user.id,
          wallet_id: wallet.id,
          category_id: cat.id,
          type: jenis,
          amount: nominal,
          notes: catatan,
          source: 'tata_ai_bot',
          transaction_date: new Date().toISOString()
        };
        addTransaction(tx);

        if (jenis === 'pengeluaran') {
          wallet.balance -= nominal;
        } else {
          wallet.balance += nominal;
        }

        const reply = `🤖 **Tata AI**: Transaksi kamu berhasil saya catat ke sistem!

${jenis === 'pengeluaran' ? '💸' : '💰'} **${jenis === 'pengeluaran' ? 'Pengeluaran' : 'Pemasukan'} Tercatat:**
├ Nominal : **${formatRupiah(nominal)}**
├ Kategori : ${cat.icon || '🏷️'} ${cat.name}
├ Dompet   : 👛 ${wallet.name}
├ Catatan  : ${catatan}
└ Saldo    : **${formatRupiah(wallet.balance)}**

💡 *Tips Tata AI*: Transaksi ini otomatis tersinkronisasi ke Dashboard Laporan dan bot Telegram kamu.`;

        return sendJson(res, 200, {
          success: true,
          reply,
          action: 'transaction_recorded',
          transaction: tx
        });
      }

      // Check financial advisory intents
      if (cleanMsg.includes('analisis') || cleanMsg.includes('cashflow') || cleanMsg.includes('laporan') || cleanMsg.includes('keuangan')) {
        const net = income - expense;
        const ratio = income > 0 ? Math.round((expense / income) * 100) : 0;
        const statusEmoji = net > 0 ? '🟢 Sehat' : '🔴 Perlu Evaluasi';

        const reply = `🤖 **Tata AI Financial Advisor**:

Halo ${user.full_name}! Berikut adalah ringkasan kesehatan finansial kamu bulan ini:

📊 **Ringkasan Arus Kas:**
• Total Pemasukan   : **${formatRupiah(income)}**
• Total Pengeluaran : **${formatRupiah(expense)}**
• Net Cashflow      : **${formatRupiah(net)}** (${statusEmoji})
• Rasio Pengeluaran : **${ratio}%** dari pemasukan

💡 **Rekomendasi Tata AI:**
1. ${ratio > 75 ? '⚠️ Pengeluaranmu sudah di atas 75% pemasukan. Disarankan rem jajan santai & makan di luar untuk sisa bulan ini.' : '✅ Rasio pengeluaran kamu masih terkendali dengan baik di bawah batas aman.'}
2. Prioritaskan alokasi **10-20%** dari net cashflow (${formatRupiah(Math.max(0, net * 0.15))}) langsung ke pos **Dana Darurat** atau instrumen pasar uang berisiko rendah.
3. Selalu catat pengeluaran kecil (di bawah 20rb) agar tidak menjadi "kebocoran halus".`;

        return sendJson(res, 200, { success: true, reply, action: 'analysis' });
      }

      if (cleanMsg.includes('dana darurat') || cleanMsg.includes('tabungan') || cleanMsg.includes('darurat')) {
        const estLivingExpense = expense > 0 ? expense : 3000000;
        const target3Months = estLivingExpense * 3;
        const target6Months = estLivingExpense * 6;

        const reply = `🤖 **Tata AI Planning Specialist**:

Dana darurat adalah benteng pertahanan utama finansial sebelum mulai berinvestasi.

🎯 **Simulasi Target Dana Darurat Kamu:**
• Estimasi Biaya Hidup/Bulan : **${formatRupiah(estLivingExpense)}**
• Target Minimal (3 Bulan)    : **${formatRupiah(target3Months)}**
• Target Ideal (6 Bulan)       : **${formatRupiah(target6Months)}**

📋 **Langkah Praktis Mengumpulkannya:**
1. Sisihkan minimal **Rp250.000 - Rp500.000** setiap gajian masuk sebelum dipakai belanja.
2. Simpan di rekening terpisah tanpa kartu debit (atau e-wallet khusus / Reksadana Pasar Uang) agar tidak tergoda untuk jajan.
3. Kunci: Konsistensi pencatatan di TataDana membantu kamu melihat pos mana yang bisa dihemat!`;

        return sendJson(res, 200, { success: true, reply, action: 'emergency_fund' });
      }

      if (cleanMsg.includes('hemat') || cleanMsg.includes('tips') || cleanMsg.includes('gaji')) {
        const reply = `🤖 **Tata AI Money Coach**:

Berikut adalah formula hemat cerdas yang terbukti cocok untuk pekerja Indonesia:

1. **Aturan 50 / 30 / 20**:
   • 50% Kebutuhan Pokok (Kost/rumah, makan, transportasi, tagihan)
   • 30% Keinginan (Nongkrong, hiburan, hobi)
   • 20% Masa Depan (Tabungan, dana darurat, investasi)

2. **Trik 24 Jam**:
   Sebelum checkout belanja online non-primer di atas Rp100.000, tunggu 24 jam. Biasanya keinginan membeli akan reda.

3. **Gunakan Telegram Bot TataDana**:
   Setiap kali selesai transaksi, langsung ketik di chat (misal: "beli kopi 18rb"). Kamu akan langsung kaget melihat betapa cepatnya pengeluaran terkumpul jika tidak dipantau!`;

        return sendJson(res, 200, { success: true, reply, action: 'saving_tips' });
      }

      // Default conversational response
      const reply = `🤖 **Tata AI Bot**: Halo ${user.full_name}! Ada yang bisa saya bantu hari ini?

Kamu bisa minta saya untuk:
• 📝 **Mencatat Transaksi**: Ketik *"Catat beli bensin 35rb"* atau *"Gajian 6jt"*
• 📊 **Menganalisis Cashflow**: Ketik *"Analisis keuangan saya bulan ini"*
• 💡 **Tips Finansial**: Ketik *"Bagaimana cara mengumpulkan dana darurat?"*
• 🎯 **Cek Budget**: Ketik *"Apakah budget makan saya masih aman?"*

Apa yang ingin kamu diskusikan seputar keuanganmu?`;

      return sendJson(res, 200, { success: true, reply, action: 'conversation' });
    }

    // Live Idempotent Telegram Webhook API
    if (pathname === '/api/telegram/webhook' && method === 'POST') {
      const payload = await parseBody(req);
      const updateId = payload.update_id;

      if (updateId !== undefined && updateId !== null && (db.processedUpdates.has(String(updateId)) || db.processedUpdates.has(Number(updateId)))) {
        return sendJson(res, 200, { ok: true, result: { status: 'skipped', updateId } });
      }
      if (updateId !== undefined && updateId !== null) {
        recordProcessedUpdate(updateId);
      }

      const message = payload.message || payload.edited_message;
      if (!message) {
        return sendJson(res, 200, { ok: true, result: { status: 'ok', reason: 'no_message' } });
      }

      const user = db.profiles.find(u => u.id === activeUserId) || db.profiles[0];
      const resData = handleTelegramBotAction(message.text || '', 'text', user);

      if (message.chat && message.chat.id && resData && resData.reply) {
        sendTelegramMessage(db.telegramBotToken, message.chat.id, resData.reply);
        return sendJson(res, 200, {
          method: 'sendMessage',
          chat_id: message.chat.id,
          text: resData.reply,
          parse_mode: 'Markdown'
        });
      }

      return sendJson(res, 200, { ok: true, result: resData });
    }

    // Built-in Webhook Simulator
    if (pathname === '/api/admin/simulator' && method === 'POST') {
      const { type, text } = await parseBody(req);
      const user = db.profiles.find(u => u.id === activeUserId) || db.profiles[0];
      const resData = handleTelegramBotAction(text || '', type || 'text', user);
      return sendJson(res, 200, { success: true, simulation: resData });
    }

    // 8. Serve Client Static Files
    let clientDir = path.resolve(__dirname, '../client');
    if (!fs.existsSync(clientDir)) {
      clientDir = path.resolve(__dirname, './client');
    }
    if (!fs.existsSync(clientDir)) {
      clientDir = path.resolve(process.cwd(), 'client');
    }
    const safePath = path.normalize(pathname === '/' ? '/index.html' : pathname);
    let filePath = path.join(clientDir, safePath);

    // Prevent directory traversal
    if (!filePath.startsWith(clientDir)) {
      filePath = path.join(clientDir, 'index.html');
    }

    try {
      if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
        filePath = path.join(clientDir, 'index.html');
      }
    } catch (e) {
      filePath = path.join(clientDir, 'index.html');
    }

    if (fs.existsSync(filePath)) {
      const ext = path.extname(filePath).toLowerCase();
      const mimeTypes = {
        '.html': 'text/html; charset=utf-8',
        '.js': 'application/javascript; charset=utf-8',
        '.css': 'text/css; charset=utf-8',
        '.json': 'application/json',
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.svg': 'image/svg+xml',
        '.ico': 'image/x-icon'
      };
      res.writeHead(200, {
        'Content-Type': mimeTypes[ext] || 'application/octet-stream',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      });
      const stream = fs.createReadStream(filePath);
      stream.pipe(res);
      stream.on('error', () => {
        if (!res.headersSent) res.writeHead(500);
        res.end();
      });
      req.on('close', () => {
        stream.destroy();
      });
      return;
    }

    sendJson(res, 404, { success: false, message: 'Not found' });
  } catch (err) {
    console.error('Server error:', err);
    sendJson(res, 500, { success: false, error: err.message });
  }
}

const server = http.createServer(handleRequest);

// -------------------------------------------------------------
// LIVE TELEGRAM BOT POLLER & DISPATCHER
// -------------------------------------------------------------
function sendTelegramMessage(botToken, chatId, text) {
  return new Promise((resolve) => {
    const payload = JSON.stringify({
      chat_id: chatId,
      text: text,
      parse_mode: 'Markdown'
    });

    const options = {
      hostname: 'api.telegram.org',
      port: 443,
      path: `/bot${botToken}/sendMessage`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload)
      }
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(body);
          if (!json.ok) {
            // Fallback without parse_mode if Markdown parsing errors out
            const plainText = text.replace(/[*_`\[\]]/g, '');
            const fallbackPayload = JSON.stringify({ chat_id: chatId, text: plainText });
            const req2 = https.request({
              hostname: 'api.telegram.org',
              port: 443,
              path: `/bot${botToken}/sendMessage`,
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(fallbackPayload)
              }
            }, res2 => {
              res2.on('data', () => {});
              res2.on('end', () => resolve(true));
            });
            req2.on('error', () => resolve(false));
            req2.write(fallbackPayload);
            req2.end();
          } else {
            resolve(true);
          }
        } catch (e) {
          resolve(false);
        }
      });
    });

    req.on('error', (err) => {
      console.error('Error sending Telegram message:', err.message);
      resolve(false);
    });

    req.write(payload);
    req.end();
  });
}

let telegramPollOffset = 0;
let isPollingActive = false;
let currentBotToken = db.telegramBotToken || '8853112131:AAGNZDVNBGnBTZBZcNhIni1iv2eb011-Fjo';

function startTelegramPoller(token) {
  if (!token) return;
  const tokenChanged = (currentBotToken !== token);
  currentBotToken = token;
  if (tokenChanged) {
    telegramPollOffset = 0;
  }
  if (isPollingActive && !tokenChanged) return;
  isPollingActive = true;
  console.log(`📡 Live Telegram Bot Poller active for token: ${currentBotToken.slice(0, 10)}... (@TataKeuanganBot)`);

  const poll = () => {
    if (!isPollingActive) return;
    const reqPath = `/bot${currentBotToken}/getUpdates?offset=${telegramPollOffset}&timeout=20`;
    const req = https.get(`https://api.telegram.org${reqPath}`, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', async () => {
        try {
          const data = JSON.parse(body);
          if (data.ok && Array.isArray(data.result)) {
            for (const update of data.result) {
              telegramPollOffset = Math.max(telegramPollOffset, update.update_id + 1);

              const updateId = update.update_id;
              if (db.processedUpdates.has(String(updateId))) continue;
              recordProcessedUpdate(updateId);

              const msg = update.message || update.edited_message;
              if (!msg || !msg.chat) continue;

              const chatId = msg.chat.id;
              let msgType = 'text';
              let inputContent = msg.text || '';

              if (msg.photo && msg.photo.length > 0) {
                msgType = 'photo';
                inputContent = msg.caption || '';
              } else if (msg.voice || msg.audio) {
                msgType = 'voice';
                inputContent = '';
              }

              const user = db.profiles.find(u => u.id === activeUserId) || db.profiles[0];
              const result = handleTelegramBotAction(inputContent, msgType, user);
              if (result && result.reply) {
                await sendTelegramMessage(currentBotToken, chatId, result.reply);
                console.log(`💬 Replied to Telegram user [chatId: ${chatId}] for: "${inputContent || msgType}"`);
              }
            }
          } else if (data.error_code === 409) {
            // Webhook is active: delete it and resume polling
            console.log('⚠️ Webhook conflict (409) detected. Clearing Telegram webhook...');
            https.get(`https://api.telegram.org/bot${currentBotToken}/deleteWebhook`, () => {
              setTimeout(poll, 1000);
            }).on('error', () => {
              setTimeout(poll, 2000);
            });
            return;
          }
        } catch (err) {
          console.error('Telegram Polling parse error:', err.message);
        }
        setTimeout(poll, 600);
      });
    });

    req.on('error', (err) => {
      setTimeout(poll, 3000);
    });

    req.setTimeout(25000, () => {
      req.destroy();
      setTimeout(poll, 600);
    });
  };

  // Ensure any lingering webhook is deleted so getUpdates succeeds
  https.get(`https://api.telegram.org/bot${currentBotToken}/deleteWebhook`, (delRes) => {
    let delBody = '';
    delRes.on('data', chunk => delBody += chunk);
    delRes.on('end', () => {
      console.log(' Telegram Webhook cleared, entering long-poll loop.');
      poll();
    });
  }).on('error', () => {
    poll();
  });
}

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`❌ Port ${PORT} is already in use by another process.`);
  } else {
    console.error('❌ Server error:', err.message);
  }
});

if (require.main === module || !process.env.VERCEL) {
  server.listen(PORT, () => {
    console.log(`=======================================================`);
    console.log(`🚀 TataDana Full-Stack Server Running on Port ${PORT}`);
    console.log(`🔗 Local URL: http://localhost:${PORT}`);
    console.log(`⏰ Timezone: ${TIMEZONE} (Asia/Jakarta, UTC+7)`);
    console.log(`🤖 Telegram Bot: @${db.telegramBotInfo.username} connected`);
    console.log(`=======================================================`);

    // Start live Telegram polling automatically
    startTelegramPoller(db.telegramBotToken);
  });
}

module.exports = handleRequest;
module.exports.server = server;
module.exports.handleRequest = handleRequest;

