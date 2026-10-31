/**
 * Budgets Controller
 * Manages monthly category budget limits, percentage spent calculation,
 * and 80% / 100% threshold alert monitoring.
 */

import { db } from '../db/dbAdapter.js';
import { getCurrentMonthWIB } from '../utils/wibDate.js';
import { successResponse, errorResponse } from '../utils/response.js';

export async function getBudgets(req, res) {
  try {
    const userId = req.user.id;
    const { month, year } = req.query;

    const curWib = getCurrentMonthWIB();
    const targetMonth = month ? parseInt(month, 10) : curWib.month;
    const targetYear = year ? parseInt(year, 10) : curWib.year;

    const budgets = await db.getBudgets(userId, targetMonth, targetYear);

    const totalBudget = budgets.reduce((sum, b) => sum + Number(b.amount_limit || 0), 0);
    const totalSpent = budgets.reduce((sum, b) => sum + Number(b.spent_amount || 0), 0);

    return successResponse(res, {
      budgets,
      summary: {
        total_budget: totalBudget,
        total_spent: totalSpent,
        total_remaining: Math.max(0, totalBudget - totalSpent),
        overall_percentage: totalBudget > 0 ? Number(((totalSpent / totalBudget) * 100).toFixed(1)) : 0
      },
      period: {
        month: targetMonth,
        year: targetYear
      }
    });
  } catch (err) {
    return errorResponse(res, { code: 'GET_BUDGETS_FAILED', message: err.message }, 500);
  }
}

export async function createBudget(req, res) {
  try {
    const userId = req.user.id;
    const { category_id, month, year, amount_limit } = req.body;

    if (!amount_limit || Number(amount_limit) <= 0) {
      return errorResponse(res, { code: 'VALIDATION_ERROR', message: 'Batas nominal budget harus lebih dari 0' }, 400);
    }

    const curWib = getCurrentMonthWIB();
    const targetMonth = month ? parseInt(month, 10) : curWib.month;
    const targetYear = year ? parseInt(year, 10) : curWib.year;

    if (targetMonth < 1 || targetMonth > 12) {
      return errorResponse(res, { code: 'VALIDATION_ERROR', message: 'Bulan harus bernilai antara 1 dan 12' }, 400);
    }

    const budget = await db.createBudget(userId, {
      category_id: category_id || null,
      month: targetMonth,
      year: targetYear,
      amount_limit: Number(amount_limit)
    });

    return successResponse(res, { budget }, 201);
  } catch (err) {
    return errorResponse(res, { code: 'CREATE_BUDGET_FAILED', message: err.message }, 400);
  }
}

export async function updateBudget(req, res) {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    const { amount_limit } = req.body;

    if (amount_limit !== undefined && Number(amount_limit) <= 0) {
      return errorResponse(res, { code: 'VALIDATION_ERROR', message: 'Batas nominal budget harus lebih dari 0' }, 400);
    }

    const updated = await db.updateBudget(id, userId, { amount_limit });
    if (!updated) {
      return errorResponse(res, { code: 'NOT_FOUND', message: 'Budget tidak ditemukan' }, 404);
    }

    return successResponse(res, { budget: updated });
  } catch (err) {
    return errorResponse(res, { code: 'UPDATE_BUDGET_FAILED', message: err.message }, 400);
  }
}

export async function deleteBudget(req, res) {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    const deleted = await db.deleteBudget(id, userId);
    if (!deleted) {
      return errorResponse(res, { code: 'NOT_FOUND', message: 'Budget tidak ditemukan' }, 404);
    }

    return successResponse(res, { message: 'Budget berhasil dihapus' });
  } catch (err) {
    return errorResponse(res, { code: 'DELETE_BUDGET_FAILED', message: err.message }, 400);
  }
}
