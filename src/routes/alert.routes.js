import express from 'express';
import { getAlerts, acknowledgeAlert, resolveAlert } from '../controllers/alert.controller.js';
import { protect, authorize } from '../middlewares/auth.middleware.js';

const router = express.Router();

router.use(protect);
router.get('/', authorize('MANAGER', 'ADMIN'), getAlerts);
router.post('/:alertId/acknowledge', authorize('MANAGER', 'ADMIN'), acknowledgeAlert);
router.post('/:alertId/resolve', authorize('MANAGER', 'ADMIN'), resolveAlert);

export default router;
