import express from 'express';
import {
    getAllJobs,
    getPublicJobs,
    getPublicJobDetails,
    createJob,
    getJobDetails,
    applyToJob,
    getCandidates,
    scheduleInterview,
    updateJob,
    deleteJob,
    getCandidate,
    getInterviews,
    publishJob,
    createCandidate,
    updateCandidate,
    uploadResume,
    generateAiJobDescription,
    getInterviewByCode,
    getInterviewByToken,
    getInterviewQuestionsByToken,
    submitInterviewAnswer,
    getInterviewQuestions,
    uploadInterviewVideo,
    deleteCandidate,
    deleteInterview,
    updateInterview,
    submitFeedback,
    acceptTerms,
    uploadCandidateResume,
    getCandidateResume,
    parseCV,
    getDailyRecruitmentAnalysis,
    getSmartInterviewNotes,
    handleInteractiveAiJobFlow,
    getDepartments,
    createDepartment,
    updateDepartment,
    deleteDepartment
} from '../controllers/recruitment.controller.js';
import { protect, authorize } from '../middlewares/auth.middleware.js';
import { uploadResume as uploadResumeMiddleware, uploadVideo } from '../middlewares/multer.middleware.js';
import { virusScanMiddleware } from '../utils/virusScanner.js';
import { recruitmentPublicLimiter } from '../middlewares/rate-limit.middleware.js';

const router = express.Router();

// Public routes
router.get('/jobs/public', getPublicJobs);
router.get('/jobs/public/:id', getPublicJobDetails);
router.post('/jobs/:id/apply', applyToJob);
router.get('/interviews/code/:code', recruitmentPublicLimiter, getInterviewByCode);
router.get('/interviews/token/:token', recruitmentPublicLimiter, getInterviewByToken);
router.get('/interviews/:code/questions', recruitmentPublicLimiter, getInterviewQuestions);
router.get('/interviews/token/:token/questions', recruitmentPublicLimiter, getInterviewQuestionsByToken);
router.post('/interviews/submit', recruitmentPublicLimiter, submitInterviewAnswer);
router.post('/interviews/:interviewId/feedback', submitFeedback);
router.post('/candidates/terms', acceptTerms);
router.post('/interviews/upload-video', uploadVideo, virusScanMiddleware, uploadInterviewVideo);
router.post('/parse-cv', uploadResumeMiddleware, virusScanMiddleware, parseCV);
router.post('/candidates/:id/upload-resume', uploadResumeMiddleware, virusScanMiddleware, uploadCandidateResume);
router.post('/interviews/upload-video-file', uploadVideo, virusScanMiddleware, uploadInterviewVideo);

// Protected routes
router.use(protect);

router.get('/jobs', getAllJobs);
router.post('/jobs', authorize('MANAGER', 'SUPER_ADMIN'), createJob);
router.get('/jobs/:id', getJobDetails);
router.put('/jobs/:id', authorize('MANAGER', 'SUPER_ADMIN'), updateJob);
router.delete('/jobs/:id', authorize('MANAGER', 'SUPER_ADMIN'), deleteJob);
router.post('/jobs/:id/publish', authorize('MANAGER', 'SUPER_ADMIN'), publishJob);


router.post('/ai/generate-description', authorize('MANAGER', 'SUPER_ADMIN'), generateAiJobDescription);
router.post('/ai/interactive-flow', authorize('MANAGER', 'SUPER_ADMIN'), handleInteractiveAiJobFlow);
router.get('/ai/daily-analysis', authorize('MANAGER', 'SUPER_ADMIN'), getDailyRecruitmentAnalysis);

router.get('/departments', authorize('MANAGER', 'SUPER_ADMIN'), getDepartments);
router.post('/departments', authorize('MANAGER', 'SUPER_ADMIN'), createDepartment);
router.put('/departments/:id', authorize('MANAGER', 'SUPER_ADMIN'), updateDepartment);
router.delete('/departments/:id', authorize('MANAGER', 'SUPER_ADMIN'), deleteDepartment);


router.get('/candidates', authorize('MANAGER', 'SUPER_ADMIN'), getCandidates);
router.post('/candidates', authorize('MANAGER', 'SUPER_ADMIN'), createCandidate);
router.get('/candidates/:id', authorize('MANAGER', 'SUPER_ADMIN'), getCandidate);
router.put('/candidates/:id', authorize('MANAGER', 'SUPER_ADMIN'), updateCandidate);
router.delete('/candidates/:id', authorize('MANAGER', 'SUPER_ADMIN'), deleteCandidate); // ADDED
router.post('/candidates/:candidateId/resume', authorize('MANAGER', 'SUPER_ADMIN'), uploadResume);

router.get('/interviews', authorize('MANAGER', 'SUPER_ADMIN'), getInterviews);
router.post('/interviews', authorize('MANAGER', 'SUPER_ADMIN'), scheduleInterview);
router.put('/interviews/:id', authorize('MANAGER', 'SUPER_ADMIN'), updateInterview);
router.delete('/interviews/:id', authorize('MANAGER', 'SUPER_ADMIN'), deleteInterview);
router.get('/interviews/ai/smart-notes', authorize('MANAGER', 'SUPER_ADMIN'), getSmartInterviewNotes);

// Resume routes
// Moved to public section
router.get('/candidates/:id/resume', authorize('MANAGER', 'SUPER_ADMIN'), getCandidateResume);

export default router;
