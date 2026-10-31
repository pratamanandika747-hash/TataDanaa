/**
 * Wallets Controller
 * Handles Multi-Wallet CRUD operations and calculates total consolidated net worth.
 */

import { db } from '../db/dbAdapter.js';
import { successResponse, errorResponse } from '../utils/response.js';

export async function getWallets(req, res) {
  try {
    const userId = req.user.id;
    const wallets = await db.getWalletsByUserId(userId);

    const totalBalance = wallets.reduce((sum, w) => sum + Number(w.balance || 0), 0);

    return successResponse(res, {
      wallets,
      total_balance: Number(totalBalance.toFixed(2)),
      count: wallets.length
    });
  } catch (err) {
    return errorResponse(res, { code: 'GET_WALLETS_FAILED', message: err.message }, 500);
  }
}

export async function createWallet(req, res) {
  try {
    const userId = req.user.id;
    const { name, type, balance, color, icon, is_default } = req.body;

    if (!name) {
      return errorResponse(res, { code: 'VALIDATION_ERROR', message: 'Nama dompet wajib diisi' }, 400);
    }

    const validTypes = ['bank', 'e-wallet', 'cash', 'investment', 'credit_card', 'other'];
    if (type && !validTypes.includes(type)) {
      return errorResponse(res, { code: 'VALIDATION_ERROR', message: `Tipe dompet harus salah satu dari: ${validTypes.join(', ')}` }, 400);
    }

    const wallet = await db.createWallet(userId, {
      name,
      type: type || 'bank',
      balance: Number(balance) || 0,
      color: color || '#FF5B00',
      icon: icon || 'wallet',
      is_default: Boolean(is_default)
    });

    return successResponse(res, { wallet }, 201);
  } catch (err) {
    return errorResponse(res, { code: 'CREATE_WALLET_FAILED', message: err.message }, 400);
  }
}

export async function updateWallet(req, res) {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    const { name, type, color, icon, is_default } = req.body;

    const updates = {};
    if (name !== undefined) updates.name = name;
    if (type !== undefined) updates.type = type;
    if (color !== undefined) updates.color = color;
    if (icon !== undefined) updates.icon = icon;
    if (is_default !== undefined) updates.is_default = Boolean(is_default);

    const updated = await db.updateWallet(id, userId, updates);
    if (!updated) {
      return errorResponse(res, { code: 'NOT_FOUND', message: 'Dompet tidak ditemukan' }, 404);
    }

    return successResponse(res, { wallet: updated });
  } catch (err) {
    return errorResponse(res, { code: 'UPDATE_WALLET_FAILED', message: err.message }, 400);
  }
}

export async function deleteWallet(req, res) {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    const deleted = await db.deleteWallet(id, userId);
    if (!deleted) {
      return errorResponse(res, { code: 'NOT_FOUND', message: 'Dompet tidak ditemukan' }, 404);
    }

    return successResponse(res, { message: 'Dompet berhasil dihapus' });
  } catch (err) {
    return errorResponse(res, { code: 'DELETE_WALLET_FAILED', message: err.message }, 400);
  }
}
