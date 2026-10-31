/**
 * Wallets Management Routes for TataDana
 */

import { Router } from 'express';
import { inMemoryStore } from '../store/inMemoryStore.js';
import { authMiddleware } from '../middlewares/auth.js';
import { planGuard } from '../middlewares/planGuard.js';
import { toWIBISOString } from '../utils/timezone.js';

const router = Router();
router.use(authMiddleware);

// Get All Wallets for Current User
router.get('/', (req, res) => {
  const userId = req.user.id;
  const wallets = inMemoryStore.wallets.filter(w => w.user_id === userId);
  res.json({
    success: true,
    data: wallets
  });
});

// Create New Wallet
router.post('/', planGuard.canCreateWallet, (req, res) => {
  const userId = req.user.id;
  const { name, type = 'bank', balance = 0, color = '#FF5B00', isDefault = false } = req.body;

  if (!name) {
    return res.status(400).json({ success: false, error: 'Nama dompet wajib diisi' });
  }

  // If set to default, unset other defaults
  if (isDefault) {
    inMemoryStore.wallets.filter(w => w.user_id === userId).forEach(w => w.is_default = false);
  }

  const newWallet = {
    id: 'w_' + Math.random().toString(36).substring(2, 9),
    user_id: userId,
    name,
    type,
    balance: Number(balance),
    currency: 'IDR',
    is_default: Boolean(isDefault),
    color,
    created_at: toWIBISOString()
  };

  inMemoryStore.wallets.push(newWallet);

  res.status(201).json({
    success: true,
    data: newWallet
  });
});

// Update Wallet
router.put('/:id', (req, res) => {
  const userId = req.user.id;
  const { id } = req.params;
  const { name, type, balance, color, isDefault } = req.body;

  const wallet = inMemoryStore.wallets.find(w => w.id === id && w.user_id === userId);
  if (!wallet) {
    return res.status(404).json({ success: false, error: 'Dompet tidak ditemukan' });
  }

  if (isDefault) {
    inMemoryStore.wallets.filter(w => w.user_id === userId).forEach(w => w.is_default = false);
    wallet.is_default = true;
  }

  if (name !== undefined) wallet.name = name;
  if (type !== undefined) wallet.type = type;
  if (balance !== undefined) wallet.balance = Number(balance);
  if (color !== undefined) wallet.color = color;

  res.json({
    success: true,
    data: wallet
  });
});

// Delete Wallet
router.delete('/:id', (req, res) => {
  const userId = req.user.id;
  const { id } = req.params;

  const index = inMemoryStore.wallets.findIndex(w => w.id === id && w.user_id === userId);
  if (index === -1) {
    return res.status(404).json({ success: false, error: 'Dompet tidak ditemukan' });
  }

  inMemoryStore.wallets.splice(index, 1);
  res.json({ success: true, message: 'Dompet berhasil dihapus' });
});

export default router;
