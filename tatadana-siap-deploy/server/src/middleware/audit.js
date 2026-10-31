/**
 * Administrative Audit Logging Middleware & Helpers
 */

import { db } from '../db/dbAdapter.js';

export function auditLogger(actionName) {
  return async (req, res, next) => {
    // Only audit if user is authenticated admin
    if (req.user && req.user.role === 'admin') {
      try {
        const ip = req.ip || req.headers['x-forwarded-for'] || req.socket?.remoteAddress;
        const userAgent = req.headers['user-agent'];
        await db.insertAdminAuditLog({
          adminId: req.user.id,
          targetUserId: req.body?.target_user_id || req.params?.userId || null,
          action: actionName,
          details: {
            method: req.method,
            path: req.originalUrl,
            params: req.params,
            query: req.query
          },
          ip,
          userAgent
        });
      } catch (err) {
        console.error('[auditLogger] Failed to write audit log:', err.message);
      }
    }
    next();
  };
}
