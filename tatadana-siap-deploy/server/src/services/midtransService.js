/**
 * Midtrans Payment Gateway Integration & Subscription Service
 * Supports Snap checkout tokens, webhook signature validation, and manual admin approvals.
 */

import crypto from 'crypto';
import { config } from '../config/index.js';
import { inMemoryStore } from '../store/inMemoryStore.js';
import { toWIBISOString } from '../utils/timezone.js';

export class MidtransService {
  /**
   * Create Snap transaction token / order
   * @param {object} params
   * @returns {Promise<{ token: string, redirectUrl: string, orderId: string, amount: number }>}
   */
  async createTransaction({ userId, plan = 'pro', userEmail, userName }) {
    const isPro = plan === 'pro';
    const amount = isPro ? config.pricing.pro.price : config.pricing.starter.price;
    const orderId = `TD-${plan.toUpperCase()}-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    const payload = {
      transaction_details: {
        order_id: orderId,
        gross_amount: amount
      },
      item_details: [{
        id: `plan-${plan}`,
        price: amount,
        quantity: 1,
        name: isPro ? 'TataDana Pro Lifetime Membership' : 'TataDana Starter Monthly Subscription'
      }],
      customer_details: {
        first_name: userName || 'Pengguna',
        email: userEmail || 'user@tatadana.id'
      }
    };

    let snapToken = 'snap-token-simulated-' + Date.now();
    let redirectUrl = `https://app.sandbox.midtrans.com/snap/v2/vtweb/${snapToken}`;

    if (config.midtransServerKey) {
      try {
        const authHeader = Buffer.from(config.midtransServerKey + ':').toString('base64');
        const baseUrl = config.midtransIsProduction
          ? 'https://app.midtrans.com/snap/v1/transactions'
          : 'https://app.sandbox.midtrans.com/snap/v1/transactions';

        const res = await fetch(baseUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'Authorization': `Basic ${authHeader}`
          },
          body: JSON.stringify(payload)
        });

        if (res.ok) {
          const data = await res.json();
          snapToken = data.token;
          redirectUrl = data.redirect_url;
        }
      } catch (err) {
        console.warn('Midtrans API call failed, using simulator:', err.message);
      }
    }

    // Save pending subscription record
    const subRecord = {
      id: 'sub' + Math.random().toString(36).substring(2, 9),
      user_id: userId,
      plan,
      order_id: orderId,
      gross_amount: amount,
      status: 'pending',
      payment_type: 'qris',
      midtrans_response: { snap_token: snapToken },
      created_at: toWIBISOString()
    };

    inMemoryStore.subscriptions.unshift(subRecord);

    return {
      token: snapToken,
      redirectUrl,
      orderId,
      amount,
      plan
    };
  }

  /**
   * Validate Midtrans webhook signature:
   * SHA512(order_id + status_code + gross_amount + ServerKey)
   * @param {object} payload
   * @returns {boolean}
   */
  verifySignature(payload) {
    if (!config.midtransServerKey) return true; // dev/sandbox mode pass
    const { order_id, status_code, gross_amount, signature_key } = payload;
    if (!signature_key) return false;

    const raw = `${order_id}${status_code}${gross_amount}${config.midtransServerKey}`;
    const hash = crypto.createHash('sha512').update(raw).digest('hex');
    return hash === signature_key;
  }

  /**
   * Handle Midtrans Notification Webhook
   * @param {object} notification
   * @returns {Promise<{ success: boolean, updatedStatus: string }>}
   */
  async handleWebhookNotification(notification) {
    const { order_id, transaction_status, fraud_status, payment_type } = notification;

    let newStatus = 'pending';
    if (transaction_status === 'capture') {
      newStatus = fraud_status === 'accept' ? 'settlement' : 'pending';
    } else if (transaction_status === 'settlement') {
      newStatus = 'settlement';
    } else if (['cancel', 'deny', 'expire'].includes(transaction_status)) {
      newStatus = transaction_status;
    }

    // Find and update subscription
    const sub = inMemoryStore.subscriptions.find(s => s.order_id === order_id);
    if (sub) {
      sub.status = newStatus;
      sub.payment_type = payment_type || sub.payment_type;
      sub.midtrans_response = notification;

      // If settlement, upgrade user plan!
      if (newStatus === 'settlement') {
        const user = inMemoryStore.profiles.find(p => p.id === sub.user_id);
        if (user) {
          user.plan = sub.plan;
          console.log(`[Midtrans] User ${user.id} upgraded to plan: ${sub.plan}`);
        }
      }
    }

    return { success: true, updatedStatus: newStatus };
  }

  /**
   * Admin Manual Approval of Subscription
   * @param {string} subscriptionId
   * @param {string} adminId
   * @param {'approve'|'reject'} action
   */
  async adminManualAction(subscriptionId, adminId, action = 'approve') {
    const sub = inMemoryStore.subscriptions.find(s => s.id === subscriptionId);
    if (!sub) throw new Error('Langganan tidak ditemukan');

    if (action === 'approve') {
      sub.status = 'settlement';
      sub.approved_by_admin = adminId;
      const user = inMemoryStore.profiles.find(p => p.id === sub.user_id);
      if (user) {
        user.plan = sub.plan;
      }
    } else {
      sub.status = 'cancel';
      sub.approved_by_admin = adminId;
    }

    // Log admin audit
    inMemoryStore.adminAuditLogs.unshift({
      id: 'al' + Math.random().toString(36).substring(2, 9),
      admin_id: adminId,
      action: action === 'approve' ? 'approve_payment_manual' : 'reject_payment_manual',
      target_user_id: sub.user_id,
      details: { order_id: sub.order_id, amount: sub.gross_amount, plan: sub.plan },
      created_at: toWIBISOString()
    });

    return sub;
  }
}

export const midtransService = new MidtransService();
