import express from 'express';
import { protect } from '../middlewares/auth.middleware.js';
import { getMe, updateMe, getUsersByCompany } from '../controllers/user.controller.js';
import { authorize } from '../middlewares/auth.middleware.js';

const router = express.Router();

router.use(protect);

router.get('/me', getMe);
router.patch('/me', updateMe);
router.get('/company/:companyId', authorize('SUPER_ADMIN'), getUsersByCompany);

export default router;
