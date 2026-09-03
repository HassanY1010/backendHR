/**
 * AI Shield API Routes
 * =====================
 * Production endpoints for AI Shield Proctoring & Anti-Cheating System.
 * 
 * Flow Architecture:
 * 1. Candidate Proctoring Endpoints (Public via Interview Token / Candidate Session):
 *    - POST /api/ai-shield/start (Starts session & verifies baseline)
 *    - POST /api/ai-shield/nonce/:sessionId (Challenge Nonce rotation)
 *    - POST /api/ai-shield/telemetry-batch (Ingests batched CV/Audio telemetry)
 *    - POST /api/ai-shield/degraded/:sessionId (Graceful degradation logging)
 *    - POST /api/ai-shield/complete/:sessionId (Finishes proctoring & calculates scores)
 * 
 * 2. Manager & Recruiter Review Endpoints (Protected with JWT & RBAC & Company Context):
 *    - GET  /api/ai-shield/report/:interviewId (Fetches full security report & timeline)
 *    - POST /api/ai-shield/review/:sessionId (Human Review submission & audit log)
 *    - POST /api/ai-shield/analyze-answers (AI script recitation & CV variance analysis)
 */

import { Router } from 'express';
import {
    getChallengeNonce,
    startShieldSession,
    ingestTelemetryBatch,
    logDegradedMode,
    analyzeFrame,
    analyzeAudio,
    analyzeAnswers,
    completeShieldSession,
    getShieldReport,
    submitHumanReview
} from '../controllers/ai-shield.controller.js';
import { protect, authorize, requireCompanyContext } from '../middlewares/auth.middleware.js';
import { requireProSubscription } from '../middlewares/subscription.middleware.js';
import { aiJdLimiter, recruitmentPublicLimiter } from '../middlewares/rate-limit.middleware.js';

const router = Router();

// ==============================================================================
// 1. CANDIDATE PROCTORING ENDPOINTS (Public via Interview / Session Token)
// ==============================================================================

// Start Session (with candidate consent & baseline capture)
router.post(
    '/start',
    recruitmentPublicLimiter,
    startShieldSession
);

// Issue rotating challenge nonce for active session
router.post(
    '/nonce/:sessionId',
    recruitmentPublicLimiter,
    getChallengeNonce
);

// Stream batched CV & Audio signals with nonce & sequence protection
router.post(
    '/telemetry-batch',
    recruitmentPublicLimiter,
    ingestTelemetryBatch
);

// Record degraded mode gracefully (e.g. low-end device / no WebGL)
router.post(
    '/degraded/:sessionId',
    recruitmentPublicLimiter,
    logDegradedMode
);

// Complete session & trigger deterministic scoring
router.post(
    '/complete/:sessionId',
    recruitmentPublicLimiter,
    completeShieldSession
);

// Legacy Single Frame / Audio Analyzers
router.post('/analyze-frame', recruitmentPublicLimiter, analyzeFrame);
router.post('/analyze-audio', recruitmentPublicLimiter, analyzeAudio);


// ==============================================================================
// 2. HR & MANAGER PROTECTED ENDPOINTS (Requires Login, Company Context & PRO)
// ==============================================================================

const SHIELD_ROLES = ['SUPER_ADMIN', 'ADMIN', 'HR_MANAGER', 'RECRUITER', 'MANAGER'];

// Fetch full report & events timeline
router.get(
    '/report/:interviewId',
    protect,
    requireCompanyContext,
    requireProSubscription,
    authorize(...SHIELD_ROLES),
    getShieldReport
);

// Record Human Review decision & audit notes
router.post(
    '/review/:sessionId',
    protect,
    requireCompanyContext,
    requireProSubscription,
    authorize(...SHIELD_ROLES),
    submitHumanReview
);

// Analyze candidate answers with OpenAI
router.post(
    '/analyze-answers',
    protect,
    requireCompanyContext,
    requireProSubscription,
    authorize(...SHIELD_ROLES),
    aiJdLimiter,
    analyzeAnswers
);

export default router;
