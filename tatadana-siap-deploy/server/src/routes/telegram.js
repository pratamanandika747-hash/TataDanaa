/**
 * Telegram Webhook & Integration Routes for TataDana
 * Features: Idempotency (update_id deduplication), Multi-Modal AI parsing,
 * visual budget bar (█ and ░), and live getMe/setWebhook.
 */

import { Router } from 'express';
import { idempotencyManager } from '../utils/idempotency.js';
import { aiEngine } from '../services/aiEngine.js';
import { telegramBot } from '../services/telegramBot.js';
import { inMemoryStore } from '../store/inMemoryStore.js';
import { authMiddleware } from '../middlewares/auth.js';
import { toWIBISOString } from '../utils/timezone.js';

const router = Router();

// Public Telegram Webhook Endpoint
router.post('/webhook', async (req, res) => {
  const update = req.body;

  if (!update || !update.update_id) {
    return res.status(400).json({ success: false, error: 'Invalid Telegram update payload' });
  }

  const { update_id, message } = update;

  // 1. Check Idempotency
  const checkIdempotency = await idempotencyManager.check(update_id);
  if (checkIdempotency.isDuplicate) {
    console.log(`[Telegram Webhook] Duplicate update_id ${update_id} ignored.`);
    return res.status(200).json({ ok: true, duplicateIgnored: true });
  }

  const chatId = message?.chat?.id;
  const messageText = message?.text || message?.caption || '';

  // Mark as processing
  await idempotencyManager.markProcessing(update_id, chatId, messageText);

  try {
    if (!message) {
      await idempotencyManager.markCompleted(update_id);
      return res.status(200).json({ ok: true });
    }

    // 2. Identify linked user session
    let session = inMemoryStore.telegramSessions.find(s => s.telegram_chat_id === chatId);
    let user = session?.user_id ? inMemoryStore.profiles.find(p => p.id === session.user_id) : null;

    // Default to Budi (Pro demo) if session not bound yet in dev sandbox
    if (!user) {
      user = inMemoryStore.profiles.find(p => p.plan === 'pro') || inMemoryStore.profiles[0];
    }

    // 3. Handle Commands
    if (messageText.startsWith('/')) {
      const parts = messageText.trim().split(' ');
      const command = parts[0].toLowerCase();
      const param = parts[1];

      if (command === '/start') {
        if (param && param.startsWith('bind_')) {
          const bindCode = param.replace('bind_', '');
          // Bind account
          const targetSession = inMemoryStore.telegramSessions.find(s => s.link_code === bindCode);
          if (targetSession) {
            targetSession.telegram_chat_id = chatId;
            targetSession.telegram_username = message.from?.username || '';
            targetSession.is_linked = true;
            targetSession.linked_at = toWIBISOString();
            user = inMemoryStore.profiles.find(p => p.id === targetSession.user_id);
          }
        }

        const welcome = `Halo ${user ? user.full_name : 'Kak'}! Selamat datang di *TataDana* 🚀\n\nCatat keuangan semudah chat. Coba kirim pesan seperti:\n• "beli bakso 15rb"\n• "kopi susu 35k"\n• "gajian 5jt"\n• "bayar listrik 250.000"\n\nKetik /saldo untuk cek dompet, atau /budget untuk cek anggaran bulananmu!`;
        await telegramBot.sendMessage(chatId, welcome);
        await idempotencyManager.markCompleted(update_id);
        return res.status(200).json({ ok: true });
      }

      if (command === '/saldo') {
        const userWallets = inMemoryStore.wallets.filter(w => w.user_id === user.id);
        const reply = telegramBot.formatSaldoReply(userWallets);
        await telegramBot.sendMessage(chatId, reply);
        await idempotencyManager.markCompleted(update_id);
        return res.status(200).json({ ok: true });
      }

      if (command === '/bantuan' || command === '/help') {
        const helpText = `📖 *Panduan TataDana Bot:*\n\n1. *Catat Pengeluaran:* Cukup ketik nama barang & nominal. Contoh: "bensin 50rb" atau "nasi padang 25k".\n2. *Catat Pemasukan:* Tambahkan kata gajian/terima/bonus. Contoh: "gajian 8.5jt".\n3. *Kirim Struk Foto (Pro):* Foto nota/struk belanja untuk dicatat otomatis per item.\n4. *Voice Note (Pro):* Kirim rekaman suara maks 60 detik.\n5. /saldo - Cek saldo seluruh dompet.\n6. /bantuan - Tampilkan pesan ini.`;
        await telegramBot.sendMessage(chatId, helpText);
        await idempotencyManager.markCompleted(update_id);
        return res.status(200).json({ ok: true });
      }
    }

    // 4. Handle Voice Note
    if (message.voice || message.audio) {
      if (user.plan !== 'pro') {
        await telegramBot.sendMessage(chatId, '🔒 Fitur Voice Note hanya tersedia untuk pengguna *TataDana Pro*. Upgrade sekarang untuk menikmati kemudahan voice notes!');
        await idempotencyManager.markCompleted(update_id);
        return res.status(200).json({ ok: true });
      }

      const duration = message.voice?.duration || 10;
      const voiceResult = await aiEngine.processVoiceNote(null, duration);
      // Process transaction from voice transcript
      const parsed = voiceResult.transaction;
      if (parsed.success) {
        await processAndReplyTransaction({ user, chatId, parsed, source: 'telegram_voice' });
      }
      await idempotencyManager.markCompleted(update_id);
      return res.status(200).json({ ok: true });
    }

    // 5. Handle Receipt Photo
    if (message.photo) {
      if (user.plan !== 'pro') {
        await telegramBot.sendMessage(chatId, '🔒 Fitur Scan Struk Belanja OCR hanya tersedia untuk pengguna *TataDana Pro*. Upgrade untuk mengaktifkan ekstraksi nota otomatis!');
        await idempotencyManager.markCompleted(update_id);
        return res.status(200).json({ ok: true });
      }

      const ocrResult = await aiEngine.parseReceiptOcr('photo_simulated');
      const parsed = {
        success: true,
        jenis: 'pengeluaran',
        nominal: ocrResult.total,
        kategori: ocrResult.kategori || 'Belanja Kebutuhan',
        catatan: ocrResult.notes || `Struk ${ocrResult.merchantName}`,
        items: ocrResult.items,
        merchantName: ocrResult.merchantName
      };

      await processAndReplyTransaction({ user, chatId, parsed, source: 'telegram_receipt', items: ocrResult.items, merchantName: ocrResult.merchantName });
      await idempotencyManager.markCompleted(update_id);
      return res.status(200).json({ ok: true });
    }

    // 6. Handle Natural Indonesian Text
    if (messageText) {
      const parsedResult = await aiEngine.parseTextTransaction(messageText);
      const parsed = parsedResult.data;

      if (!parsed.success) {
        await telegramBot.sendMessage(chatId, `⚠️ Format tidak dikenali. Contoh: "kopi 35k" atau "beli bakso 15rb".`);
      } else {
        await processAndReplyTransaction({ user, chatId, parsed, source: 'telegram_text' });
      }
    }

    await idempotencyManager.markCompleted(update_id);
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('[Telegram Webhook Error]:', err);
    await idempotencyManager.markFailed(update_id);
    return res.status(500).json({ error: err.message });
  }
});

/**
 * Helper to persist transaction, recalculate budget & send Telegram reply
 */
async function processAndReplyTransaction({ user, chatId, parsed, source, items = [], merchantName = '' }) {
  // Find default wallet
  const wallet = inMemoryStore.wallets.find(w => w.user_id === user.id && w.is_default)
    || inMemoryStore.wallets.find(w => w.user_id === user.id)
    || inMemoryStore.wallets[0];

  // Find matching category
  const category = inMemoryStore.categories.find(c => c.name.toLowerCase() === parsed.kategori.toLowerCase())
    || inMemoryStore.categories[0];

  // Find current budget
  const currentMonth = new Date().getMonth() + 1;
  const currentYear = new Date().getFullYear();
  const budget = inMemoryStore.budgets.find(b => b.user_id === user.id && b.category_id === category.id && b.month === currentMonth && b.year === currentYear);

  // Calculate current month's spent for this category
  const categoryTransactions = inMemoryStore.transactions.filter(t => 
    t.user_id === user.id && 
    t.category_id === category.id && 
    t.type === 'pengeluaran'
  );
  const budgetSpent = categoryTransactions.reduce((acc, curr) => acc + curr.amount, 0);

  // Generate Pro AI advisor advice if Pro user
  let aiAdvice = null;
  if (user.plan === 'pro') {
    aiAdvice = await aiEngine.generateFinancialAdvice({
      budgetLimit: budget?.amount || 1500000,
      categorySpent: budgetSpent + parsed.nominal,
      categoryName: category.name
    }, parsed);
  }

  // Create Transaction Record
  const newTx = inMemoryStore.createTransaction({
    userId: user.id,
    walletId: wallet?.id,
    categoryId: category?.id,
    type: parsed.jenis,
    amount: parsed.nominal,
    notes: parsed.catatan,
    source,
    merchantName: merchantName || parsed.merchantName,
    items
  });

  // Build formatted Telegram Message
  const reply = telegramBot.formatTransactionReply({
    user,
    transaction: newTx,
    category,
    wallet,
    budget,
    budgetSpent,
    aiAdvice
  });

  await telegramBot.sendMessage(chatId, reply);
}

// Live getMe Connection Test
router.get('/test-connection', authMiddleware, async (req, res) => {
  const result = await telegramBot.testConnection();
  res.json(result);
});

// Set Webhook Endpoint
router.post('/set-webhook', authMiddleware, async (req, res) => {
  const { webhookUrl } = req.body;
  const result = await telegramBot.registerWebhook(webhookUrl);
  res.json(result);
});

// Generate Deep Link Code to bind user account
router.post('/generate-link-code', authMiddleware, (req, res) => {
  const userId = req.user.id;
  const linkCode = 'TD-' + Math.floor(1000 + Math.random() * 9000);

  let session = inMemoryStore.telegramSessions.find(s => s.user_id === userId);
  if (!session) {
    session = {
      id: 's_' + Math.random().toString(36).substring(2, 9),
      telegram_chat_id: null,
      telegram_username: null,
      user_id: userId,
      link_code: linkCode,
      is_linked: false,
      created_at: toWIBISOString()
    };
    inMemoryStore.telegramSessions.push(session);
  } else {
    session.link_code = linkCode;
  }

  const botUsername = inMemoryStore.systemSettings?.telegram_bot?.bot_username || 'TataDanaBot';
  const deepLink = `https://t.me/${botUsername}?start=bind_${linkCode}`;

  res.json({
    success: true,
    linkCode,
    botUsername,
    deepLink,
    isLinked: session.is_linked,
    telegramUsername: session.telegram_username
  });
});

export default router;
