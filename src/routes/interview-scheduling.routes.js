import { Router } from 'express';
import {
    createSchedulingSession,
    getSessionDetails,
    getAvailableSlotsForToken,
    bookInterview,
    rescheduleInterview,
    cancelInterview,
    updateInterviewStatus,
    processInterviewReminders
} from '../controllers/interview-scheduling.controller.js';
import { protect, authorize, requireCompanyContext } from '../middlewares/auth.middleware.js';
import { recruitmentPublicLimiter } from '../middlewares/rate-limit.middleware.js';

const router = Router();

// ==========================================
// 1. PUBLIC CANDIDATE ENDPOINTS (Rate Limited)
// ==========================================
router.get('/session/:token', recruitmentPublicLimiter, getSessionDetails);
router.get('/available-slots/:token', recruitmentPublicLimiter, getAvailableSlotsForToken);
router.post('/book', recruitmentPublicLimiter, bookInterview);

// ==========================================
// 2. PROTECTED RECRUITER / MANAGER ENDPOINTS
// ==========================================
router.use(protect);
router.use(requireCompanyContext);

const SCHEDULING_ROLES = ['SUPER_ADMIN', 'ADMIN', 'HR_MANAGER', 'RECRUITER', 'MANAGER'];

router.post('/scheduling-session', authorize(...SCHEDULING_ROLES), createSchedulingSession);
router.put('/:id/reschedule', authorize(...SCHEDULING_ROLES), rescheduleInterview);
router.delete('/:id/cancel', authorize(...SCHEDULING_ROLES), cancelInterview);
router.put('/:id/status', authorize(...SCHEDULING_ROLES), updateInterviewStatus);
router.post('/cron/reminders', authorize(...SCHEDULING_ROLES), processInterviewReminders);

export default router;
