// server/telegram/webhook.js
// Idempotent Telegram Webhook Processor for TataDana
// Handles text parsing, receipt photos, voice notes, and bot commands

const { parseTransactionText } = require('../ai/parser');
const { formatExpenseReply, formatIncomeReply, formatErrorReply } = require('./replies');
const { checkFinancialAdvisorAlert } = require('../ai/advisor');
const { sendTelegramMessage } = require('./connection');
const { formatRupiah, formatWIBFull } = require('../utils/wib');

class WebhookHandler {
  constructor(db, aiEngine) {
    this.db = db;
    this.aiEngine = aiEngine;
    this.processedUpdates = new Set(); // in-memory fast set + DB idempotency
  }

  async handleUpdate(update, botToken = null) {
    if (!update || !update.update_id) {
      return { status: 'ignored', reason: 'no update_id' };
    }

    const updateId = update.update_id;

    // 1. Idempotency Check: prevent duplicate processing from Telegram retries
    const numId = Number(updateId);
    const isProcessed = this.processedUpdates.has(updateId) ||
      (!isNaN(numId) && this.processedUpdates.has(numId)) ||
      this.processedUpdates.has(String(updateId)) ||
      this.db.isUpdateProcessed(updateId);

    if (isProcessed) {
      console.log(`[Telegram Webhook] Skipping duplicate update_id: ${updateId}`);
      return { status: 'skipped', updateId };
    }

    // Mark as processing/processed
    if (this.processedUpdates.size > 2000) {
      const kept = Array.from(this.processedUpdates).slice(-1000);
      this.processedUpdates = new Set(kept);
    }
    this.processedUpdates.add(updateId);
    if (!isNaN(numId)) this.processedUpdates.add(numId);
    this.processedUpdates.add(String(updateId));
    this.db.markUpdateProcessed(updateId);

    const message = update.message || update.edited_message;
    if (!message) {
      return { status: 'ok', reason: 'no message payload' };
    }

    const chatId = message.chat?.id;
    const telegramUserId = message.from?.id;
    const userName = message.from?.first_name || 'Kawan';

    // Find user linked with this Telegram account
    const user = this.db.findUserByTelegramId(telegramUserId) || this.db.getDefaultUser();
    const token = botToken || this.db.getBotToken(user.id);

    // 2. Command handlers (/saldo, /hari ini, /minggu ini, /bulan ini, /budget, /sheet, /bantuan)
    const text = message.text?.trim() || '';
    if (text.startsWith('/')) {
      const commandResponse = await this._handleCommands(text, user, userName);
      if (token && chatId) {
        await sendTelegramMessage(token, chatId, commandResponse);
      }
      return { status: 'command_executed', command: text, response: commandResponse };
    }

    // 3. Check Subscription Limit (Starter: 50 transactions/month)
    const currentTxCount = this.db.getMonthlyTransactionCount(user.id);
    const isPro = user.plan_tier === 'pro';
    if (!isPro && currentTxCount >= 50) {
      const limitReply = `⚠️ Limit Transaksi Starter Tercapai!
Bulan ini kamu sudah mencatat 50 transaksi (batas maksimal paket Starter).

Untuk melanjutkan pencatatan tanpa batas, input struk belanja otomatis via AI, dan AI Financial Advisor, yuk upgrade ke TataDana PRO!
👉 Upgrade PRO hanya Rp99.000 (Sekali bayar untuk selamanya) di dashboard web kamu.`;
      if (token && chatId) {
        await sendTelegramMessage(token, chatId, limitReply);
      }
      return { status: 'limit_exceeded', count: currentTxCount, response: limitReply };
    }

    // 4. Handle Voice Note
    if (message.voice || message.audio) {
      return this._handleVoiceNote(message, user, token, chatId);
    }

    // 5. Handle Photo / Receipt (Pro Feature)
    if (message.photo) {
      return this._handleReceiptPhoto(message, user, token, chatId);
    }

    // 6. Handle Natural Text Input ("beli bakso 15rb", "gajian 5jt", etc.)
    return this._handleTextInput(text, user, token, chatId, userName);
  }

  async _handleTextInput(text, user, token, chatId, userName) {
    const parseResult = await parseTransactionText(text, this.aiEngine);
    if (!parseResult.success) {
      const errReply = formatErrorReply(parseResult.error, text);
      if (token && chatId) {
        await sendTelegramMessage(token, chatId, errReply);
      }
      return { status: 'parse_failed', response: errReply };
    }

    const { jenis, nominal, kategori, catatan } = parseResult.data;

    // Get user wallet (default telegram wallet)
    const wallet = this.db.getDefaultTelegramWallet(user.id);
    const category = this.db.findOrCreateCategory(user.id, kategori, jenis);

    // Save transaction
    const tx = this.db.createTransaction({
      userId: user.id,
      walletId: wallet.id,
      categoryId: category.id,
      type: jenis,
      amount: nominal,
      notes: catatan,
      source: 'telegram_text'
    });

    // Update wallet balance
    const updatedWallet = this.db.getWallet(wallet.id);

    // Get category budget info
    const budget = this.db.getCategoryBudget(user.id, category.id);
    const spent = this.db.getCategoryMonthlySpent(user.id, category.id);

    let reply = '';
    if (jenis === 'pengeluaran') {
      reply = formatExpenseReply({
        amount: nominal,
        categoryName: category.name,
        categoryIcon: category.icon,
        walletName: wallet.name,
        notes: catatan,
        currentBalance: updatedWallet.balance,
        categoryBudget: budget ? budget.amount : 0,
        categorySpent: spent
      });
    } else {
      reply = formatIncomeReply({
        amount: nominal,
        categoryName: category.name,
        categoryIcon: category.icon,
        walletName: wallet.name,
        notes: catatan,
        currentBalance: updatedWallet.balance
      });
    }

    // Proactive AI Financial Advisor (Pro Feature)
    if (user.plan_tier === 'pro' && jenis === 'pengeluaran') {
      const advisorAlert = checkFinancialAdvisorAlert({
        userName,
        transactionAmount: nominal,
        categoryName: category.name,
        categoryBudget: budget ? budget.amount : 0,
        currentCategorySpent: spent,
        isProUser: true
      });
      if (advisorAlert && advisorAlert.triggered) {
        reply += `\n\n${advisorAlert.message}`;
      }
    }

    if (token && chatId) {
      await sendTelegramMessage(token, chatId, reply);
    }

    return { status: 'recorded', transaction: tx, reply };
  }

  async _handleReceiptPhoto(message, user, token, chatId) {
    if (user.plan_tier !== 'pro') {
      const proCta = `📸 Fitur Scan Foto Struk Khusus Pengguna PRO!

Dengan TataDana PRO, kamu cukup foto struk belanja Indomaret, Alfamart, restoran, atau supermarket — AI kami otomatis membaca item belanja, nama toko, dan rincian per barang!

👉 Upgrade ke TataDana PRO (Rp99.000 Sekali Bayar Selamanya) di menu Billing web dashboard kamu.`;
      if (token && chatId) {
        await sendTelegramMessage(token, chatId, proCta);
      }
      return { status: 'pro_required', reply: proCta };
    }

    // Pro user OCR processing
    const ocrResult = await this.aiEngine.parseReceiptImage(null, user.id);
    const wallet = this.db.getDefaultTelegramWallet(user.id);
    const category = this.db.findOrCreateCategory(user.id, ocrResult.data.category, 'pengeluaran');

    // Create receipt parent transaction with line items
    const tx = this.db.createTransaction({
      userId: user.id,
      walletId: wallet.id,
      categoryId: category.id,
      type: 'pengeluaran',
      amount: ocrResult.data.totalAmount,
      notes: `Struk: ${ocrResult.data.merchant}`,
      merchantName: ocrResult.data.merchant,
      source: 'telegram_photo',
      isReceiptParent: true,
      items: ocrResult.data.items
    });

    const updatedWallet = this.db.getWallet(wallet.id);
    let reply = `🧾 Struk Belanja Berhasil Dicatat!\n`;
    reply += `├ Merchant : 🏪 ${ocrResult.data.merchant}\n`;
    reply += `├ Total    : ${formatRupiah(ocrResult.data.totalAmount)}\n`;
    reply += `├ Dompet   : 👛 ${wallet.name}\n`;
    reply += `├ Saldo    : ${formatRupiah(updatedWallet.balance)}\n\n`;
    reply += `📦 Rincian Item (${ocrResult.data.items.length} barang):\n`;
    ocrResult.data.items.forEach(it => {
      reply += `• ${it.itemName} (${it.quantity}x) — ${formatRupiah(it.total)}\n`;
    });
    reply += `\n✨ Rincian lengkap struk bisa kamu lihat di menu Laporan dashboard web!`;

    if (token && chatId) {
      await sendTelegramMessage(token, chatId, reply);
    }
    return { status: 'receipt_recorded', transaction: tx, reply };
  }

  async _handleVoiceNote(message, user, token, chatId) {
    const sttResult = await this.aiEngine.transcribeAudio(null, user.id);
    const transcript = sttResult.transcript;

    const parseResult = await parseTransactionText(transcript, this.aiEngine);
    if (!parseResult.success) {
      const errReply = `🎙️ Transkrip: "${transcript}"\n\n❌ ${parseResult.error}\nSilakan coba rekam suara lebih dekat atau ketik manual transaksimu.`;
      if (token && chatId) {
        await sendTelegramMessage(token, chatId, errReply);
      }
      return { status: 'voice_parse_failed', reply: errReply };
    }

    const { jenis, nominal, kategori, catatan } = parseResult.data;
    const wallet = this.db.getDefaultTelegramWallet(user.id);
    const category = this.db.findOrCreateCategory(user.id, kategori, jenis);

    const tx = this.db.createTransaction({
      userId: user.id,
      walletId: wallet.id,
      categoryId: category.id,
      type: jenis,
      amount: nominal,
      notes: catatan,
      source: 'telegram_voice',
      rawTranscript: transcript
    });

    const updatedWallet = this.db.getWallet(wallet.id);
    const budget = this.db.getCategoryBudget(user.id, category.id);
    const spent = this.db.getCategoryMonthlySpent(user.id, category.id);

    const reply = formatExpenseReply({
      amount: nominal,
      categoryName: category.name,
      categoryIcon: category.icon,
      walletName: wallet.name,
      notes: catatan,
      currentBalance: updatedWallet.balance,
      categoryBudget: budget ? budget.amount : 0,
      categorySpent: spent,
      voiceTranscript: transcript
    });

    if (token && chatId) {
      await sendTelegramMessage(token, chatId, reply);
    }
    return { status: 'voice_recorded', transaction: tx, reply };
  }

  async _handleCommands(cmd, user, userName) {
    const c = cmd.toLowerCase();

    if (c === '/start') {
      return `👋 Halo ${userName}! Selamat datang di TataDana.
Aplikasi manajemen keuangan pribadi semudah chatting.

Ketik saja transaksimu seperti chat biasa:
• "makan soto 20rb"
• "bensin 35k"
• "gajian 5jt"

Ketik /bantuan untuk melihat daftar perintah lainnya.`;
    }

    if (c === '/saldo') {
      const wallets = this.db.getUserWallets(user.id);
      let res = `👛 Saldo Dompet Kamu:\n`;
      let total = 0;
      wallets.forEach(w => {
        total += Number(w.balance);
        res += `• ${w.icon} ${w.name}: ${formatRupiah(w.balance)}${w.is_default_telegram ? ' (Default)' : ''}\n`;
      });
      res += `\n💰 Total Terkonsolidasi: ${formatRupiah(total)}`;
      return res;
    }

    if (c === '/hari ini') {
      const txs = this.db.getTodayTransactions(user.id);
      if (txs.length === 0) return `📝 Belum ada transaksi yang dicatat hari ini. Yuk catat sekarang!`;
      let res = `📅 Rekap Transaksi Hari Ini (${txs.length} transaksi):\n`;
      txs.forEach(t => {
        const sign = t.type === 'pemasukan' ? '+' : '-';
        res += `• [${t.type === 'pemasukan' ? '💰' : '💸'}] ${t.notes || t.category_name}: ${sign}${formatRupiah(t.amount)}\n`;
      });
      return res;
    }

    if (c === '/minggu ini') {
      const stats = this.db.getWeeklyStats(user.id);
      return `📊 Rekap 7 Hari Terakhir:
• Pemasukan   : ${formatRupiah(stats.income)}
• Pengeluaran : ${formatRupiah(stats.expense)}
• Net Cashflow: ${formatRupiah(stats.net)}`;
    }

    if (c === '/bulan ini') {
      const stats = this.db.getMonthlyStats(user.id);
      return `📈 Rekap Bulan Berjalan:
• Total Pemasukan   : ${formatRupiah(stats.income)}
• Total Pengeluaran : ${formatRupiah(stats.expense)}
• Sisa Cashflow     : ${formatRupiah(stats.net)}
• Transaksi Tercatat: ${stats.count} transaksi`;
    }

    if (c === '/budget') {
      const budgets = this.db.getUserBudgets(user.id);
      if (budgets.length === 0) return `🎯 Belum ada budget yang diatur. Buka dashboard web untuk mengatur budget kategori kamu.`;
      let res = `🎯 Status Budget Bulan Ini:\n\n`;
      budgets.forEach(b => {
        const pct = Math.round((b.spent / b.amount) * 100);
        res += `${b.category_name}:\n${pct}% terpakai (${formatRupiah(b.spent)} / ${formatRupiah(b.amount)})\n\n`;
      });
      return res;
    }

    if (c === '/sheet') {
      return `📊 Data Keuangan TataDana kamu 100% tersimpan aman di database Supabase privat dan dapat dilihat secara real-time di dashboard web TataDana:
🔗 https://tatadana.id/dashboard/laporan`;
    }

    if (c === '/bantuan') {
      return `🤖 Daftar Perintah TataDana Bot:
/saldo — Cek saldo semua dompet
/hari ini — Rekap transaksi hari ini
/minggu ini — Rekap transaksi 7 hari terakhir
/bulan ini — Rekap transaksi bulan berjalan
/budget — Cek status budget kategori
/sheet — Akses data laporan di dashboard
/bantuan — Menampilkan pesan panduan ini

💬 Kamu juga bisa langsung kirim:
• Teks: "beli kopi 25rb"
• Suara (Voice Note): Durasi s.d 60 detik
• Foto Struk Belanja (Khusus PRO)`;
    }

    return `❓ Perintah tidak dikenali. Ketik /bantuan untuk melihat opsi perintah.`;
  }
}

module.exports = WebhookHandler;
