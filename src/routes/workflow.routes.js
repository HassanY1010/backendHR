import express from 'express';
import { protect as authenticate } from '../middlewares/auth.middleware.js';

import {
    getTemplates,
    createTemplate,
    updateTemplate,
    getWorkflowInstance,
    advanceStep,
    rejectStep,
    addComment,
    getWorkflowDashboard,
    getSLABreaches,
    getWorkflowLogs,
    resetTestData
} from '../controllers/workflow.controller.js';

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// ==== Templates ====
router.get('/templates', getTemplates);
router.post('/templates', createTemplate);
router.put('/templates/:id', updateTemplate);

// ==== Instance (per Job Request) ====
router.get('/instance/:jobRequestId', getWorkflowInstance);
router.post('/instance/:jobRequestId/advance', advanceStep);
router.post('/instance/:jobRequestId/reject', rejectStep);
router.post('/instance/:jobRequestId/comment', addComment);

// ==== Audit Logs ====
router.get('/logs/:jobRequestId', getWorkflowLogs);

// ==== Dashboard, SLA & Reset ====
router.get('/dashboard', getWorkflowDashboard);
router.get('/sla-breaches', getSLABreaches);
router.post('/reset-test-data', resetTestData);

export default router;
