import { Router } from 'express';
import {
  getMetrics,
  getUsers,
  impersonateUser,
  getAuditLogs,
  getAiProviders,
  updateAiProvider,
  getAiLogs,
  manualApproveSubscription,
  webhookSimulator
} from '../controllers/adminController.js';
import { authenticate, requireAdmin } from '../middleware/auth.js';
import { auditLogger } from '../middleware/audit.js';

const router = Router();

// All admin routes require authentication and admin role
router.use(authenticate, requireAdmin);

router.get('/metrics', getMetrics);
router.get('/users', getUsers);
router.post('/impersonate', impersonateUser);
router.get('/audit-logs', getAuditLogs);
router.get('/ai-providers', getAiProviders);
router.put('/ai-providers/:id', updateAiProvider);
router.get('/ai-logs', getAiLogs);
router.post('/subscriptions/:id/manual-approve', auditLogger('manual_approve_subscription'), manualApproveSubscription);
router.post('/webhook-simulator', webhookSimulator);

export default router;
