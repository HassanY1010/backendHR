import express from 'express';
import { protect } from '../middlewares/auth.middleware.js';
import {
    generateJobDescription,
    interactiveJDChat,
    getJDTemplates,
    generateSummaryOnly,
    generateRecruitmentDescription,
    generateRecruitmentRequirements
} from '../controllers/ai-jd.controller.js';

const router = express.Router();

router.use(protect);

// Generate job description from form input (one-shot)
router.post('/generate', generateJobDescription);

// Generate AI Job Summary Only for job request forms
router.post('/generate-summary', generateSummaryOnly);

// Generate Recruitment Job Description (150-300 words)
router.post('/generate-recruitment-description', generateRecruitmentDescription);

// Generate Recruitment Requirements (clean line-by-line)
router.post('/generate-recruitment-requirements', generateRecruitmentRequirements);

// Interactive AI chat for JD creation
router.post('/chat', interactiveJDChat);

// Get pre-built templates
router.get('/templates', getJDTemplates);

export default router;
