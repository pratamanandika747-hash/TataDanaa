import { Router } from 'express';
import {
  getWallets,
  createWallet,
  updateWallet,
  deleteWallet
} from '../controllers/walletController.js';
import { authenticate } from '../middleware/auth.js';
import { requirePlanLimit } from '../middleware/planLimit.js';

const router = Router();

router.use(authenticate);

router.get('/', getWallets);
router.post('/', requirePlanLimit('wallets'), createWallet);
router.put('/:id', updateWallet);
router.delete('/:id', deleteWallet);

export default router;
