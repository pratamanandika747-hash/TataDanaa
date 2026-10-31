/**
 * Indonesian Natural Language & Currency Parser for TataDana
 * Parses Indonesian chat messages into structured transaction data:
 * { jenis: 'pengeluaran'|'pemasukan', nominal: number, kategori: string, catatan: string }
 */

// Spelled-out words in Indonesian
const NUMBER_WORDS = {
  nol: 0,
  satu: 1,
  se: 1, // as in seribu, seratus, sepuluh
  dua: 2,
  tiga: 3,
  empat: 4,
  lima: 5,
  enam: 6,
  tujuh: 7,
  delapan: 8,
  sembilan: 9,
  sepuluh: 10,
  sebelas: 11,
  belas: 10,
  puluh: 10,
  ratus: 100,
  ribu: 1000,
  juta: 1000000,
  miliar: 1000000000,
  milyar: 1000000000
};

// Category keywords mapping
const CATEGORY_RULES = [
  {
    kategori: 'Makanan & Minuman',
    type: 'pengeluaran',
    keywords: ['makan', 'minum', 'kopi', 'bakso', 'mie', 'nasi', 'nasgor', 'ayam', 'sate', 'cafe', 'kafe', 'restoran', 'snack', 'jajan', 'warteg', 'boba', 'tea', 'sarapan', 'lunch', 'dinner', 'burger', 'pizza', 'soto']
  },
  {
    kategori: 'Transportasi & Bensin',
    type: 'pengeluaran',
    keywords: ['bensin', 'pertalite', 'pertamax', 'solar', 'parkir', 'ojol', 'grab', 'gojek', 'maxim', 'toll', 'tol', 'kereta', 'krl', 'mrt', 'lrt', 'busway', 'taksi', 'angkot', 'service motor', 'cuci mobil']
  },
  {
    kategori: 'Belanja Kebutuhan',
    type: 'pengeluaran',
    keywords: ['supermarket', 'indomaret', 'alfamart', 'belanja', 'sabun', 'shampo', 'beras', 'minyak', 'pasar', 'sayur', 'telur', 'shopee', 'tokopedia', 'lazada', 'tisu', 'laundry']
  },
  {
    kategori: 'Tagihan & Utilitas',
    type: 'pengeluaran',
    keywords: ['listrik', 'pln', 'air', 'pdam', 'wifi', 'internet', 'indihome', 'biznet', 'pulsa', 'kuota', 'sewa kost', 'kontrakan', 'iuran', 'bpjs', 'pbb', 'cicilan', 'kartu kredit']
  },
  {
    kategori: 'Hiburan & Hobi',
    type: 'pengeluaran',
    keywords: ['nonton', 'bioskop', 'xxi', 'cgv', 'game', 'steam', 'playstation', 'netflix', 'spotify', 'karaoke', 'buku', 'komik', 'liburan', 'staycation', 'tiket']
  },
  {
    kategori: 'Kesehatan & Medis',
    type: 'pengeluaran',
    keywords: ['obat', 'dokter', 'apotek', 'kimia farma', 'k24', 'vitamin', 'klinik', 'rumah sakit', 'periksa', 'tes darah', 'masker']
  },
  {
    kategori: 'Gaji & Pendapatan',
    type: 'pemasukan',
    keywords: ['gaji', 'gajian', 'payroll', 'salary', 'upah', 'honor']
  },
  {
    kategori: 'Bonus & Freelance',
    type: 'pemasukan',
    keywords: ['bonus', 'freelance', 'proyek', 'komisi', 'side hustle', 'tips', 'thr', 'hadiah', 'cashback', 'jual', 'penjualan']
  },
  {
    kategori: 'Investasi & Dividen',
    type: 'pemasukan',
    keywords: ['dividen', 'reksadana', 'saham', 'crypto', 'profit', 'bunga', 'deposito', 'imbal hasil']
  }
];

const INCOME_TRIGGERS = [
  'gaji', 'gajian', 'terima', 'dapat', 'masuk', 'pendapatan', 'bonus', 'transfer masuk',
  'inflow', 'untung', 'jual', 'laku', 'cashback', 'refund', 'dividen', 'thr', 'dikasih'
];

/**
 * Extracts numeric amount from various Indonesian notations:
 * Examples:
 * - "15rb" -> 15000
 * - "15.000" / "15000" -> 15000
 * - "35k" -> 35000
 * - "5jt" / "5 juta" -> 5000000
 * - "1.5jt" / "1,5jt" -> 1500000
 * - "Rp 250.000" -> 250000
 * - "500rb" -> 500000
 * @param {string} text
 * @returns {{ amount: number, rawMatch: string } | null}
 */
export function extractAmount(text) {
  if (!text || typeof text !== 'string') return null;
  const normalized = text.toLowerCase();

  // Pattern 1: Number with suffix (rb, k, jt, juta, ribu, m, milyar, miliar)
  // Handles 15rb, 15k, 1.5jt, 1,5 jt, 500ribu, 2.5k, etc.
  const suffixRegex = /(?:rp\.?\s*)?(\d+(?:[.,]\d+)?)\s*(k|rb|ribu|jt|juta|m|milyar|miliar)\b/i;
  const suffixMatch = normalized.match(suffixRegex);

  if (suffixMatch) {
    const rawNumStr = suffixMatch[1].replace(',', '.');
    const num = parseFloat(rawNumStr);
    const unit = suffixMatch[2].toLowerCase();

    let multiplier = 1000;
    if (unit === 'k' || unit === 'rb' || unit === 'ribu') {
      multiplier = 1000;
    } else if (unit === 'jt' || unit === 'juta') {
      multiplier = 1000000;
    } else if (unit === 'm' || unit === 'milyar' || unit === 'miliar') {
      multiplier = 1000000000;
    }

    const calculated = Math.round(num * multiplier);
    return { amount: calculated, rawMatch: suffixMatch[0] };
  }

  // Pattern 2: Standard formatted number with dots (e.g., Rp 250.000 or 1.500.000 or Rp250000)
  const dotFormattedRegex = /(?:rp\.?\s*)?(\d{1,3}(?:\.\d{3})+)(?!\d)/i;
  const dotMatch = normalized.match(dotFormattedRegex);

  if (dotMatch) {
    const cleanNum = dotMatch[1].replace(/\./g, '');
    const amount = parseInt(cleanNum, 10);
    return { amount, rawMatch: dotMatch[0] };
  }

  // Pattern 3: Explicit Rp prefix followed by plain digits (e.g., Rp 15000 or rp50000)
  const rpPlainRegex = /rp\.?\s*(\d{3,12})/i;
  const rpMatch = normalized.match(rpPlainRegex);

  if (rpMatch) {
    const amount = parseInt(rpMatch[1], 10);
    return { amount, rawMatch: rpMatch[0] };
  }

  // Pattern 4: Standalone number of at least 3 digits (e.g. 50000, 15000)
  const standaloneRegex = /\b(\d{3,10})\b/;
  const standaloneMatch = normalized.match(standaloneRegex);

  if (standaloneMatch) {
    const amount = parseInt(standaloneMatch[1], 10);
    return { amount, rawMatch: standaloneMatch[0] };
  }

  // Pattern 5: Spelled out numbers (e.g., "dua puluh lima ribu", "sepuluh ribu")
  const spelledResult = parseSpelledOutIndonesian(normalized);
  if (spelledResult) {
    return spelledResult;
  }

  return null;
}

/**
 * Parses spelled-out words in Indonesian
 * e.g. "dua puluh lima ribu" -> 25000
 * @param {string} text
 * @returns {{ amount: number, rawMatch: string } | null}
 */
function parseSpelledOutIndonesian(text) {
  // Support basic common combinations
  const phraseRegex = /(satu|dua|tiga|empat|lima|enam|tujuh|delapan|sembilan|sepuluh|sebelas|dua puluh|tiga puluh|empat puluh|lima puluh|enam puluh|tujuh puluh|delapan puluh|sembilan puluh|seratus|dua ratus|tiga ratus|empat ratus|lima ratus)?(?:\s+(?:belas|puluh))?(?:\s+(?:satu|dua|tiga|empat|lima|enam|tujuh|delapan|sembilan))?\s*(ribu|juta)/i;
  
  const match = text.match(phraseRegex);
  if (!match) return null;

  const phrase = match[0].trim();
  const words = phrase.toLowerCase().split(/\s+/);
  
  let current = 0;
  let total = 0;

  for (const w of words) {
    if (w === 'ribu') {
      current = current === 0 ? 1000 : current * 1000;
      total += current;
      current = 0;
    } else if (w === 'juta') {
      current = current === 0 ? 1000000 : current * 1000000;
      total += current;
      current = 0;
    } else if (w === 'seratus') {
      current += 100;
    } else if (w === 'sepuluh') {
      current += 10;
    } else if (w === 'sebelas') {
      current += 11;
    } else if (w === 'ratus') {
      current = (current % 10) * 100;
    } else if (w === 'puluh') {
      current = (current % 10) * 10;
    } else if (w === 'belas') {
      current = (current % 10) + 10;
    } else if (NUMBER_WORDS[w] !== undefined) {
      current += NUMBER_WORDS[w];
    }
  }

  total += current;
  if (total > 0) {
    return { amount: total, rawMatch: phrase };
  }

  return null;
}

/**
 * Main parser function: converts an Indonesian transaction message into structured data
 * @param {string} message
 * @returns {{
 *   success: boolean,
 *   jenis: 'pengeluaran' | 'pemasukan',
 *   nominal: number,
 *   kategori: string,
 *   catatan: string,
 *   rawText: string
 * }}
 */
export function parseIndonesianTransaction(message) {
  if (!message || typeof message !== 'string') {
    return {
      success: false,
      error: 'Pesan kosong'
    };
  }

  const cleanMessage = message.trim();
  const lowerMessage = cleanMessage.toLowerCase();

  // 1. Extract Amount
  const amountResult = extractAmount(cleanMessage);
  if (!amountResult || amountResult.amount <= 0) {
    return {
      success: false,
      error: 'Nominal tidak terdeteksi dalam pesan. Contoh: "kopi 25rb" atau "gajian 5jt"',
      rawText: cleanMessage
    };
  }

  const nominal = amountResult.amount;

  // 2. Determine Transaction Type (pemasukan vs pengeluaran)
  let jenis = 'pengeluaran'; // default
  for (const trigger of INCOME_TRIGGERS) {
    if (lowerMessage.includes(trigger)) {
      jenis = 'pemasukan';
      break;
    }
  }

  // 3. Determine Category based on keywords
  let kategori = jenis === 'pemasukan' ? 'Gaji & Pendapatan' : 'Lain-lain';
  for (const rule of CATEGORY_RULES) {
    for (const kw of rule.keywords) {
      // Word boundary or substring matching
      const regex = new RegExp(`\\b${kw}\\b`, 'i');
      if (regex.test(lowerMessage) || lowerMessage.includes(kw)) {
        kategori = rule.kategori;
        // Also refine type if category strongly indicates it
        if (rule.type === 'pemasukan') {
          jenis = 'pemasukan';
        }
        break;
      }
    }
  }

  // 4. Construct Clean Notes (Catatan)
  // Remove the matched amount string and unnecessary filler words
  let catatan = cleanMessage;
  if (amountResult.rawMatch) {
    catatan = catatan.replace(amountResult.rawMatch, '').trim();
  }

  // Remove leading/trailing symbols, prepositions
  catatan = catatan
    .replace(/^([,.\-:\s]+)/, '')
    .replace(/([,.\-:\s]+)$/, '')
    .trim();

  // If catatan became empty (e.g. user just sent "50rb"), assign category name
  if (!catatan) {
    catatan = kategori;
  }

  // Capitalize first letter of catatan
  catatan = catatan.charAt(0).toUpperCase() + catatan.slice(1);

  return {
    success: true,
    jenis,
    nominal,
    kategori,
    catatan,
    rawText: cleanMessage
  };
}

/**
 * Format integer rupiah to human readable IDR format
 * e.g., 25000 -> "Rp 25.000"
 * @param {number} amount
 * @returns {string}
 */
export function formatRupiah(amount) {
  if (typeof amount !== 'number' || isNaN(amount)) return 'Rp 0';
  return 'Rp ' + amount.toLocaleString('id-ID');
}
