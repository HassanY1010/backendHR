import express from 'express';
import { protect as authenticate } from '../middlewares/auth.middleware.js';
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
router.post('/', createHiringPlan);
router.get('/dashboard', getManpowerDashboard);
router.put('/:id', updateHiringPlan);
router.delete('/:id', deleteHiringPlan);

export default router;
