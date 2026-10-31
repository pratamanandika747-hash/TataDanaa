import { Router } from 'express';
import authRoutes from './authRoutes.js';
import walletRoutes from './walletRoutes.js';
import categoryRoutes from './categoryRoutes.js';
import transactionRoutes from './transactionRoutes.js';
import budgetRoutes from './budgetRoutes.js';
import subscriptionRoutes from './subscriptionRoutes.js';
import adminRoutes from './adminRoutes.js';
import { toWIBISOString } from '../utils/wibDate.js';
import { isSupabaseConfigured } from '../config/supabase.js';

const apiRouter = Router();

// Health Check
apiRouter.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'tatadana-api',
    timezone: 'Asia/Jakarta (WIB)',
    timestamp: toWIBISOString(),
    database: isSupabaseConfigured ? 'supabase' : 'local_store_adapter'
  });
});

// Mount Routes
apiRouter.use('/auth', authRoutes);
apiRouter.use('/wallets', walletRoutes);
apiRouter.use('/categories', categoryRoutes);
apiRouter.use('/transactions', transactionRoutes);
apiRouter.use('/budgets', budgetRoutes);
apiRouter.use('/subscriptions', subscriptionRoutes);
apiRouter.use('/admin', adminRoutes);

export default apiRouter;
