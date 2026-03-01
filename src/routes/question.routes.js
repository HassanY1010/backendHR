import express from 'express';
import { getDailyQuestions, submitAnswer, createQuestion } from '../controllers/question.controller.js';
import { protect, authorize } from '../middlewares/auth.middleware.js';

const router = express.Router();

router.use(protect);

router.get('/', getDailyQuestions);
router.post('/submit', authorize('EMPLOYEE'), submitAnswer);
router.post('/', authorize('MANAGER', 'ADMIN'), createQuestion);

export default router;
