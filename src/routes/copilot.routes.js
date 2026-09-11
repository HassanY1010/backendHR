import express from 'express';
import { protect, authorize } from '../middlewares/auth.middleware.js';
import {
    chatWithCopilot,
    createJobFromCopilot,
    searchCandidatesWithCopilot,
    getCopilotSessions,
    getCopilotSessionDetails
} from '../controllers/copilot.controller.js';

const router = express.Router();

// All Copilot routes require Authentication and Manager or Super Admin role
router.use(protect);
router.use(authorize('MANAGER', 'SUPER_ADMIN', 'ADMIN'));

router.post('/chat', chatWithCopilot);
router.post('/create-job', createJobFromCopilot);
router.post('/search-candidates', searchCandidatesWithCopilot);
router.get('/sessions', getCopilotSessions);
router.get('/sessions/:id', getCopilotSessionDetails);

export default router;
