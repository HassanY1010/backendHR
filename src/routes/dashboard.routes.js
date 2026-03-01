import express from 'express';
import { getManagerDashboard } from '../controllers/dashboard.controller.js';
import { protect, authorize } from '../middlewares/auth.middleware.js';

const router = express.Router();

router.use(protect);
router.get('/manager', authorize('MANAGER', 'ADMIN'), getManagerDashboard);

export default router;
