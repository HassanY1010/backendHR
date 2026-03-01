import express from 'express';
import { generateCode, getAllCodes, updateSubscriptionCode, deleteSubscriptionCode } from '../controllers/subscription-code.controller.js';
import { protect, authorize } from '../middlewares/auth.middleware.js';

const router = express.Router();

router.use(protect);
router.use(authorize('SUPER_ADMIN'));

router.get('/', getAllCodes);
router.post('/generate', generateCode);
router.patch('/:id', updateSubscriptionCode);
router.delete('/:id', deleteSubscriptionCode);


export default router;
