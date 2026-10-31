import { Router } from 'express';
import {
  getCategories,
  createCategory,
  updateCategory,
  deleteCategory
} from '../controllers/categoryController.js';
import { authenticate } from '../middleware/auth.js';
import { requirePlanLimit } from '../middleware/planLimit.js';

const router = Router();

router.use(authenticate);

router.get('/', getCategories);
router.post('/', requirePlanLimit('categories'), createCategory);
router.put('/:id', updateCategory);
router.delete('/:id', deleteCategory);

export default router;
