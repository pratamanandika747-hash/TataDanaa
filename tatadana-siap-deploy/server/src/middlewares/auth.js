/**
 * Authentication & Impersonation Middleware for TataDana
 */

import { inMemoryStore } from '../store/inMemoryStore.js';

export function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  const impersonateUserId = req.headers['x-impersonate-user-id'];

  let activeUser = null;

  // 1. Resolve base authenticated user
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    // Check if token corresponds to user id or demo user
    activeUser = inMemoryStore.profiles.find(p => p.id === token || p.email === token);
  }

  // Fallback to demo Pro user if no token provided in development mode
  if (!activeUser) {
    activeUser = inMemoryStore.profiles.find(p => p.role === 'admin') || inMemoryStore.profiles[0];
  }

  // 2. Superadmin Impersonation Handling
  if (impersonateUserId && activeUser?.role === 'admin') {
    const targetUser = inMemoryStore.profiles.find(p => p.id === impersonateUserId);
    if (targetUser) {
      req.originalAdmin = activeUser;
      req.isImpersonating = true;
      req.user = targetUser;
      return next();
    }
  }

  req.user = activeUser;
  req.isImpersonating = false;
  next();
}

/**
 * Require Superadmin role middleware
 */
export function requireAdmin(req, res, next) {
  const effectiveAdmin = req.originalAdmin || req.user;
  if (!effectiveAdmin || effectiveAdmin.role !== 'admin') {
    return res.status(403).json({
      success: false,
      error: 'Akses ditolak: Hanya Superadmin yang berhak mengakses menu ini.'
    });
  }
  next();
}
