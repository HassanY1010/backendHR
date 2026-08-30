/**
 * AI Shield API Routes
 * =====================
 * Production endpoints for AI Shield Proctoring & Anti-Cheating System.
 * Secured with:
 * - protect (JWT verification)
 * - requireCompanyContext (Tenant isolation)
 * - requireProSubscription (Feature entitlement check: PRO / ENTERPRISE / ACTIVE TRIAL)
 * - authorize (RBAC role verification)
 * - aiJdLimiter (Rate limiting protection)
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
import { aiJdLimiter } from '../middlewares/rate-limit.middleware.js';

const router = Router();

// Base Security: Authentication & Company Multi-Tenant Context
router.use(protect);
router.use(requireCompanyContext);

// Feature Entitlement: Requires PRO / Enterprise Plan with AI_SHIELD capability
router.use(requireProSubscription);

const SHIELD_ROLES = ['SUPER_ADMIN', 'ADMIN', 'HR_MANAGER', 'RECRUITER', 'MANAGER'];

// 1. POST /api/ai-shield/nonce/:sessionId — Issue rotating challenge nonce
router.post(
    '/nonce/:sessionId',
    authorize(...SHIELD_ROLES),
    getChallengeNonce
);

// 2. POST /api/ai-shield/start — Start/Initialize session with consent & baseline
router.post(
    '/start',
    authorize(...SHIELD_ROLES),
    aiJdLimiter,
    startShieldSession
);

// 3. POST /api/ai-shield/telemetry-batch — Stream batched CV & Audio signals with nonce protection
router.post(
    '/telemetry-batch',
    authorize(...SHIELD_ROLES),
    ingestTelemetryBatch
);

// 4. POST /api/ai-shield/degraded/:sessionId — Record degraded mode gracefully
router.post(
    '/degraded/:sessionId',
    authorize(...SHIELD_ROLES),
    logDegradedMode
);

// 5. POST /api/ai-shield/analyze-frame — Stream visual / telemetry frame metrics (Single frame)
router.post(
    '/analyze-frame',
    authorize(...SHIELD_ROLES),
    analyzeFrame
);

// 6. POST /api/ai-shield/analyze-audio — Stream acoustic anomaly telemetry (Single audio)
router.post(
    '/analyze-audio',
    authorize(...SHIELD_ROLES),
    analyzeAudio
);

// 7. POST /api/ai-shield/analyze-answers — Extract answer integrity & recitation signals
router.post(
    '/analyze-answers',
    authorize(...SHIELD_ROLES),
    aiJdLimiter,
    analyzeAnswers
);

// 8. POST /api/ai-shield/complete/:sessionId — Complete session & run deterministic scoring
router.post(
    '/complete/:sessionId',
    authorize(...SHIELD_ROLES),
    completeShieldSession
);

// 9. GET /api/ai-shield/report/:interviewId — Fetch full report & events timeline
router.get(
    '/report/:interviewId',
    authorize(...SHIELD_ROLES),
    getShieldReport
);

// 10. POST /api/ai-shield/review/:sessionId — Record Human Review decision & notes
router.post(
    '/review/:sessionId',
    authorize(...SHIELD_ROLES),
    submitHumanReview
);

export default router;
