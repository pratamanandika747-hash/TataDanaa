/**
 * Admin Dashboard Management Routes for TataDana
 * Features: AI Providers & Keys Config, Failover/Single Toggle, Audit Logs,
 * AI Request Metrics Logs, Export All User Data, Midtrans Approval Queue.
 */

import { Router } from 'express';
import { inMemoryStore } from '../store/inMemoryStore.js';
import { authMiddleware, requireAdmin } from '../middlewares/auth.js';
import { midtransService } from '../services/midtransService.js';
import { toWIBISOString } from '../utils/timezone.js';

const router = Router();
router.use(authMiddleware);
router.use(requireAdmin);

// 1. Get AI Providers & Global AI Settings
router.get('/ai-providers', (req, res) => {
  res.json({
    success: true,
    data: inMemoryStore.aiProviders,
    mode: inMemoryStore.systemSettings?.ai_mode || { mode: 'failover', timeout_ms: 7000 }
  });
});

// Update AI Provider Settings / API Keys
router.put('/ai-providers/:providerKey', (req, res) => {
  const { providerKey } = req.params;
  const { isActive, isPrimary, failoverOrder, modelName, apiKey } = req.body;

  const provider = inMemoryStore.aiProviders.find(p => p.provider_key === providerKey);
  if (!provider) {
    return res.status(404).json({ success: false, error: 'Provider AI tidak ditemukan' });
  }

  if (isActive !== undefined) provider.is_active = Boolean(isActive);
  if (isPrimary !== undefined) provider.is_primary = Boolean(isPrimary);
  if (failoverOrder !== undefined) provider.failover_order = Number(failoverOrder);
  if (modelName) provider.model_name = modelName;
  if (apiKey) {
    provider.api_key_masked = apiKey.slice(0, 6) + '...****';
  }

  // Audit log
  inMemoryStore.adminAuditLogs.unshift({
    id: 'al' + Math.random().toString(36).substring(2, 9),
    admin_id: req.user.id,
    action: 'update_ai_key',
    target_user_id: null,
    details: { providerKey, modelName, isActive },
    created_at: toWIBISOString()
  });

  res.json({
    success: true,
    data: provider
  });
});

// Update Global AI Mode (Single vs Failover)
router.post('/ai-mode', (req, res) => {
  const { mode, timeoutMs } = req.body;
  if (!['single', 'failover'].includes(mode)) {
    return res.status(400).json({ success: false, error: 'Mode harus single atau failover' });
  }

  inMemoryStore.systemSettings.ai_mode = {
    mode,
    timeout_ms: timeoutMs || 7000
  };

  res.json({
    success: true,
    data: inMemoryStore.systemSettings.ai_mode
  });
});

// 2. AI Request Logs
router.get('/ai-logs', (req, res) => {
  const page = parseInt(req.query.page || 1, 10);
  const limit = parseInt(req.query.limit || 50, 10);
  const startIndex = (page - 1) * limit;

  const total = inMemoryStore.aiLogs.length;
  const logs = inMemoryStore.aiLogs.slice(startIndex, startIndex + limit);

  res.json({
    success: true,
    data: logs,
    pagination: { total, page, limit }
  });
});

// 3. Admin Audit Logs
router.get('/audit-logs', (req, res) => {
  const logs = inMemoryStore.adminAuditLogs.map(log => {
    const admin = inMemoryStore.profiles.find(p => p.id === log.admin_id);
    const target = inMemoryStore.profiles.find(p => p.id === log.target_user_id);
    return {
      ...log,
      admin_name: admin?.full_name || 'Admin',
      target_user_name: target?.full_name || null
    };
  });

  res.json({
    success: true,
    data: logs
  });
});

// 4. Pending Midtrans Payments & Approval Queue
router.get('/pending-payments', (req, res) => {
  const pending = inMemoryStore.subscriptions
    .filter(s => s.status === 'pending')
    .map(s => {
      const u = inMemoryStore.profiles.find(p => p.id === s.user_id);
      return {
        ...s,
        user_name: u?.full_name || 'Pengguna',
        user_email: u?.email || u?.phone_number
      };
    });

  res.json({
    success: true,
    data: pending
  });
});

// Manual Payment Approve / Reject
router.post('/payments/:subscriptionId/:action', async (req, res) => {
  const { subscriptionId, action } = req.params;
  if (!['approve', 'reject'].includes(action)) {
    return res.status(400).json({ success: false, error: 'Aksi tidak valid' });
  }

  try {
    const updated = await midtransService.adminManualAction(subscriptionId, req.user.id, action);
    res.json({ success: true, data: updated });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 5. Export All User Data
router.get('/export-all-users', (req, res) => {
  // Audit log
  inMemoryStore.adminAuditLogs.unshift({
    id: 'al' + Math.random().toString(36).substring(2, 9),
    admin_id: req.user.id,
    action: 'export_users',
    details: { totalUsers: inMemoryStore.profiles.length },
    created_at: toWIBISOString()
  });

  const fullData = {
    exportedAt: toWIBISOString(),
    profiles: inMemoryStore.profiles,
    wallets: inMemoryStore.wallets,
    transactions: inMemoryStore.transactions,
    budgets: inMemoryStore.budgets,
    subscriptions: inMemoryStore.subscriptions
  };

  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', 'attachment; filename="tatadana_full_export.json"');
  res.send(JSON.stringify(fullData, null, 2));
});

export default router;
