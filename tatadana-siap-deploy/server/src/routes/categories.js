/**
 * Categories Management Routes for TataDana
 */

import { Router } from 'express';
import { inMemoryStore } from '../store/inMemoryStore.js';
import { authMiddleware } from '../middlewares/auth.js';
import { toWIBISOString } from '../utils/timezone.js';

const router = Router();
router.use(authMiddleware);

// Get All Categories (System + User Custom)
router.get('/', (req, res) => {
  const userId = req.user.id;
  const categories = inMemoryStore.categories.filter(c => c.is_system || c.user_id === userId);
  res.json({
    success: true,
    data: categories
  });
});

// Create Custom Category
router.post('/', (req, res) => {
  const userId = req.user.id;
  const { name, type = 'pengeluaran', iconEmoji = '📦', color = '#FF5B00' } = req.body;

  if (!name) {
    return res.status(400).json({ success: false, error: 'Nama kategori wajib diisi' });
  }

  const newCat = {
    id: 'c_' + Math.random().toString(36).substring(2, 9),
    user_id: userId,
    name,
    type,
    icon_emoji: iconEmoji,
    color,
    is_system: false,
    created_at: toWIBISOString()
  };

  inMemoryStore.categories.push(newCat);

  res.status(201).json({
    success: true,
    data: newCat
  });
});

export default router;
