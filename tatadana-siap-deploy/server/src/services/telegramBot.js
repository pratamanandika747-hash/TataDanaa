/**
 * Telegram Bot Service for TataDana
 * Handles message templates, visual budget progress bar (█ and ░),
 * account binding, and Telegram API interaction (getMe, setWebhook, sendMessage).
 */

import { formatRupiah } from './currencyParser.js';
import { formatWIBDate, getNowWIB } from '../utils/timezone.js';
import { inMemoryStore } from '../store/inMemoryStore.js';
import { config } from '../config/index.js';

export class TelegramBotService {
  /**
   * Render visual ASCII progress bar with █ and ░
   * e.g. renderProgressBar(65, 10) => "███████░░░"
   * @param {number} percentage
   * @param {number} totalBlocks
   * @returns {string}
   */
  renderProgressBar(percentage, totalBlocks = 10) {
    const clamped = Math.max(0, Math.min(100, Math.round(percentage)));
    const filledCount = Math.round((clamped / 100) * totalBlocks);
    const emptyCount = totalBlocks - filledCount;
    return '█'.repeat(filledCount) + '░'.repeat(emptyCount);
  }

  /**
   * Generate formatted Telegram confirmation message
   * @param {object} params
   * @returns {string}
   */
  formatTransactionReply({
    user,
    transaction,
    category,
    wallet,
    budget,
    budgetSpent,
    aiAdvice = null
  }) {
    const isIncome = transaction.type === 'pemasukan';
    const typeLabel = isIncome ? '🟢 Pemasukan Tercatat' : '🔴 Pengeluaran Tercatat';
    const formattedAmount = formatRupiah(transaction.amount);
    const dateWIB = formatWIBDate(transaction.date || getNowWIB(), true);
    const emoji = category?.icon_emoji || (isIncome ? '💰' : '📦');
    const categoryName = category?.name || 'Lain-lain';
    const walletName = wallet?.name || 'Dompet Utama';
    const currentBalance = formatRupiah(wallet?.balance || 0);

    let message = `*${typeLabel}* 🚀\n`;
    message += `━━━━━━━━━━━━━━━━━━\n`;
    message += `Nominal: *${formattedAmount}*\n`;
    message += `Kategori: ${emoji} *${categoryName}*\n`;
    message += `Dompet: 💳 *${walletName}* (Sisa: ${currentBalance})\n`;
    message += `Catatan: _${transaction.notes || '-' }_\n`;
    message += `Waktu: 🕒 ${dateWIB}\n`;

    // Multi-item receipt detail if exists
    if (transaction.items && transaction.items.length > 0) {
      message += `\n🧾 *Rincian Struk (${transaction.items.length} item):*\n`;
      transaction.items.forEach((item, idx) => {
        message += `  ${idx + 1}. ${item.name} (${item.quantity}x) — ${formatRupiah(item.total)}\n`;
      });
    }

    // Budget Progress Bar (for expenses)
    if (!isIncome && budget && budget.amount > 0) {
      const spentTotal = (budgetSpent || 0) + transaction.amount;
      const pct = Math.min(999, Math.round((spentTotal / budget.amount) * 100));
      const bar = this.renderProgressBar(pct, 10);
      const remaining = budget.amount - spentTotal;

      message += `\n📊 *Anggaran ${categoryName}:*\n`;
      message += `\`[${bar}]\` *${pct}%*\n`;
      message += `Terpakai: ${formatRupiah(spentTotal)} / ${formatRupiah(budget.amount)}\n`;
      
      if (remaining < 0) {
        message += `⚠️ *Perhatian:* Anggaran overbudget sebesar ${formatRupiah(Math.abs(remaining))}!\n`;
      } else if (pct >= 80) {
        message += `⚠️ *Peringatan 80%:* Sisa anggaran tinggal ${formatRupiah(remaining)}!\n`;
      } else {
        message += `Sisa: ${formatRupiah(remaining)}\n`;
      }
    }

    // Financial Motivation Quote
    const quotes = [
      '“Pengeluaran kecil yang terkontrol adalah kunci kebebasan finansial.”',
      '“Disiplin mencatat hari ini, tenang di hari tua nanti.”',
      '“Bukan seberapa besar penghasilanmu, tapi berapa yang bisa kamu amankan.”'
    ];
    const randomQuote = quotes[Math.floor(Math.random() * quotes.length)];
    message += `\n💬 _${randomQuote}_\n`;

    // Pro Proactive AI Advisor
    if (aiAdvice && user?.plan === 'pro') {
      message += `\n${aiAdvice}\n`;
    }

    return message;
  }

  /**
   * Format /saldo command response
   * @param {Array} wallets
   * @returns {string}
   */
  formatSaldoReply(wallets) {
    if (!wallets || wallets.length === 0) {
      return 'Belum ada dompet terdaftar di akunmu.';
    }

    let total = 0;
    let message = `💼 *Ringkasan Saldo Dompet TataDana*\n━━━━━━━━━━━━━━━━━━\n`;

    wallets.forEach(w => {
      total += Number(w.balance || 0);
      message += `• *${w.name}* (${w.type}): ${formatRupiah(w.balance)}\n`;
    });

    message += `━━━━━━━━━━━━━━━━━━\n`;
    message += `💰 *Total Kekayaan Bersih:* *${formatRupiah(total)}*`;
    return message;
  }

  /**
   * Call Telegram Bot API to send message
   * @param {number|string} chatId
   * @param {string} text
   * @param {object} replyMarkup
   */
  async sendMessage(chatId, text, replyMarkup = null) {
    const token = config.telegramBotToken;
    if (!token) {
      console.log(`[TelegramBot Local Simulator] Chat ID: ${chatId}\nMessage:\n${text}`);
      return { ok: true, simulated: true };
    }

    try {
      const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text,
          parse_mode: 'Markdown',
          ...(replyMarkup && { reply_markup: replyMarkup })
        })
      });

      return await response.json();
    } catch (err) {
      console.error('Error sending Telegram message:', err.message);
      return { ok: false, error: err.message };
    }
  }

  /**
   * Test Telegram connection via getMe
   * @param {string} token
   * @returns {Promise<{ success: boolean, botInfo?: any, error?: string }>}
   */
  async testConnection(token = config.telegramBotToken) {
    if (!token) {
      return {
        success: false,
        error: 'Token bot belum dikonfigurasi di Environment'
      };
    }

    try {
      const res = await fetch(`https://api.telegram.org/bot${token}/getMe`);
      const data = await res.json();
      if (data.ok) {
        return { success: true, botInfo: data.result };
      } else {
        return { success: false, error: data.description || 'Gagal verifikasi token bot' };
      }
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  /**
   * Register webhook to setWebhook
   * @param {string} webhookUrl
   * @param {string} token
   * @returns {Promise<{ success: boolean, result?: any, error?: string }>}
   */
  async registerWebhook(webhookUrl, token = config.telegramBotToken) {
    if (!token) {
      return { success: false, error: 'Token bot belum diatur' };
    }

    try {
      const res = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: webhookUrl,
          allowed_updates: ['message', 'callback_query']
        })
      });
      const data = await res.json();
      return { success: data.ok, result: data };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }
}

export const telegramBot = new TelegramBotService();
