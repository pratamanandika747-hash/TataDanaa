/**
 * Subscriptions & Midtrans Controller
 * Handles Midtrans Snap payment initiation, SHA-512 webhook verification,
 * and subscription status synchronization.
 */

import crypto from 'crypto';
import { db } from '../db/dbAdapter.js';
import { env } from '../config/env.js';
import { createSnapToken, verifyMidtransSignature } from '../config/midtrans.js';
import { successResponse, errorResponse } from '../utils/response.js';

export async function createSnap(req, res) {
  try {
    const userId = req.user.id;
    const { plan_type } = req.body;

    if (!plan_type || !['starter', 'pro'].includes(plan_type)) {
      return errorResponse(res, {
        code: 'INVALID_PLAN',
        message: "Tipe paket harus 'starter' (Rp49.000/bln) atau 'pro' (Rp99.000 lifetime)"
      }, 400);
    }

    const planConfig = env.plans[plan_type];
    const amount = planConfig.price;
    const billingPeriod = planConfig.billingPeriod;

    // Generate unique order ID: TTD-{PLAN}-{TIMESTAMP}-{HEX}
    const randomHex = crypto.randomBytes(3).toString('hex').toUpperCase();
    const orderId = `TTD-${plan_type.toUpperCase()}-${Date.now()}-${randomHex}`;

    // Midtrans Snap Payload
    const snapPayload = {
      transaction_details: {
        order_id: orderId,
        gross_amount: amount
      },
      item_details: [
        {
          id: plan_type,
          price: amount,
          quantity: 1,
          name: plan_type === 'pro' ? 'TataDana Pro Lifetime' : 'TataDana Starter Bulanan'
        }
      ],
      customer_details: {
        first_name: req.user.full_name || 'Pelanggan',
        email: req.user.email || 'customer@tatadana.id',
        phone: req.user.phone_number || ''
      },
      enabled_payments: [
        'qris', 'gopay', 'shopeepay', 'bca_va', 'bni_va', 'bri_va', 'mandiri_clickpay', 'credit_card'
      ],
      callbacks: {
        finish: `${env.clientUrl}/dashboard/settings?status=finish`
      }
    };

    const snapResult = await createSnapToken(snapPayload);

    // Save subscription in DB
    const subscription = await db.createSubscription({
      userId,
      orderId,
      planType: plan_type,
      billingPeriod,
      amount,
      snapToken: snapResult.token,
      redirectUrl: snapResult.redirectUrl
    });

    return successResponse(res, {
      order_id: orderId,
      snap_token: snapResult.token,
      redirect_url: snapResult.redirectUrl,
      amount,
      plan_type,
      subscription_id: subscription.id
    }, 201);
  } catch (err) {
    return errorResponse(res, { code: 'CREATE_SNAP_FAILED', message: err.message }, 500);
  }
}

export async function handleMidtransWebhook(req, res) {
  try {
    const {
      order_id,
      status_code,
      gross_amount,
      signature_key,
      transaction_status,
      fraud_status,
      payment_type,
      transaction_id
    } = req.body;

    if (!order_id || !status_code || !gross_amount || !signature_key) {
      return errorResponse(res, { code: 'INVALID_PAYLOAD', message: 'Payload webhook tidak lengkap' }, 400);
    }

    // 1. Verify SHA-512 Signature
    const isSignatureValid = verifyMidtransSignature({
      orderId: order_id,
      statusCode: status_code,
      grossAmount: gross_amount,
      serverKey: env.midtransServerKey,
      signatureKey: signature_key
    });

    if (!isSignatureValid) {
      console.warn(`[Midtrans Webhook] Invalid signature attempt for order_id: ${order_id}`);
      return errorResponse(res, { code: 'INVALID_SIGNATURE', message: 'Tanda tangan SHA-512 tidak cocok' }, 401);
    }

    // 2. Fetch subscription
    const subscription = await db.getSubscriptionByOrderId(order_id);
    if (!subscription) {
      console.warn(`[Midtrans Webhook] Order not found: ${order_id}`);
      return errorResponse(res, { code: 'ORDER_NOT_FOUND', message: 'Pesanan tidak ditemukan' }, 404);
    }

    // Idempotency: skip if already settled
    if (subscription.payment_status === 'settlement') {
      return successResponse(res, { message: 'Order sudah berstatus settlement' });
    }

    // 3. Transition Status
    let nextStatus = 'pending';
    if (transaction_status === 'capture') {
      if (fraud_status === 'accept') {
        nextStatus = 'settlement';
      }
    } else if (transaction_status === 'settlement') {
      nextStatus = 'settlement';
    } else if (['cancel', 'deny', 'expire'].includes(transaction_status)) {
      nextStatus = transaction_status;
    } else if (transaction_status === 'pending') {
      nextStatus = 'pending';
    }

    await db.updateSubscriptionStatus(order_id, {
      status: nextStatus,
      paymentType: payment_type,
      midtransTransactionId: transaction_id,
      rawResponse: req.body
    });

    return successResponse(res, {
      order_id,
      payment_status: nextStatus,
      message: 'Notifikasi Midtrans berhasil diproses'
    });
  } catch (err) {
    console.error('[Midtrans Webhook] Error:', err);
    // Respond 200 or 500
    return errorResponse(res, { code: 'WEBHOOK_ERROR', message: err.message }, 500);
  }
}

export async function verifyOrder(req, res) {
  try {
    const { orderId } = req.params;
    const subscription = await db.getSubscriptionByOrderId(orderId);

    if (!subscription) {
      return errorResponse(res, { code: 'NOT_FOUND', message: 'Pesanan tidak ditemukan' }, 404);
    }

    const userProfile = await db.findProfileById(subscription.user_id);

    return successResponse(res, {
      order_id: subscription.order_id,
      payment_status: subscription.payment_status,
      plan_type: subscription.plan_type,
      current_user_plan: userProfile ? userProfile.plan : 'starter'
    });
  } catch (err) {
    return errorResponse(res, { code: 'VERIFY_ORDER_FAILED', message: err.message }, 500);
  }
}

export async function getHistory(req, res) {
  try {
    const userId = req.user.id;
    const history = await db.getSubscriptionsByUserId(userId);

    return successResponse(res, { history });
  } catch (err) {
    return errorResponse(res, { code: 'GET_HISTORY_FAILED', message: err.message }, 500);
  }
}
