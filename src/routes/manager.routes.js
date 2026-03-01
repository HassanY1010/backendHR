import express from 'express';
import { protect, authorize } from '../middlewares/auth.middleware.js';
import { getDashboardStats, get30x3Insights } from '../controllers/analytics.controller.js';
import {
    createJob,
    uploadResume
} from '../controllers/recruitment.controller.js';

const router = express.Router();

// All routes require MANAGER or SUPER_ADMIN role
router.use(protect);
router.use(authorize('MANAGER', 'SUPER_ADMIN'));

// Dashboard & Insights
router.get('/overview', getDashboardStats);
router.get('/insights/30x3', get30x3Insights);

// Recruitment
router.post('/jobs', createJob);
router.post('/candidates/upload-cv', uploadResume);

export default router;
