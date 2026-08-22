import express from 'express';
import { protect } from '../middlewares/auth.middleware.js';
import { aiJdLimiter } from '../middlewares/rate-limit.middleware.js';
import {
    generateJobDescription,
    interactiveJDChat,
    getJDTemplates,
    generateSummaryOnly,
    generateRecruitmentDescription,
    generateRecruitmentRequirements,
    improveJobDescription,
    getJobDescriptionHistory
} from '../controllers/ai-jd.controller.js';

const router = express.Router();

router.use(protect);

// Generate job description from form input (one-shot with rate limiting)
router.post('/generate', aiJdLimiter, generateJobDescription);

// Improve existing Job Description based on feedback / market analysis (with rate limiting)
router.post('/improve', aiJdLimiter, improveJobDescription);


// Get versioned Job Description History for tenant
router.get('/history', getJobDescriptionHistory);

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

