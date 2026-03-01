import { Router } from 'express';
import * as CheckInController from '../controllers/check-in.controller.js';
import { protect as authenticate } from '../middlewares/auth.middleware.js';

const router = Router();

// Employee Routes
router.post('/trigger', authenticate, CheckInController.triggerCheckIn);
router.get('/status', authenticate, CheckInController.getStatus);
router.post('/entry/:entryId/answer', authenticate, CheckInController.answerQuestion);
router.get('/employee/:employeeId', authenticate, CheckInController.getEmployeeCheckIns);

export default router;
