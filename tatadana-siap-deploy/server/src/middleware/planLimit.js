/**
 * Plan Enforcement Middleware (Starter vs Pro)
 * Enforces:
 * - Starter limit: max 50 transactions per WIB calendar month
 * - Starter limit: max 3 wallets
 * - Starter limit: max 5 custom categories
 * - Pro gating: OCR, STT, AI Advisor, PDF/Excel Exports
 */

import { db } from '../db/dbAdapter.js';
import { errorResponse } from '../utils/response.js';

export function requirePlanLimit(feature) {
  return async (req, res, next) => {
    try {
      const userId = req.user.id;
      const profile = await db.findProfileById(userId);

      if (!profile) {
        return errorResponse(res, { code: 'USER_NOT_FOUND', message: 'User tidak ditemukan' }, 404);
      }

      // Pro users bypass all numerical quotas and limitations
      if (profile.plan === 'pro') {
        return next();
      }

      // 1. Transaction Limit (Starter: 50 / calendar month in WIB)
      if (feature === 'transactions') {
        const currentCount = await db.countTransactionsInCurrentMonthWib(userId);
        if (currentCount >= 50) {
          return errorResponse(res, {
            code: 'PLAN_LIMIT_EXCEEDED',
            message: 'Batas 50 transaksi bulanan Starter telah tercapai. Upgrade ke Pro untuk akses tanpa batas!',
            feature: 'transactions',
            limit: 50,
            current: currentCount,
            upgrade_url: '/dashboard/pricing'
          }, 403);
        }
      }

      // 2. Wallets Limit (Starter: max 3)
      if (feature === 'wallets') {
        const walletCount = await db.countWallets(userId);
        if (walletCount >= 3) {
          return errorResponse(res, {
            code: 'PLAN_LIMIT_EXCEEDED',
            message: 'Paket Starter dibatasi maksimal 3 dompet. Upgrade ke Pro untuk dompet tanpa batas!',
            feature: 'wallets',
            limit: 3,
            current: walletCount,
            upgrade_url: '/dashboard/pricing'
          }, 403);
        }
      }

      // 3. Custom Categories Limit (Starter: max 5)
      if (feature === 'categories') {
        const customCount = await db.countCustomCategories(userId);
        if (customCount >= 5) {
          return errorResponse(res, {
            code: 'PLAN_LIMIT_EXCEEDED',
            message: 'Paket Starter dibatasi maksimal 5 kategori kustom. Upgrade ke Pro untuk kategori tanpa batas!',
            feature: 'categories',
            limit: 5,
            current: customCount,
            upgrade_url: '/dashboard/pricing'
          }, 403);
        }
      }

      next();
    } catch (err) {
      return errorResponse(res, {
        code: 'PLAN_CHECK_ERROR',
        message: err.message
      }, 500);
    }
  };
}

export function requirePlan(requiredPlan) {
  return async (req, res, next) => {
    try {
      const userId = req.user.id;
      const profile = await db.findProfileById(userId);

      if (!profile) {
        return errorResponse(res, { code: 'USER_NOT_FOUND', message: 'User tidak ditemukan' }, 404);
      }

      if (profile.plan !== requiredPlan && profile.plan !== 'pro') {
        return errorResponse(res, {
          code: 'FEATURE_GATED',
          message: `Fitur ini khusus untuk pengguna paket ${requiredPlan.toUpperCase()}. Silakan upgrade akun Anda.`,
          required_plan: requiredPlan,
          current_plan: profile.plan,
          upgrade_url: '/dashboard/pricing'
        }, 403);
      }

      next();
    } catch (err) {
      return errorResponse(res, {
        code: 'PLAN_CHECK_ERROR',
        message: err.message
      }, 500);
    }
  };
}
