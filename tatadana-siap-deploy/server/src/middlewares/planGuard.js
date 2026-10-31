/**
 * Plan Guard & Quota Enforcement Middleware
 * Enforces Starter (Rp49k/mo) vs Pro (Rp99k lifetime) limits:
 * - Starter: 50 tx/month, 3 wallets, 5 budgets, no OCR, no voice STT, no AI advisor, no export.
 * - Pro: Unlimited everything.
 */

import { inMemoryStore } from '../store/inMemoryStore.js';
import { config } from '../config/index.js';

export const planGuard = {
  /**
   * Check if user can create a new transaction
   */
  canCreateTransaction: (req, res, next) => {
    const user = req.user;
    if (!user) return res.status(401).json({ success: false, error: 'Unauthorized' });

    if (user.plan === 'pro') return next();

    const limit = config.pricing.starter.monthlyTxLimit;
    const currentCount = user.monthly_tx_count || 0;

    if (currentCount >= limit) {
      return res.status(403).json({
        success: false,
        code: 'PLAN_LIMIT_REACHED',
        error: `Batas transaksi paket Starter (${limit} tx/bulan) telah tercapai. Upgrade ke TataDana Pro untuk transaksi tanpa batas seumur hidup!`,
        upgradeUrl: '/upgrade'
      });
    }

    next();
  },

  /**
   * Check if user can create a new wallet
   */
  canCreateWallet: (req, res, next) => {
    const user = req.user;
    if (!user) return res.status(401).json({ success: false, error: 'Unauthorized' });

    if (user.plan === 'pro') return next();

    const maxWallets = config.pricing.starter.maxWallets;
    const userWallets = inMemoryStore.wallets.filter(w => w.user_id === user.id);

    if (userWallets.length >= maxWallets) {
      return res.status(403).json({
        success: false,
        code: 'PLAN_LIMIT_REACHED',
        error: `Paket Starter dibatasi maksimal ${maxWallets} dompet. Upgrade ke Pro untuk dompet tanpa batas!`,
        upgradeUrl: '/upgrade'
      });
    }

    next();
  },

  /**
   * Check if user can create a new budget
   */
  canCreateBudget: (req, res, next) => {
    const user = req.user;
    if (!user) return res.status(401).json({ success: false, error: 'Unauthorized' });

    if (user.plan === 'pro') return next();

    const maxBudgets = config.pricing.starter.maxBudgets;
    const userBudgets = inMemoryStore.budgets.filter(b => b.user_id === user.id);

    if (userBudgets.length >= maxBudgets) {
      return res.status(403).json({
        success: false,
        code: 'PLAN_LIMIT_REACHED',
        error: `Paket Starter dibatasi maksimal ${maxBudgets} target anggaran. Upgrade ke Pro untuk anggaran tanpa batas!`,
        upgradeUrl: '/upgrade'
      });
    }

    next();
  },

  /**
   * Check if user can export PDF or Excel
   */
  canExport: (req, res, next) => {
    const user = req.user;
    if (!user) return res.status(401).json({ success: false, error: 'Unauthorized' });

    if (user.plan !== 'pro') {
      return res.status(403).json({
        success: false,
        code: 'FEATURE_LOCKED_PRO',
        error: 'Ekspor laporan PDF & Excel adalah fitur eksklusif TataDana Pro. Upgrade sekarang hanya Rp 99.000 sekali bayar!',
        upgradeUrl: '/upgrade'
      });
    }

    next();
  },

  /**
   * Check if user can use receipt OCR or voice note
   */
  canUseMultimodal: (req, res, next) => {
    const user = req.user;
    if (!user) return res.status(401).json({ success: false, error: 'Unauthorized' });

    if (user.plan !== 'pro') {
      return res.status(403).json({
        success: false,
        code: 'FEATURE_LOCKED_PRO',
        error: 'Fitur Scan Struk OCR & Voice Note hanya tersedia bagi pengguna TataDana Pro.',
        upgradeUrl: '/upgrade'
      });
    }

    next();
  }
};
