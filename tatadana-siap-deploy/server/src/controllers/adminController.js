/**
 * Admin Controller
 * Handles administrative operations:
 * - High-level SaaS KPI Metrics
 * - User Directory & Impersonation
 * - AI Multi-Provider Config & Key Encryption
 * - AI Telemetry Logs
 * - Audit Trails
 * - Manual Subscription Approvals
 * - Local Webhook Simulator
 */

import { db } from '../db/dbAdapter.js';
import { generateJwtToken, encryptApiKey, generateMidtransSignature } from '../utils/crypto.js';
import { env } from '../config/env.js';
import { successResponse, errorResponse } from '../utils/response.js';

export async function getMetrics(req, res) {
  try {
    const { total: totalUsers } = await db.getAllProfiles();
    const totalTransactions = db.transactions.length;
    const paidSubscriptions = db.subscriptions.filter(s => s.payment_status === 'settlement');
    const totalRevenue = paidSubscriptions.reduce((sum, s) => sum + Number(s.amount || 0), 0);
    const proUsersCount = db.profiles.filter(p => p.plan === 'pro').length;

    return successResponse(res, {
      total_users: totalUsers,
      pro_users: proUsersCount,
      total_transactions: totalTransactions,
      active_subscriptions: paidSubscriptions.length,
      total_revenue: totalRevenue
    });
  } catch (err) {
    return errorResponse(res, { code: 'GET_METRICS_FAILED', message: err.message }, 500);
  }
}

export async function getUsers(req, res) {
  try {
    const { page = 1, limit = 20, search = '' } = req.query;
    const offset = (parseInt(page, 10) - 1) * parseInt(limit, 10);

    const { data: users, total } = await db.getAllProfiles({
      limit: parseInt(limit, 10),
      offset,
      search
    });

    const safeUsers = users.map(u => {
      const { password_hash: _, ...safe } = u;
      const userTxCount = db.transactions.filter(t => t.user_id === u.id).length;
      return {
        ...safe,
        transaction_count: userTxCount
      };
    });

    return successResponse(res, safeUsers, 200, {
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
      total_items: total,
      total_pages: Math.ceil(total / parseInt(limit, 10)) || 1
    });
  } catch (err) {
    return errorResponse(res, { code: 'GET_USERS_FAILED', message: err.message }, 500);
  }
}

export async function impersonateUser(req, res) {
  try {
    const adminId = req.user.id;
    const { target_user_id } = req.body;

    if (!target_user_id) {
      return errorResponse(res, { code: 'VALIDATION_ERROR', message: 'target_user_id wajib disertakan' }, 400);
    }

    const targetUser = await db.findProfileById(target_user_id);
    if (!targetUser) {
      return errorResponse(res, { code: 'NOT_FOUND', message: 'Target pengguna tidak ditemukan' }, 404);
    }

    // Log impersonation event
    const ip = req.ip || req.headers['x-forwarded-for'] || req.socket?.remoteAddress;
    await db.insertAdminAuditLog({
      adminId,
      targetUserId: target_user_id,
      action: 'impersonate_user',
      details: {
        target_email: targetUser.email,
        target_phone: targetUser.phone_number
      },
      ip,
      userAgent: req.headers['user-agent']
    });

    // Generate impersonation token (1 hour)
    const token = generateJwtToken(
      {
        sub: target_user_id,
        email: targetUser.email,
        role: targetUser.role,
        plan: targetUser.plan,
        is_impersonated: true,
        original_admin_id: adminId
      },
      env.jwtSecret,
      '1h'
    );

    const { password_hash: _, ...safeTarget } = targetUser;

    return successResponse(res, {
      token,
      target_user: safeTarget,
      is_impersonated: true,
      original_admin_id: adminId,
      expires_in: '1 hour'
    });
  } catch (err) {
    return errorResponse(res, { code: 'IMPERSONATE_FAILED', message: err.message }, 500);
  }
}

export async function getAuditLogs(req, res) {
  try {
    const { page = 1, limit = 30 } = req.query;
    const offset = (parseInt(page, 10) - 1) * parseInt(limit, 10);

    const { data, total } = await db.getAdminAuditLogs({
      limit: parseInt(limit, 10),
      offset
    });

    return successResponse(res, data, 200, {
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
      total_items: total,
      total_pages: Math.ceil(total / parseInt(limit, 10)) || 1
    });
  } catch (err) {
    return errorResponse(res, { code: 'GET_AUDIT_LOGS_FAILED', message: err.message }, 500);
  }
}

export async function getAiProviders(req, res) {
  try {
    const providers = await db.getAiProviders();
    const masked = providers.map(p => ({
      ...p,
      api_key_masked: p.api_key_encrypted ? '******' : null
    }));

    return successResponse(res, { providers: masked });
  } catch (err) {
    return errorResponse(res, { code: 'GET_AI_PROVIDERS_FAILED', message: err.message }, 500);
  }
}

export async function updateAiProvider(req, res) {
  try {
    const { id } = req.params;
    const { api_key, is_active, is_default, priority, timeout_ms, models } = req.body;

    const updates = {};
    if (api_key) {
      updates.api_key_encrypted = encryptApiKey(api_key, env.encryptionKey);
    }
    if (is_active !== undefined) updates.is_active = Boolean(is_active);
    if (is_default !== undefined) updates.is_default = Boolean(is_default);
    if (priority !== undefined) updates.priority = Number(priority);
    if (timeout_ms !== undefined) updates.timeout_ms = Number(timeout_ms);
    if (models !== undefined) updates.models = models;

    const updated = await db.updateAiProvider(id, updates);
    if (!updated) {
      return errorResponse(res, { code: 'NOT_FOUND', message: 'AI Provider tidak ditemukan' }, 404);
    }

    // Audit log
    await db.insertAdminAuditLog({
      adminId: req.user.id,
      action: 'update_ai_provider',
      details: { provider_id: id, name: updated.name }
    });

    return successResponse(res, {
      provider: {
        ...updated,
        api_key_masked: updated.api_key_encrypted ? '******' : null
      }
    });
  } catch (err) {
    return errorResponse(res, { code: 'UPDATE_AI_PROVIDER_FAILED', message: err.message }, 400);
  }
}

export async function getAiLogs(req, res) {
  try {
    const { page = 1, limit = 50 } = req.query;
    const offset = (parseInt(page, 10) - 1) * parseInt(limit, 10);

    const { data, total } = await db.getAiLogs({
      limit: parseInt(limit, 10),
      offset
    });

    return successResponse(res, data, 200, {
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
      total_items: total,
      total_pages: Math.ceil(total / parseInt(limit, 10)) || 1
    });
  } catch (err) {
    return errorResponse(res, { code: 'GET_AI_LOGS_FAILED', message: err.message }, 500);
  }
}

export async function manualApproveSubscription(req, res) {
  try {
    const adminId = req.user.id;
    const { id } = req.params; // subscription id or orderId

    let subscription = await db.getSubscriptionByOrderId(id);
    if (!subscription) {
      subscription = db.subscriptions.find(s => s.id === id);
    }

    if (!subscription) {
      return errorResponse(res, { code: 'NOT_FOUND', message: 'Data langganan tidak ditemukan' }, 404);
    }

    const updated = await db.updateSubscriptionStatus(subscription.order_id, {
      status: 'settlement',
      paymentType: 'manual_admin_approval'
    });

    // Log admin audit
    await db.insertAdminAuditLog({
      adminId,
      targetUserId: subscription.user_id,
      action: 'manual_approve_subscription',
      details: { order_id: subscription.order_id, plan_type: subscription.plan_type }
    });

    return successResponse(res, {
      message: 'Langganan berhasil disetujui secara manual',
      subscription: updated
    });
  } catch (err) {
    return errorResponse(res, { code: 'MANUAL_APPROVE_FAILED', message: err.message }, 500);
  }
}

export async function webhookSimulator(req, res) {
  try {
    const { type, payload } = req.body;

    if (!type) {
      return errorResponse(res, { code: 'VALIDATION_ERROR', message: "Parameter 'type' wajib disertakan" }, 400);
    }

    if (type === 'midtrans') {
      const orderId = payload?.order_id || `TTD-PRO-${Date.now()}`;
      const statusCode = payload?.status_code || '200';
      const grossAmount = payload?.gross_amount || '99000.00';
      const sig = generateMidtransSignature(orderId, statusCode, grossAmount, env.midtransServerKey);

      return successResponse(res, {
        simulated_payload: {
          order_id: orderId,
          status_code: statusCode,
          gross_amount: grossAmount,
          transaction_status: payload?.transaction_status || 'settlement',
          fraud_status: 'accept',
          signature_key: sig,
          payment_type: payload?.payment_type || 'qris'
        }
      });
    }

    return successResponse(res, {
      simulated: true,
      type,
      payload
    });
  } catch (err) {
    return errorResponse(res, { code: 'SIMULATOR_FAILED', message: err.message }, 500);
  }
}
