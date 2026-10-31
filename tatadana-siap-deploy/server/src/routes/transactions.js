/**
 * Transactions Management Routes for TataDana
 * Features: Multi-filter, Search, Pagination, Expandable Receipt Items, Plan Quota Check
 */

import { Router } from 'express';
import { inMemoryStore } from '../store/inMemoryStore.js';
import { authMiddleware } from '../middlewares/auth.js';
import { planGuard } from '../middlewares/planGuard.js';
import { toWIBISOString } from '../utils/timezone.js';

const router = Router();
router.use(authMiddleware);

// Get User Transactions (with filtering, search, pagination, expandable items)
router.get('/', (req, res) => {
  const userId = req.user.id;
  const {
    q,
    walletId,
    categoryId,
    type,
    startDate,
    endDate,
    page = 1,
    limit = 20
  } = req.query;

  let list = inMemoryStore.transactions.filter(t => t.user_id === userId);

  // Filter Search Query
  if (q) {
    const query = q.toLowerCase();
    list = list.filter(t =>
      (t.notes && t.notes.toLowerCase().includes(query)) ||
      (t.merchant_name && t.merchant_name.toLowerCase().includes(query))
    );
  }

  // Filter Wallet
  if (walletId) {
    list = list.filter(t => t.wallet_id === walletId);
  }

  // Filter Category
  if (categoryId) {
    list = list.filter(t => t.category_id === categoryId);
  }

  // Filter Type
  if (type) {
    list = list.filter(t => t.type === type);
  }

  // Filter Date Range
  if (startDate) {
    const start = new Date(startDate).getTime();
    list = list.filter(t => new Date(t.date || t.created_at).getTime() >= start);
  }
  if (endDate) {
    const end = new Date(endDate).getTime();
    list = list.filter(t => new Date(t.date || t.created_at).getTime() <= end);
  }

  // Sort descending by date
  list.sort((a, b) => new Date(b.date || b.created_at) - new Date(a.date || a.created_at));

  const total = list.length;
  const pageNum = parseInt(page, 10);
  const limitNum = parseInt(limit, 10);
  const startIndex = (pageNum - 1) * limitNum;
  const paginated = list.slice(startIndex, startIndex + limitNum);

  // Attach enriched details: category name, emoji, wallet name, items
  const enriched = paginated.map(tx => {
    const category = inMemoryStore.categories.find(c => c.id === tx.category_id);
    const wallet = inMemoryStore.wallets.find(w => w.id === tx.wallet_id);
    const items = inMemoryStore.transactionItems.filter(i => i.transaction_id === tx.id);

    return {
      ...tx,
      category_name: category?.name || 'Lain-lain',
      category_emoji: category?.icon_emoji || '📦',
      category_color: category?.color || '#FF5B00',
      wallet_name: wallet?.name || 'Dompet Utama',
      items
    };
  });

  res.json({
    success: true,
    data: enriched,
    pagination: {
      total,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(total / limitNum)
    }
  });
});

// Create manual transaction (enforcing plan quota)
router.post('/', planGuard.canCreateTransaction, (req, res) => {
  const userId = req.user.id;
  const { walletId, categoryId, type, amount, notes, merchantName, items } = req.body;

  if (!walletId || !type || !amount) {
    return res.status(400).json({ success: false, error: 'Data transaksi tidak lengkap' });
  }

  const newTx = inMemoryStore.createTransaction({
    userId,
    walletId,
    categoryId: categoryId || inMemoryStore.categories[0].id,
    type,
    amount: Number(amount),
    notes,
    merchantName,
    source: 'web_manual',
    items: items || []
  });

  res.status(201).json({
    success: true,
    data: newTx
  });
});

// Delete Transaction
router.delete('/:id', (req, res) => {
  const userId = req.user.id;
  const { id } = req.params;

  const txIndex = inMemoryStore.transactions.findIndex(t => t.id === id && t.user_id === userId);
  if (txIndex === -1) {
    return res.status(404).json({ success: false, error: 'Transaksi tidak ditemukan' });
  }

  const tx = inMemoryStore.transactions[txIndex];
  
  // Reverse wallet balance
  const wallet = inMemoryStore.wallets.find(w => w.id === tx.wallet_id);
  if (wallet) {
    if (tx.type === 'pemasukan') {
      wallet.balance -= tx.amount;
    } else if (tx.type === 'pengeluaran') {
      wallet.balance += tx.amount;
    }
  }

  // Remove items
  inMemoryStore.transactionItems = inMemoryStore.transactionItems.filter(i => i.transaction_id !== id);
  // Remove transaction
  inMemoryStore.transactions.splice(txIndex, 1);

  res.json({
    success: true,
    message: 'Transaksi berhasil dihapus'
  });
});

export default router;
