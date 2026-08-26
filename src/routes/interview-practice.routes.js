import { Router } from 'express';
import {
    createPracticeSession,
    getPracticeSessionDetails,
    getPracticeQuestions,
    analyzePracticeSession
} from '../controllers/interview-practice.controller.js';
import { recruitmentPublicLimiter } from '../middlewares/rate-limit.middleware.js';

const router = Router();

// ==========================================
// Candidate Public Endpoints (Rate Limited)
// ==========================================
router.post('/session', recruitmentPublicLimiter, createPracticeSession);
router.get('/session/:token', recruitmentPublicLimiter, getPracticeSessionDetails);
router.get('/questions', recruitmentPublicLimiter, getPracticeQuestions);
router.post('/analyze', recruitmentPublicLimiter, analyzePracticeSession);

export default router;
