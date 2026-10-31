// server/telegram/replies.js
// Precision Telegram Bot Message Formatter for TataDana
// Generates official formatted text matching Part 4.4 & 4.5 specifications

const { formatWIBFull, formatRupiah } = require('../utils/wib');

/**
 * Generate visual progress bar using monospace characters: █ and ░
 * Total length: 10 blocks
 */
function generateProgressBar(percentage) {
  const clamped = Math.max(0, Math.min(100, Math.round(percentage)));
  const filledBlocks = Math.round((clamped / 100) * 10);
  const emptyBlocks = 10 - filledBlocks;
  return '█'.repeat(filledBlocks) + '░'.repeat(emptyBlocks);
}

/**
 * Format Expense Reply (Part 4.4)
 */
function formatExpenseReply({
  date = new Date(),
  amount,
  categoryName = 'Pengeluaran Umum',
  categoryIcon = '🏷️',
  walletName = 'BCA Tabungan',
  notes = '-',
  currentBalance = 0,
  categoryBudget = 1500000,
  categorySpent = 0,
  voiceTranscript = null
}) {
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

  // Budget progress calculation
  if (categoryBudget > 0) {
    const totalSpent = categorySpent;
    const pct = Math.round((totalSpent / categoryBudget) * 100);
    const sisa = Math.max(0, categoryBudget - totalSpent);
    const progressBar = generateProgressBar(pct);

    output += `📊 Budget ${categoryName} bulan ini:\n`;
    output += `${progressBar} ${pct}% — sisa ${formatRupiah(sisa)}\n`;

    if (pct >= 100) {
      output += `⚠️ Perhatian: Budget ${categoryName} bulan ini sudah HABIS! Tetap kendalikan pengeluaranmu ya.`;
    } else if (pct >= 80) {
      output += `⚠️ Waspada: Budget ${categoryName} sudah mencapai ${pct}%. Rem sedikit yuk!`;
    } else {
      output += `Tetap hemat dan rencanakan pengeluaranmu dengan bijak!`;
    }
  }

  return output;
}

/**
 * Format Income Reply (Part 4.5)
 */
function formatIncomeReply({
  date = new Date(),
  amount,
  walletName = 'BCA Tabungan',
  currentBalance = 0,
  categoryName = 'Pemasukan',
  categoryIcon = '💼',
  notes = '',
  voiceTranscript = null
}) {
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

/**
 * Format Error Reply with Help Guide
 */
function formatErrorReply(errorMessage, rawInput = '') {
  return `❌ Maaf, pesan tidak dapat diproses:
${errorMessage}

💡 Contoh format pencatatan yang benar:
• "beli bakso 15rb" (Pengeluaran)
• "gajian 5jt" (Pemasukan)
• "bensin 25k pakai cash" (Pengeluaran)
• "bayar listrik 250.000" (Pengeluaran)`;
}

module.exports = {
  generateProgressBar,
  formatExpenseReply,
  formatIncomeReply,
  formatErrorReply
};
