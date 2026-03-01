import express from 'express';
import { protect, authorize } from '../middlewares/auth.middleware.js';
import {
    getRoadmapData,
    createRoadmapItem,
    createMilestone,
    updateRoadmapItem
} from '../controllers/roadmap.controller.js';

const router = express.Router();

router.use(protect);

router.get('/', getRoadmapData);
router.post('/items', authorize('SUPER_ADMIN'), createRoadmapItem);
router.post('/milestones', authorize('SUPER_ADMIN'), createMilestone);
router.patch('/items/:id', authorize('SUPER_ADMIN'), updateRoadmapItem);

export default router;
