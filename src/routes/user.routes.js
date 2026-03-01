import express from 'express';
import { protect } from '../middlewares/auth.middleware.js';
import { getMe, updateMe } from '../controllers/user.controller.js';

const router = express.Router();

router.use(protect);

router.get('/me', getMe);
router.patch('/me', updateMe);

export default router;
