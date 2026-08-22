import express from 'express';
import { protect as authenticate, authorize } from '../middlewares/auth.middleware.js';
import {
    getHiringPlans,
    createHiringPlan,
    updateHiringPlan,
    deleteHiringPlan,
    getManpowerDashboard
} from '../controllers/hiring-plan.controller.js';

const router = express.Router();

router.use(authenticate);

router.get('/', getHiringPlans);
router.get('/dashboard', getManpowerDashboard);

// Plan Management requires Managerial or HR permissions
router.post('/', authorize('ADMIN', 'SUPER_ADMIN', 'HR_MANAGER', 'MANAGER', 'CEO_EXECUTIVE'), createHiringPlan);
router.put('/:id', authorize('ADMIN', 'SUPER_ADMIN', 'HR_MANAGER', 'MANAGER', 'CEO_EXECUTIVE'), updateHiringPlan);
router.delete('/:id', authorize('ADMIN', 'SUPER_ADMIN', 'HR_MANAGER', 'MANAGER', 'CEO_EXECUTIVE'), deleteHiringPlan);

export default router;
