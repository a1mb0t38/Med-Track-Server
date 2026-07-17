import { Router } from 'express';
import {
  createMedicine,
  getMedicines,
  getMedicineById,
  updateMedicine,
  deleteMedicine
} from '../controllers/medicineController';
import { authenticateUser } from '../middleware/auth';

const router = Router();

// Apply authentication middleware to all medicine routes
router.use(authenticateUser);

router.post('/', createMedicine);
router.get('/', getMedicines);
router.get('/:id', getMedicineById);
router.put('/:id', updateMedicine);
router.delete('/:id', deleteMedicine);

export default router;
