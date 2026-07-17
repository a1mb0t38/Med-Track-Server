import { Router } from 'express';
import { getTodayDoses, updateDoseStatus, getAdherenceHistory } from '../controllers/doseLogController';
import { authenticateUser } from '../middleware/auth';

const router = Router();

// Protect all dose routes with authentication
router.use(authenticateUser);

// GET /api/doses/today
router.get('/today', getTodayDoses);

// GET /api/doses/adherence
router.get('/adherence', getAdherenceHistory);

// PUT /api/doses/:id/status
router.put('/:id/status', updateDoseStatus);

export default router;
