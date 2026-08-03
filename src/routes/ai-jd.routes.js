import express from 'express';
import { protect } from '../middlewares/auth.middleware.js';
import { generateJobDescription, interactiveJDChat, getJDTemplates } from '../controllers/ai-jd.controller.js';

const router = express.Router();

router.use(protect);

// Generate job description from form input (one-shot)
router.post('/generate', generateJobDescription);

// Interactive AI chat for JD creation
router.post('/chat', interactiveJDChat);

// Get pre-built templates
router.get('/templates', getJDTemplates);

export default router;
