import express from 'express';
import * as jobRequestController from '../controllers/jobRequestController.js';
import { protect as authenticateToken } from '../middlewares/auth.middleware.js';

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

// Stats & Dashboard Analytics
router.get('/stats', jobRequestController.getJobRequestStats);

// List & Create
router.get('/', jobRequestController.getJobRequests);
router.post('/', jobRequestController.createJobRequest);

// Single Details & Update
router.get('/:id', jobRequestController.getJobRequestById);
router.put('/:id', jobRequestController.updateJobRequest);

// Workflow Actions
router.post('/:id/submit', jobRequestController.submitJobRequest);
router.post('/:id/approve', jobRequestController.approveJobRequest);
router.post('/:id/reject', jobRequestController.rejectJobRequest);
router.post('/:id/transition', jobRequestController.transitionState);
router.post('/:id/convert-to-job', jobRequestController.convertToRecruitmentJob);

export default router;
