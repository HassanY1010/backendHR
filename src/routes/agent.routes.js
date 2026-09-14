import express from 'express';
import { protect, authorize } from '../middlewares/auth.middleware.js';
import {
    runAgentSweep,
    getAgentTasks,
    getAgentLogs,
    executeAgentAction
} from '../controllers/agent.controller.js';

const router = express.Router();

// All agent routes are strictly protected with JWT authentication
router.use(protect);

// 1. Trigger agent run (Admins & Managers)
router.post('/run', authorize('ADMIN', 'MANAGER', 'SUPER_ADMIN'), runAgentSweep);

// 2. Fetch agent tasks
router.get('/tasks', authorize('ADMIN', 'MANAGER', 'SUPER_ADMIN'), getAgentTasks);

// 3. Fetch agent logs / recommendations
router.get('/logs', authorize('ADMIN', 'MANAGER', 'SUPER_ADMIN'), getAgentLogs);

// 4. Human-in-the-loop action approval & execution
router.post('/actions/:id/execute', authorize('ADMIN', 'MANAGER', 'SUPER_ADMIN'), executeAgentAction);

export default router;
