import { Router } from 'express';
import {
  getTransactions,
  getTransactionById,
  createTransaction,
  updateTransaction,
  deleteTransaction,
  getTransactionSummary
} from '../controllers/transactionController.js';
import { authenticate } from '../middleware/auth.js';
import { requirePlanLimit } from '../middleware/planLimit.js';

const router = Router();

router.use(authenticate);

router.get('/', getTransactions);
router.get('/summary', getTransactionSummary);
router.get('/:id', getTransactionById);
router.post('/', requirePlanLimit('transactions'), createTransaction);
router.put('/:id', updateTransaction);
router.delete('/:id', deleteTransaction);

export default router;
