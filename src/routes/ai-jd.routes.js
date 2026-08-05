import express from 'express';
import { protect } from '../middlewares/auth.middleware.js';
import { generateJobDescription, interactiveJDChat, getJDTemplates, generateSummaryOnly } from '../controllers/ai-jd.controller.js';

const router = express.Router();

router.use(protect);

// Generate job description from form input (one-shot)
router.post('/generate', generateJobDescription);

// Generate AI Job Summary Only for job request forms
router.post('/generate-summary', generateSummaryOnly);

// Interactive AI chat for JD creation
router.post('/chat', interactiveJDChat);

// Get pre-built templates
router.get('/templates', getJDTemplates);

export default router;
