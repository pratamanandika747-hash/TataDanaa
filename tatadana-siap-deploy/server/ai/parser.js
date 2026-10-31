// server/ai/parser.js
// Advanced Indonesian Natural Language Financial Transaction Parser
// Translates conversational Indonesian text into structured financial records:
// { jenis: 'pengeluaran' | 'pemasukan', nominal: number, kategori: string, catatan: string }

/**
 * Parse Indonesian currency string variations into integer number:
 * - "15rb", "15ribu" -> 15000
 * - "500k" -> 500000
 * - "1.5jt", "1,5jt", "1.5juta" -> 1500000
 * - "2.5jt", "2,5jt" -> 2500000
 * - "150.000", "150000" -> 150000
 * - "5jt" -> 5000000
 */
function parseIndonesianNominal(text) {
  if (!text) return null;
  const clean = text.toLowerCase().trim();

  // Pattern: "10miliar", "1.5 miliar", "1milyar"
  const miliarMatch = clean.match(/(\d+(?:[.,]\d+)?)\s*(?:miliar|milyar)\b/i);
  if (miliarMatch) {
    const num = parseFloat(miliarMatch[1].replace(',', '.'));
    return Math.round(num * 1000000000);
  }

  // Pattern: "1.5 jt" or "1,5jt" or "2jt" or "2 juta"
  const jtMatch = clean.match(/(\d+(?:[.,]\d+)?)\s*(?:jt|juta|mio)\b/i);
  if (jtMatch) {
    const num = parseFloat(jtMatch[1].replace(',', '.'));
    return Math.round(num * 1000000);
  }

  // Pattern: "15rb", "15 ribu", "500k", "500 k"
  const rbMatch = clean.match(/(\d+(?:[.,]\d+)?)\s*(?:rb|ribu|k)\b/i);
  if (rbMatch) {
    const num = parseFloat(rbMatch[1].replace(',', '.'));
    return Math.round(num * 1000);
  }

  // Pattern: standard Indonesian currency format e.g. "Rp 150.000" or "150.000"
  const numMatch = clean.match(/(?:rp\.?\s*)?(\d{1,3}(?:\.\d{3})+(?:,\d+)?)/i);
  if (numMatch) {
    const numStr = numMatch[1].replace(/\./g, '').replace(',', '.');
    return Math.round(parseFloat(numStr));
  }

  // Plain integers e.g. "25000"
  const plainMatch = clean.match(/(?:rp\.?\s*)?(\d{4,12})/i);
  if (plainMatch) {
    return parseInt(plainMatch[1], 10);
  }

  return null;
}

/**
 * Infer category from Indonesian keywords
 */
function inferCategory(text, type = 'pengeluaran') {
  const t = text.toLowerCase();
  if (type === 'pemasukan') {
    if (t.includes('gaji') || t.includes('payroll') || t.includes('salary')) return 'Gaji & Pendapatan';
    if (t.includes('bonus') || t.includes('freelance') || t.includes('proyek') || t.includes('klien') || t.includes('dividen')) return 'Bonus & Freelance';
    return 'Pemasukan Lainnya';
  }

  // Expense categories
  if (t.match(/makan|minum|kopi|bakso|sate|nasi|warteg|resto|kafe|snack|jajan|es teh|ayam|mie|roti|boba/i)) {
    return 'Makanan & Minuman';
  }
  if (t.match(/bensin|pertalite|pertamax|parkir|toll|tol|ojol|gojek|grab|kereta|krl|mrt|bus|angkot|service|cuci motor|cuci mobil/i)) {
    return 'Transportasi';
  }
  if (t.match(/listrik|pln|pdam|air|wifi|indihome|pulsa|paket data|kontrakan|kost|sewa|tagihan|bpjs/i)) {
    return 'Tagihan & Utilitas';
  }
  if (t.match(/belanja|baju|sepatu|supermarket|indomaret|alfamart|shopee|tokopedia|skincare|sabun/i)) {
    return 'Belanja Kebutuhan';
  }
  if (t.match(/hiburan|nonton|bioskop|game|steam|netflix|spotify|liburan|karaoke/i)) {
    return 'Hiburan & Hobi';
  }
  if (t.match(/obat|dokter|klinik|apotek|vitamin|rs|sakit/i)) {
    return 'Kesehatan';
  }
  if (t.match(/buku|kursus|kuliah|spp|les|seminar|sekolah/i)) {
    return 'Pendidikan & Buku';
  }

  return 'Lain-lain';
}

/**
 * Determine whether transaction is income or expense
 */
function inferType(text) {
  const t = text.toLowerCase();
  const incomeKeywords = ['gaji', 'gajian', 'pemasukan', 'transferan masuk', 'dapat transfer', 'bonus', 'hasil jual', 'cair', 'pendapatan', 'infaq masuk', 'profit', 'untung'];
  for (const kw of incomeKeywords) {
    if (t.includes(kw)) return 'pemasukan';
  }
  return 'pengeluaran';
}

/**
 * Extract clean description/notes from text
 */
function extractNotes(text) {
  // Strip out currency terms to leave meaningful description
  let cleaned = text
    .replace(/(?:rp\.?\s*)?\d+(?:[.,]\d+)?\s*(?:miliar|milyar|jt|juta|mio|rb|ribu|k)\b/gi, '')
    .replace(/(?:rp\.?\s*)?\d{1,3}(?:\.\d{3})+(?:,\d+)?/gi, '')
    .replace(/(?:rp\.?\s*)?\d{4,12}/gi, '')
    .replace(/\b(?:beli|bayar|buat|untuk|dapat|terima|uang|habis)\b/gi, '')
    .trim();

  cleaned = cleaned.replace(/\s+/g, ' ').trim();
  if (!cleaned) return text.trim();
  // Capitalize first letter
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
}

/**
 * Main parseTransactionText function
 * Combines AI LLM structured parsing when online or advanced deterministic parsing
 */
async function parseTransactionText(text, aiEngine = null) {
  if (!text || typeof text !== 'string') {
    return {
      success: false,
      error: 'Pesan teks tidak boleh kosong.'
    };
  }

  const rawText = text.trim();

  // Try AI engine if provided and configured
  if (aiEngine && typeof aiEngine.parseWithLLM === 'function') {
    try {
      const aiResult = await aiEngine.parseWithLLM(rawText);
      if (aiResult && aiResult.success && aiResult.data && aiResult.data.nominal > 0) {
        return {
          success: true,
          provider: aiResult.provider || 'gemini',
          data: aiResult.data
        };
      }
    } catch (err) {
      console.warn('[AI Parser] LLM fallback to deterministic engine:', err.message);
    }
  }

  // Deterministic Indonesian parsing
  const nominal = parseIndonesianNominal(rawText);
  if (!nominal || nominal <= 0) {
    return {
      success: false,
      error: 'Nominal transaksi tidak terdeteksi. Contoh format: "beli bakso 15rb" atau "gajian 5jt".',
      rawText
    };
  }

  const jenis = inferType(rawText);
  const kategori = inferCategory(rawText, jenis);
  const catatan = extractNotes(rawText);

  return {
    success: true,
    provider: 'local_id_engine',
    data: {
      jenis,
      nominal,
      kategori,
      catatan
    }
  };
}

module.exports = {
  parseIndonesianNominal,
  inferCategory,
  inferType,
  extractNotes,
  parseTransactionText
};
