/**
 * Budgets Management Routes for TataDana
 * Calculates progress, remaining balance, and alert status (80% / 100%)
 */

import { Router } from 'express';
import { inMemoryStore } from '../store/inMemoryStore.js';
import { authMiddleware } from '../middlewares/auth.js';
import { planGuard } from '../middlewares/planGuard.js';
import { toWIBISOString } from '../utils/timezone.js';

const router = Router();
router.use(authMiddleware);

// Get User Budgets for Specific Month & Year
router.get('/', (req, res) => {
  const userId = req.user.id;
  const now = new Date();
  const month = parseInt(req.query.month || (now.getMonth() + 1), 10);
  const year = parseInt(req.query.year || now.getFullYear(), 10);

  const budgets = inMemoryStore.budgets.filter(b => b.user_id === userId && b.month === month && b.year === year);

  // Compute spent amount for each budget category
  const enriched = budgets.map(budget => {
    const category = inMemoryStore.categories.find(c => c.id === budget.category_id);

    // Sum transactions in this month & year for this category
    const matchingTxs = inMemoryStore.transactions.filter(t => {
      if (t.user_id !== userId || t.category_id !== budget.category_id || t.type !== 'pengeluaran') return false;
      const tDate = new Date(t.date || t.created_at);
      return (tDate.getMonth() + 1) === month && tDate.getFullYear() === year;
    });

    const spent = matchingTxs.reduce((sum, t) => sum + Number(t.amount), 0);
    const percentage = budget.amount > 0 ? Math.round((spent / budget.amount) * 100) : 0;
    const remaining = budget.amount - spent;

    return {
      ...budget,
      category_name: category?.name || 'Kategori',
      category_emoji: category?.icon_emoji || '📦',
      category_color: category?.color || '#FF5B00',
      spent,
      remaining,
      percentage,
      isOverBudget: remaining < 0,
      isWarning80: percentage >= 80 && percentage < 100
    };
  });

  res.json({
    success: true,
    data: enriched,
    month,
    year
  });
});

// Create New Budget
router.post('/', planGuard.canCreateBudget, (req, res) => {
  const userId = req.user.id;
  const { categoryId, amount, month, year } = req.body;

  if (!categoryId || !amount) {
    return res.status(400).json({ success: false, error: 'Kategori dan nominal budget wajib diisi' });
  }

  const now = new Date();
  const bMonth = parseInt(month || (now.getMonth() + 1), 10);
  const bYear = parseInt(year || now.getFullYear(), 10);

  // Check if exists
  const existing = inMemoryStore.budgets.find(b => b.user_id === userId && b.category_id === categoryId && b.month === bMonth && b.year === bYear);
  if (existing) {
    existing.amount = Number(amount);
    return res.json({ success: true, data: existing });
  }

  const newBudget = {
    id: 'b_' + Math.random().toString(36).substring(2, 9),
    user_id: userId,
    category_id: categoryId,
    amount: Number(amount),
    month: bMonth,
    year: bYear,
    alert_80_sent: false,
    alert_100_sent: false,
    created_at: toWIBISOString()
  };

  inMemoryStore.budgets.push(newBudget);

  res.status(201).json({
    success: true,
    data: newBudget
  });
});

// Delete Budget
router.delete('/:id', (req, res) => {
  const userId = req.user.id;
  const { id } = req.params;

  const idx = inMemoryStore.budgets.findIndex(b => b.id === id && b.user_id === userId);
  if (idx === -1) {
    return res.status(404).json({ success: false, error: 'Budget tidak ditemukan' });
  }

  inMemoryStore.budgets.splice(idx, 1);
  res.json({ success: true, message: 'Budget berhasil dihapus' });
});

export default router;
