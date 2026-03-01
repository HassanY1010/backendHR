import express from 'express';
import { protect, authorize } from '../middlewares/auth.middleware.js';
import { getAIQualityData, analyzeAIQuality, getAITestResults, getAIImprovements } from '../controllers/ai-quality.controller.js';

const router = express.Router();

router.use(protect);
router.use(authorize('SUPER_ADMIN'));

router.get('/', getAIQualityData);
router.get('/analyze', analyzeAIQuality);
router.get('/tests', getAITestResults);
router.get('/improvements', getAIImprovements);

export default router;
