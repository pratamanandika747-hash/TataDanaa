/**
 * Transactions Controller
 * Manages financial transactions, multi-item receipt breakdown,
 * WIB timezone enforcement, and analytical metrics summary.
 */

import { db } from '../db/dbAdapter.js';
import { normalizeDateWIB } from '../utils/wibDate.js';
import { successResponse, errorResponse } from '../utils/response.js';

export async function getTransactions(req, res) {
  try {
    const userId = req.user.id;
    const {
      page = 1,
      limit = 20,
      search = '',
      startDate = '',
      endDate = '',
      walletId = '',
      categoryId = '',
      type = ''
    } = req.query;

    const result = await db.getTransactions(userId, {
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
      search,
      startDate,
      endDate,
      walletId,
      categoryId,
      type
    });

    return successResponse(res, result.data, 200, result.pagination);
  } catch (err) {
    return errorResponse(res, { code: 'GET_TRANSACTIONS_FAILED', message: err.message }, 500);
  }
}

export async function getTransactionById(req, res) {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    const transaction = await db.getTransactionById(id, userId);
    if (!transaction) {
      return errorResponse(res, { code: 'NOT_FOUND', message: 'Transaksi tidak ditemukan' }, 404);
    }

    return successResponse(res, { transaction });
  } catch (err) {
    return errorResponse(res, { code: 'GET_TRANSACTION_FAILED', message: err.message }, 500);
  }
}

export async function createTransaction(req, res) {
  try {
    const userId = req.user.id;
    const {
      wallet_id,
      category_id,
      type,
      amount,
      date,
      notes,
      source,
      merchant_name,
      receipt_url,
      items,
      transfer_wallet_id
    } = req.body;

    if (!wallet_id || !type || amount === undefined) {
      return errorResponse(res, {
        code: 'VALIDATION_ERROR',
        message: 'wallet_id, type, dan amount wajib diisi'
      }, 400);
    }

    if (!['expense', 'income', 'transfer'].includes(type)) {
      return errorResponse(res, {
        code: 'VALIDATION_ERROR',
        message: "Tipe transaksi harus salah satu dari: 'expense', 'income', 'transfer'"
      }, 400);
    }

    if (type === 'transfer' && !transfer_wallet_id) {
      return errorResponse(res, {
        code: 'VALIDATION_ERROR',
        message: 'transfer_wallet_id wajib diisi untuk transaksi transfer'
      }, 400);
    }

    if (type !== 'transfer' && !category_id) {
      return errorResponse(res, {
        code: 'VALIDATION_ERROR',
        message: 'category_id wajib diisi untuk pemasukan dan pengeluaran'
      }, 400);
    }

    const txDate = normalizeDateWIB(date);

    const transaction = await db.createTransaction(userId, {
      wallet_id,
      category_id,
      type,
      amount,
      date: txDate,
      notes,
      source: source || 'web',
      merchant_name,
      receipt_url,
      items: Array.isArray(items) ? items : [],
      transfer_wallet_id
    });

    return successResponse(res, { transaction }, 201);
  } catch (err) {
    return errorResponse(res, { code: 'CREATE_TRANSACTION_FAILED', message: err.message }, 400);
  }
}

export async function updateTransaction(req, res) {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    const {
      wallet_id,
      category_id,
      type,
      amount,
      date,
      notes,
      merchant_name,
      receipt_url,
      items,
      transfer_wallet_id
    } = req.body;

    const updates = {};
    if (wallet_id !== undefined) updates.wallet_id = wallet_id;
    if (category_id !== undefined) updates.category_id = category_id;
    if (type !== undefined) updates.type = type;
    if (amount !== undefined) updates.amount = Number(amount);
    if (date !== undefined) updates.date = normalizeDateWIB(date);
    if (notes !== undefined) updates.notes = notes;
    if (merchant_name !== undefined) updates.merchant_name = merchant_name;
    if (receipt_url !== undefined) updates.receipt_url = receipt_url;
    if (items !== undefined) updates.items = Array.isArray(items) ? items : [];
    if (transfer_wallet_id !== undefined) updates.transfer_wallet_id = transfer_wallet_id;

    const updated = await db.updateTransaction(id, userId, updates);
    if (!updated) {
      return errorResponse(res, { code: 'NOT_FOUND', message: 'Transaksi tidak ditemukan' }, 404);
    }

    return successResponse(res, { transaction: updated });
  } catch (err) {
    return errorResponse(res, { code: 'UPDATE_TRANSACTION_FAILED', message: err.message }, 400);
  }
}

export async function deleteTransaction(req, res) {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    const deleted = await db.deleteTransaction(id, userId);
    if (!deleted) {
      return errorResponse(res, { code: 'NOT_FOUND', message: 'Transaksi tidak ditemukan' }, 404);
    }

    return successResponse(res, { message: 'Transaksi berhasil dihapus' });
  } catch (err) {
    return errorResponse(res, { code: 'DELETE_TRANSACTION_FAILED', message: err.message }, 400);
  }
}

export async function getTransactionSummary(req, res) {
  try {
    const userId = req.user.id;
    const { startDate, endDate, walletId } = req.query;

    const summary = await db.getTransactionSummary(userId, {
      startDate,
      endDate,
      walletId
    });

    return successResponse(res, summary);
  } catch (err) {
    return errorResponse(res, { code: 'GET_SUMMARY_FAILED', message: err.message }, 500);
  }
}
