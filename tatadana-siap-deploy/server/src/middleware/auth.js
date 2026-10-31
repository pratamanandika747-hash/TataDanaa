/**
 * Authentication Middleware
 * Validates JWT tokens and attaches authenticated profile to req.user.
 * Also checks for admin role and handles impersonation context.
 */

import { verifyJwtToken } from '../utils/crypto.js';
import { db } from '../db/dbAdapter.js';
import { errorResponse } from '../utils/response.js';

export async function authenticate(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return errorResponse(res, {
        code: 'UNAUTHORIZED',
        message: 'Akses ditolak: token otentikasi tidak ditemukan'
      }, 401);
    }

    const token = authHeader.split(' ')[1];
    const decoded = verifyJwtToken(token);

    if (!decoded || !decoded.sub) {
      return errorResponse(res, {
        code: 'INVALID_TOKEN',
        message: 'Token otentikasi tidak valid atau telah kedaluwarsa'
      }, 401);
    }

    const profile = await db.findProfileById(decoded.sub);
    if (!profile) {
      return errorResponse(res, {
        code: 'USER_NOT_FOUND',
        message: 'Pengguna tidak ditemukan'
      }, 401);
    }

    // Attach profile and claims
    req.user = {
      ...profile,
      is_impersonated: Boolean(decoded.is_impersonated),
      original_admin_id: decoded.original_admin_id || null
    };

    next();
  } catch (err) {
    return errorResponse(res, {
      code: 'AUTH_ERROR',
      message: err.message
    }, 401);
  }
}

export function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'admin') {
    return errorResponse(res, {
      code: 'FORBIDDEN',
      message: 'Akses khusus administrator'
    }, 403);
  }
  next();
}
