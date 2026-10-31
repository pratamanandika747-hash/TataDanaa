import { Router } from 'express';
import {
  createSnap,
  handleMidtransWebhook,
  verifyOrder,
  getHistory
} from '../controllers/subscriptionController.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

// Public webhook endpoint for Midtrans notifications
router.post('/midtrans-webhook', handleMidtransWebhook);

// Authenticated subscription endpoints
router.post('/create-snap', authenticate, createSnap);
router.post('/verify/:orderId', authenticate, verifyOrder);
router.get('/history', authenticate, getHistory);

export default router;
