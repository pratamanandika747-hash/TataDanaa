/**
 * Subscription & Payment Gateway Routes for TataDana
 */

import { Router } from 'express';
import { inMemoryStore } from '../store/inMemoryStore.js';
import { midtransService } from '../services/midtransService.js';
import { authMiddleware } from '../middlewares/auth.js';

const router = Router();

// Create Checkout Transaction
router.post('/create-checkout', authMiddleware, async (req, res) => {
  try {
    const user = req.user;
    const { plan = 'pro' } = req.body;

    const checkout = await midtransService.createTransaction({
      userId: user.id,
      plan,
      userEmail: user.email,
      userName: user.full_name
    });

    res.json({
      success: true,
      data: checkout
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Midtrans Notification Webhook
router.post('/notification-webhook', async (req, res) => {
  try {
    const notification = req.body;
    
    // Verify signature
    const isValid = midtransService.verifySignature(notification);
    if (!isValid) {
      return res.status(403).json({ success: false, error: 'Signature key Midtrans tidak valid' });
    }

    const result = await midtransService.handleWebhookNotification(notification);
    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Current User Subscription Details
router.get('/my-status', authMiddleware, (req, res) => {
  const user = req.user;
  const userSubs = inMemoryStore.subscriptions.filter(s => s.user_id === user.id);
  res.json({
    success: true,
    plan: user.plan,
    history: userSubs
  });
});

export default router;
