/**
 * Categories Controller
 * Handles System Categories & Custom Categories CRUD operations.
 */

import { db } from '../db/dbAdapter.js';
import { successResponse, errorResponse } from '../utils/response.js';

export async function getCategories(req, res) {
  try {
    const userId = req.user.id;
    const categories = await db.getCategories(userId);

    const expenseCategories = categories.filter(c => c.type === 'expense');
    const incomeCategories = categories.filter(c => c.type === 'income');

    return successResponse(res, {
      categories,
      expense: expenseCategories,
      income: incomeCategories,
      total_count: categories.length
    });
  } catch (err) {
    return errorResponse(res, { code: 'GET_CATEGORIES_FAILED', message: err.message }, 500);
  }
}

export async function createCategory(req, res) {
  try {
    const userId = req.user.id;
    const { name, type, icon, color } = req.body;

    if (!name || !type) {
      return errorResponse(res, { code: 'VALIDATION_ERROR', message: 'Nama dan tipe kategori wajib diisi' }, 400);
    }

    if (!['expense', 'income'].includes(type)) {
      return errorResponse(res, { code: 'VALIDATION_ERROR', message: "Tipe kategori harus 'expense' atau 'income'" }, 400);
    }

    const category = await db.createCategory(userId, {
      name,
      type,
      icon: icon || 'tag',
      color: color || '#F97316'
    });

    return successResponse(res, { category }, 201);
  } catch (err) {
    return errorResponse(res, { code: 'CREATE_CATEGORY_FAILED', message: err.message }, 400);
  }
}

export async function updateCategory(req, res) {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    const { name, icon, color } = req.body;

    const updates = {};
    if (name !== undefined) updates.name = name;
    if (icon !== undefined) updates.icon = icon;
    if (color !== undefined) updates.color = color;

    const updated = await db.updateCategory(id, userId, updates);
    if (!updated) {
      return errorResponse(res, { code: 'NOT_FOUND', message: 'Kategori kustom tidak ditemukan atau kategori sistem tidak dapat diedit' }, 404);
    }

    return successResponse(res, { category: updated });
  } catch (err) {
    return errorResponse(res, { code: 'UPDATE_CATEGORY_FAILED', message: err.message }, 400);
  }
}

export async function deleteCategory(req, res) {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    const deleted = await db.deleteCategory(id, userId);
    if (!deleted) {
      return errorResponse(res, { code: 'NOT_FOUND', message: 'Kategori kustom tidak ditemukan atau kategori sistem tidak dapat dihapus' }, 404);
    }

    return successResponse(res, { message: 'Kategori kustom berhasil dihapus' });
  } catch (err) {
    return errorResponse(res, { code: 'DELETE_CATEGORY_FAILED', message: err.message }, 400);
  }
}
