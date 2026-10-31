/**
 * Webhook Simulator Route for TataDana
 * Allows instant testing of Telegram text messages, voice notes, receipt photo OCR,
 * and Midtrans payment webhooks locally without ngrok/live tunnels.
 */

import { Router } from 'express';
import { inMemoryStore } from '../store/inMemoryStore.js';
import { aiEngine } from '../services/aiEngine.js';
import { telegramBot } from '../services/telegramBot.js';
import { midtransService } from '../services/midtransService.js';
import { authMiddleware } from '../middlewares/auth.js';

const router = Router();

// 1. Simulate Telegram Text Message
router.post('/telegram-text', authMiddleware, async (req, res) => {
  try {
    const { text = 'kopi susu 35k', userId } = req.body;
    const targetUserId = userId || req.user.id;
    const user = inMemoryStore.profiles.find(p => p.id === targetUserId) || req.user;

    // Call AI text parse
    const aiResult = await aiEngine.parseTextTransaction(text);
    const parsed = aiResult.data;

    if (!parsed.success) {
      return res.json({
        success: false,
        error: parsed.error,
        botReply: `⚠️ Format tidak dikenali. Contoh: "kopi 35k" atau "beli bakso 15rb".`
      });
    }

    // Default wallet & category
    const wallet = inMemoryStore.wallets.find(w => w.user_id === user.id && w.is_default) || inMemoryStore.wallets[0];
    const category = inMemoryStore.categories.find(c => c.name.toLowerCase() === parsed.kategori.toLowerCase()) || inMemoryStore.categories[0];

    // Current budget
    const currentMonth = new Date().getMonth() + 1;
    const currentYear = new Date().getFullYear();
    const budget = inMemoryStore.budgets.find(b => b.user_id === user.id && b.category_id === category.id && b.month === currentMonth && b.year === currentYear);

    // Sum category spent
    const categoryTxs = inMemoryStore.transactions.filter(t => t.user_id === user.id && t.category_id === category.id && t.type === 'pengeluaran');
    const budgetSpent = categoryTxs.reduce((s, t) => s + t.amount, 0);

    // Pro AI Advisor
    let aiAdvice = null;
    if (user.plan === 'pro') {
      aiAdvice = await aiEngine.generateFinancialAdvice({
        budgetLimit: budget?.amount || 1500000,
        categorySpent: budgetSpent + parsed.nominal,
        categoryName: category.name
      }, parsed);
    }

    // Create transaction
    const newTx = inMemoryStore.createTransaction({
      userId: user.id,
      walletId: wallet?.id,
      categoryId: category?.id,
      type: parsed.jenis,
      amount: parsed.nominal,
      notes: parsed.catatan,
      source: 'telegram_text'
    });

    // Generate formatted bot reply
    const botReply = telegramBot.formatTransactionReply({
      user,
      transaction: newTx,
      category,
      wallet,
      budget,
      budgetSpent,
      aiAdvice
    });

    res.json({
      success: true,
      transaction: newTx,
      aiResult,
      botReply
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 2. Simulate Telegram Voice Note
router.post('/telegram-voice', authMiddleware, async (req, res) => {
  try {
    const { durationSeconds = 12, userId } = req.body;
    const targetUserId = userId || req.user.id;
    const user = inMemoryStore.profiles.find(p => p.id === targetUserId) || req.user;

    if (user.plan !== 'pro') {
      return res.status(403).json({
        success: false,
        error: 'Fitur Voice Note terkunci. Khusus pengguna TataDana Pro.'
      });
    }

    const voiceRes = await aiEngine.processVoiceNote(null, durationSeconds);
    const parsed = voiceRes.transaction;

    const wallet = inMemoryStore.wallets.find(w => w.user_id === user.id) || inMemoryStore.wallets[0];
    const category = inMemoryStore.categories.find(c => c.name.toLowerCase() === parsed.kategori.toLowerCase()) || inMemoryStore.categories[0];

    const newTx = inMemoryStore.createTransaction({
      userId: user.id,
      walletId: wallet?.id,
      categoryId: category?.id,
      type: parsed.jenis,
      amount: parsed.nominal,
      notes: parsed.catatan,
      source: 'telegram_voice'
    });

    const botReply = telegramBot.formatTransactionReply({
      user,
      transaction: newTx,
      category,
      wallet
    });

    res.json({
      success: true,
      transcript: voiceRes.transcript,
      transaction: newTx,
      botReply
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 3. Simulate Telegram Receipt Photo OCR (Pro Feature)
router.post('/telegram-receipt', authMiddleware, async (req, res) => {
  try {
    const { userId } = req.body;
    const targetUserId = userId || req.user.id;
    const user = inMemoryStore.profiles.find(p => p.id === targetUserId) || req.user;

    if (user.plan !== 'pro') {
      return res.status(403).json({
        success: false,
        error: 'Fitur Scan Struk Belanja OCR terkunci. Khusus pengguna TataDana Pro.'
      });
    }

    const ocrResult = await aiEngine.parseReceiptOcr('sample_receipt.jpg');
    const wallet = inMemoryStore.wallets.find(w => w.user_id === user.id) || inMemoryStore.wallets[0];
    const category = inMemoryStore.categories.find(c => c.name === ocrResult.kategori) || inMemoryStore.categories[2];

    const newTx = inMemoryStore.createTransaction({
      userId: user.id,
      walletId: wallet?.id,
      categoryId: category?.id,
      type: 'pengeluaran',
      amount: ocrResult.total,
      notes: ocrResult.notes,
      source: 'telegram_receipt',
      merchantName: ocrResult.merchantName,
      items: ocrResult.items
    });

    const botReply = telegramBot.formatTransactionReply({
      user,
      transaction: newTx,
      category,
      wallet
    });

    res.json({
      success: true,
      ocrResult,
      transaction: newTx,
      botReply
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 4. Simulate Midtrans Webhook Event
router.post('/midtrans-event', authMiddleware, async (req, res) => {
  try {
    const { orderId, status = 'settlement' } = req.body;
    const sub = inMemoryStore.subscriptions.find(s => s.order_id === orderId) || inMemoryStore.subscriptions[0];

    const fakePayload = {
      order_id: sub.order_id,
      status_code: '200',
      gross_amount: String(sub.gross_amount),
      transaction_status: status,
      fraud_status: 'accept',
      payment_type: 'qris',
      signature_key: 'simulated_valid_signature'
    };

    const result = await midtransService.handleWebhookNotification(fakePayload);
    res.json({
      success: true,
      notification: fakePayload,
      result
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
