/**
 * AI Shield Controller
 * =====================
 * Production-ready controller handling lifecycle management, privacy consent,
 * structured signal ingestion, rotating nonces, replay protection, degraded mode,
 * deterministic report generation, scheduled retention cleanup, and human review.
 */

import crypto from 'crypto';
import prisma from '../config/db.js';
import logger from '../utils/logger.js';
import { auditService } from '../services/audit.service.js';
import {
    verifyIdentityBaseline,
    processFrameSignals,
    processAudioSignals,
    extractAnswerIntegritySignals,
    computeSessionScoresAndRisk,
    SESSION_STATUS,
    HUMAN_REVIEW_STATUS,
    EVENT_TYPES,
    SEVERITY_LEVELS
} from '../services/ai-shield.service.js';

// In-memory active nonce store with TTL
// Map<sessionId, { nonce: string, expiresAt: number, lastSequence: number }>
const activeNonces = new Map();

// ─── Helpers ──────────────────────────────────────────────────────────────────

const resolveCompanyId = (req) => {
    const id = req.user?.companyId || req.user?.company?.id || req.companyId;
    if (!id) {
        const e = new Error('Company context missing.');
        e.statusCode = 403;
        throw e;
    }
    return id;
};

const safeJsonParse = (str, fallback = {}) => {
    if (!str) return fallback;
    if (typeof str === 'object') return str;
    try {
        return JSON.parse(str);
    } catch {
        return fallback;
    }
};

const generateChallengeNonce = (sessionId) => {
    const nonce = crypto.randomBytes(16).toString('hex');
    activeNonces.set(sessionId, {
        nonce,
        expiresAt: Date.now() + 90 * 1000, // 90s validity
        lastSequence: 0
    });
    return nonce;
};

const validateNonceAndSequence = (sessionId, nonce, sequenceNumber = 0) => {
    const record = activeNonces.get(sessionId);
    if (!record) return { valid: false, reason: 'NONCE_NOT_FOUND_OR_EXPIRED' };
    if (Date.now() > record.expiresAt) {
        activeNonces.delete(sessionId);
        return { valid: false, reason: 'NONCE_EXPIRED' };
    }
    if (record.nonce !== nonce) {
        return { valid: false, reason: 'INVALID_NONCE' };
    }
    if (sequenceNumber > 0 && sequenceNumber <= record.lastSequence) {
        return { valid: false, reason: 'REPLAY_DETECTED_OLD_SEQUENCE' };
    }
    record.lastSequence = sequenceNumber;
    return { valid: true };
};

// ─── 1. Generate / Rotate Challenge Nonce ──────────────────────────────────────

/**
 * POST /api/ai-shield/nonce/:sessionId
 * Issues a fresh challenge nonce for session binding and replay prevention.
 */
export const getChallengeNonce = async (req, res, next) => {
    try {
        const { sessionId } = req.params;

        const session = await prisma.aIShieldSession.findUnique({
            where: { id: sessionId }
        });

        if (!session) {
            return res.status(404).json({
                status: 'error',
                code: 'SESSION_NOT_FOUND',
                message: 'AI Shield session not found.'
            });
        }

        if (session.status !== SESSION_STATUS.ACTIVE && session.status !== SESSION_STATUS.CREATED) {
            return res.status(409).json({
                status: 'error',
                code: 'SESSION_NOT_ACTIVE',
                message: `Cannot issue nonce for session in '${session.status}' state.`
            });
        }

        const challengeNonce = generateChallengeNonce(sessionId);

        return res.status(200).json({
            status: 'success',
            data: {
                sessionId,
                challengeNonce,
                expiresInSeconds: 90
            }
        });
    } catch (error) {
        next(error);
    }
};

// ─── 2. Start / Initialize AI Shield Session ──────────────────────────────────

/**
 * POST /api/ai-shield/start
 * Initializes a new AI Shield session with candidate consent and baseline check.
 */
export const startShieldSession = async (req, res, next) => {
    try {
        const {
            interviewId,
            candidateId,
            consentGiven = false,
            consentVersion = 'v1.0',
            consentPurpose = 'ANTI_CHEATING_PROCTORING',
            baselineSnapshot = {},
            livenessProof = {}
        } = req.body || {};

        if (!interviewId) {
            return res.status(400).json({
                status: 'error',
                code: 'MISSING_INTERVIEW_ID',
                message: 'interviewId is required to start an AI Shield session.'
            });
        }

        let userCompanyId = null;
        try {
            userCompanyId = resolveCompanyId(req);
        } catch {
            // Unauthenticated candidate proctoring session
        }

        // Validate Interview exists and resolve company context (direct or candidate job company)
        const interview = await prisma.interview.findFirst({
            where: {
                id: interviewId,
                ...(userCompanyId ? {
                    OR: [
                        { companyId: userCompanyId },
                        { candidate: { recruitmentjob: { companyId: userCompanyId } } }
                    ]
                } : {})
            },
            include: { candidate: { include: { recruitmentjob: true } } }
        });

        if (!interview) {
            return res.status(404).json({
                status: 'error',
                code: 'INTERVIEW_NOT_FOUND',
                message: 'Interview not found or does not belong to your company.'
            });
        }

        const companyId = userCompanyId || interview.companyId || interview.candidate?.recruitmentjob?.companyId;
        if (!companyId) {
            return res.status(400).json({
                status: 'error',
                code: 'MISSING_COMPANY_CONTEXT',
                message: 'Could not resolve company context for this interview.'
            });
        }

        // Privacy: Explicit consent requirement
        if (!consentGiven) {
            return res.status(400).json({
                status: 'error',
                code: 'CONSENT_REQUIRED',
                message: 'Candidate consent is required to activate AI Shield proctoring.'
            });
        }

        // Check if active session already exists for this interview
        const existingActiveSession = await prisma.aIShieldSession.findFirst({
            where: {
                interviewId,
                status: { in: [SESSION_STATUS.CREATED, SESSION_STATUS.CONSENTED, SESSION_STATUS.ACTIVE] }
            }
        });

        if (existingActiveSession) {
            const freshNonce = generateChallengeNonce(existingActiveSession.id);
            return res.status(200).json({
                status: 'success',
                message: 'An active AI Shield session already exists for this interview.',
                data: { session: existingActiveSession, isExisting: true, challengeNonce: freshNonce }
            });
        }

        // Run Identity Verification Baseline
        const identityResult = verifyIdentityBaseline({
            ...baselineSnapshot,
            livenessProof
        });

        const targetCandidateId = candidateId || interview.candidateId;

        // Create Session in Database
        const session = await prisma.aIShieldSession.create({
            data: {
                interviewId,
                companyId,
                candidateId: targetCandidateId,
                status: SESSION_STATUS.ACTIVE,
                consentGiven: true,
                consentTimestamp: new Date(),
                consentVersion,
                consentPurpose,
                consentMethod: 'DIGITAL_SIGNATURE_OPT_IN',
                identityScore: identityResult.identityScore,
                identityVerified: identityResult.isVerified,
                identityConfidence: identityResult.confidence,
                identityDetails: JSON.stringify(identityResult.details),
                behaviorScore: 100,
                audioScore: 100,
                answerIntegrityScore: 100,
                overallScore: identityResult.identityScore,
                riskLevel: identityResult.identityScore < 50 ? 'HIGH' : 'LOW',
                expiresAt: new Date(Date.now() + 4 * 60 * 60 * 1000) // 4 hours auto-expiry
            }
        });

        const challengeNonce = generateChallengeNonce(session.id);

        // If identity check produced initial signals, save them as events
        if (identityResult.signals && identityResult.signals.length > 0) {
            for (const sig of identityResult.signals) {
                await prisma.aIShieldEvent.create({
                    data: {
                        sessionId: session.id,
                        companyId,
                        eventType: sig.type,
                        timestamp: 0,
                        duration: 1,
                        severity: sig.severity,
                        confidence: sig.confidence,
                        description: sig.description,
                        metadata: JSON.stringify(identityResult.details)
                    }
                });
            }
        }

        auditService.log({
            userId: req.user?.id,
            companyId,
            action: 'START_AI_SHIELD_SESSION',
            actionType: 'SECURITY',
            severity: 'low',
            target: `AIShieldSession:${session.id}`,
            status: 'success',
            ip: req.ip
        });

        logger.info(`[AIShield] Session started (${session.id}) for interview: ${interviewId}, company: ${companyId}`);

        return res.status(201).json({
            status: 'success',
            message: 'AI Shield session initialized successfully.',
            data: {
                session,
                challengeNonce,
                identityVerification: identityResult
            }
        });
    } catch (error) {
        next(error);
    }
};

// ─── 3. Ingest Telemetry Batch (Frames + Audio) with Nonce Protection ─────────

/**
 * POST /api/ai-shield/telemetry-batch
 * Ingests client-side CV telemetry batches with nonce verification.
 */
export const ingestTelemetryBatch = async (req, res, next) => {
    try {
        const {
            sessionId,
            challengeNonce,
            sequenceNumber = 1,
            frameBatches = [],
            audioBatches = []
        } = req.body || {};

        if (!sessionId) {
            return res.status(400).json({
                status: 'error',
                code: 'MISSING_SESSION_ID',
                message: 'sessionId is required.'
            });
        }

        const session = await prisma.aIShieldSession.findUnique({
            where: { id: sessionId }
        });

        if (!session) {
            return res.status(404).json({
                status: 'error',
                code: 'SESSION_NOT_FOUND',
                message: 'AI Shield session not found or unauthorized.'
            });
        }

        const companyId = session.companyId;

        if (session.status !== SESSION_STATUS.ACTIVE) {
            return res.status(409).json({
                status: 'error',
                code: 'SESSION_NOT_ACTIVE',
                message: `Cannot ingest telemetry: Session is in '${session.status}' state.`
            });
        }

        // Nonce & Sequence Validation
        if (challengeNonce) {
            const nonceCheck = validateNonceAndSequence(sessionId, challengeNonce, sequenceNumber);
            if (!nonceCheck.valid) {
                logger.warn(`[AIShield] Telemetry rejected for session ${sessionId}: ${nonceCheck.reason}`);
                return res.status(403).json({
                    status: 'error',
                    code: nonceCheck.reason,
                    message: 'Security telemetry validation failed (replay or invalid nonce).'
                });
            }
        }

        const eventsToCreate = [];

        // Process Frame Batches
        for (const frame of frameBatches) {
            const { detectedEvents } = processFrameSignals(frame.metrics || {}, frame.timestamp || 0);
            for (const ev of detectedEvents) {
                eventsToCreate.push({
                    sessionId,
                    companyId,
                    eventType: ev.eventType,
                    timestamp: Number(ev.timestamp || 0),
                    duration: ev.duration || 1,
                    severity: ev.severity,
                    confidence: ev.confidence,
                    description: ev.description,
                    metadata: JSON.stringify(ev.metadata || {})
                });
            }
        }

        // Process Audio Batches
        for (const audio of audioBatches) {
            const { detectedEvents } = processAudioSignals(audio.metrics || {}, audio.timestamp || 0);
            for (const ev of detectedEvents) {
                eventsToCreate.push({
                    sessionId,
                    companyId,
                    eventType: ev.eventType,
                    timestamp: Number(ev.timestamp || 0),
                    duration: ev.duration || 1,
                    severity: ev.severity,
                    confidence: ev.confidence,
                    description: ev.description,
                    metadata: JSON.stringify(ev.metadata || {})
                });
            }
        }

        if (eventsToCreate.length > 0) {
            await prisma.aIShieldEvent.createMany({ data: eventsToCreate });
        }

        await prisma.aIShieldSession.update({
            where: { id: sessionId },
            data: {
                totalFramesAnalyzed: { increment: frameBatches.length },
                totalAudioSlicesAnalyzed: { increment: audioBatches.length },
                suspiciousEventsCount: { increment: eventsToCreate.length }
            }
        });

        // Rotate Nonce
        const nextNonce = generateChallengeNonce(sessionId);

        return res.status(200).json({
            status: 'success',
            data: {
                eventsDetected: eventsToCreate.length,
                nextChallengeNonce: nextNonce
            }
        });
    } catch (error) {
        next(error);
    }
};

// ─── 4. Degraded Mode Logging ─────────────────────────────────────────────────

/**
 * POST /api/ai-shield/degraded/:sessionId
 * Gracefully records that browser CV failed due to device limitations.
 */
export const logDegradedMode = async (req, res, next) => {
    try {
        const { sessionId } = req.params;
        const { reason = 'BROWSER_CV_NOT_SUPPORTED', details = '' } = req.body || {};

        const session = await prisma.aIShieldSession.findUnique({
            where: { id: sessionId }
        });

        if (!session) {
            return res.status(404).json({
                status: 'error',
                code: 'SESSION_NOT_FOUND',
                message: 'AI Shield session not found.'
            });
        }

        await prisma.aIShieldEvent.create({
            data: {
                sessionId,
                companyId: session.companyId,
                eventType: 'CV_DEGRADED',
                timestamp: 0,
                duration: 0,
                severity: SEVERITY_LEVELS.LOW,
                confidence: 1.0,
                description: `تعذر تشغيل المراقبة البصرية الحية بسبب قيود المتصفح أو الجهاز (${reason}).`,
                metadata: JSON.stringify({ reason, details })
            }
        });

        return res.status(200).json({
            status: 'success',
            message: 'Session transitioned to degraded mode gracefully.'
        });
    } catch (error) {
        next(error);
    }
};

// ─── 5. Analyze Frame (Legacy Single Endpoint) ────────────────────────────────

export const analyzeFrame = async (req, res, next) => {
    try {
        const { sessionId, timestamp = 0, frameMetrics = {} } = req.body || {};

        if (!sessionId) {
            return res.status(400).json({
                status: 'error',
                code: 'MISSING_SESSION_ID',
                message: 'sessionId is required.'
            });
        }

        const session = await prisma.aIShieldSession.findUnique({
            where: { id: sessionId }
        });

        if (!session) {
            return res.status(404).json({
                status: 'error',
                code: 'SESSION_NOT_FOUND',
                message: 'AI Shield session not found.'
            });
        }

        if (session.status !== SESSION_STATUS.ACTIVE) {
            return res.status(409).json({
                status: 'error',
                code: 'SESSION_NOT_ACTIVE',
                message: `Session is in '${session.status}' state.`
            });
        }

        const { detectedEvents } = processFrameSignals(frameMetrics, timestamp);

        if (detectedEvents.length > 0) {
            for (const ev of detectedEvents) {
                await prisma.aIShieldEvent.create({
                    data: {
                        sessionId,
                        companyId: session.companyId,
                        eventType: ev.eventType,
                        timestamp: Number(ev.timestamp || 0),
                        duration: ev.duration || 1,
                        severity: ev.severity,
                        confidence: ev.confidence,
                        description: ev.description,
                        metadata: JSON.stringify(ev.metadata || {})
                    }
                });
            }
        }

        await prisma.aIShieldSession.update({
            where: { id: sessionId },
            data: {
                totalFramesAnalyzed: { increment: 1 },
                suspiciousEventsCount: { increment: detectedEvents.length }
            }
        });

        return res.status(200).json({
            status: 'success',
            data: { eventsDetected: detectedEvents.length, events: detectedEvents }
        });
    } catch (error) {
        next(error);
    }
};

// ─── 6. Analyze Audio (Legacy Single Endpoint) ────────────────────────────────

export const analyzeAudio = async (req, res, next) => {
    try {
        const { sessionId, timestamp = 0, audioMetrics = {} } = req.body || {};

        if (!sessionId) {
            return res.status(400).json({
                status: 'error',
                code: 'MISSING_SESSION_ID',
                message: 'sessionId is required.'
            });
        }

        const session = await prisma.aIShieldSession.findUnique({
            where: { id: sessionId }
        });

        if (!session) {
            return res.status(404).json({
                status: 'error',
                code: 'SESSION_NOT_FOUND',
                message: 'AI Shield session not found.'
            });
        }

        if (session.status !== SESSION_STATUS.ACTIVE) {
            return res.status(409).json({
                status: 'error',
                code: 'SESSION_NOT_ACTIVE',
                message: `Session is in '${session.status}' state.`
            });
        }

        const { detectedEvents } = processAudioSignals(audioMetrics, timestamp);

        if (detectedEvents.length > 0) {
            for (const ev of detectedEvents) {
                await prisma.aIShieldEvent.create({
                    data: {
                        sessionId,
                        companyId: session.companyId,
                        eventType: ev.eventType,
                        timestamp: Number(ev.timestamp || 0),
                        duration: ev.duration || 1,
                        severity: ev.severity,
                        confidence: ev.confidence,
                        description: ev.description,
                        metadata: JSON.stringify(ev.metadata || {})
                    }
                });
            }
        }

        await prisma.aIShieldSession.update({
            where: { id: sessionId },
            data: {
                totalAudioSlicesAnalyzed: { increment: 1 },
                suspiciousEventsCount: { increment: detectedEvents.length }
            }
        });

        return res.status(200).json({
            status: 'success',
            data: { eventsDetected: detectedEvents.length, events: detectedEvents }
        });
    } catch (error) {
        next(error);
    }
};

// ─── 7. Analyze Answers ───────────────────────────────────────────────────────

export const analyzeAnswers = async (req, res, next) => {
    try {
        const companyId = resolveCompanyId(req);
        const { sessionId, answersText = '', cvText = '', jobTitle = '' } = req.body || {};

        if (!sessionId) {
            return res.status(400).json({
                status: 'error',
                code: 'MISSING_SESSION_ID',
                message: 'sessionId is required.'
            });
        }

        const session = await prisma.aIShieldSession.findFirst({
            where: { id: sessionId, companyId },
            include: { candidate: { include: { recruitmentjob: true } } }
        });

        if (!session) {
            return res.status(404).json({
                status: 'error',
                code: 'SESSION_NOT_FOUND',
                message: 'AI Shield session not found.'
            });
        }

        if (session.status !== SESSION_STATUS.ACTIVE) {
            return res.status(409).json({
                status: 'error',
                code: 'SESSION_NOT_ACTIVE',
                message: `Session is in '${session.status}' state.`
            });
        }

        const candidateCv = cvText || session.candidate?.aiSummary || session.candidate?.skills || '';
        const roleTitle = jobTitle || session.candidate?.recruitmentjob?.title || 'Professional Role';

        const { signals, extractedMetrics } = await extractAnswerIntegritySignals(answersText, candidateCv, roleTitle);

        if (signals.length > 0) {
            for (const sig of signals) {
                await prisma.aIShieldEvent.create({
                    data: {
                        sessionId,
                        companyId,
                        eventType: sig.eventType,
                        timestamp: Number(sig.timestamp || 0),
                        duration: 1,
                        severity: sig.severity,
                        confidence: sig.confidence,
                        description: sig.description,
                        metadata: JSON.stringify(sig.metadata || {})
                    }
                });
            }
        }

        return res.status(200).json({
            status: 'success',
            data: { signalsDetected: signals.length, signals, metrics: extractedMetrics }
        });
    } catch (error) {
        next(error);
    }
};

// ─── 8. Complete Session & Deterministic Scoring ──────────────────────────────

export const completeShieldSession = async (req, res, next) => {
    try {
        const { sessionId } = req.params;

        const session = await prisma.aIShieldSession.findUnique({
            where: { id: sessionId },
            include: { events: true }
        });

        if (!session) {
            return res.status(404).json({
                status: 'error',
                code: 'SESSION_NOT_FOUND',
                message: 'AI Shield session not found.'
            });
        }

        if (session.status === SESSION_STATUS.COMPLETED) {
            return res.status(200).json({
                status: 'success',
                message: 'Session was already completed.',
                data: { session }
            });
        }

        // Clean up active nonces
        activeNonces.delete(sessionId);

        const computed = computeSessionScoresAndRisk(session, session.events);

        const summaryText = `تم استكمال فحص أمان ونزاهة المقابلة بالذكاء الاصطناعي. النتيجة الإجمالية لمؤشر النزاهة: ${computed.overallScore}/100، بمستوى خطر: ${computed.riskLevel}. تم رصد إجمالي ${session.events.length} إشارة وملاحظة سلوكية.`;

        const updatedSession = await prisma.aIShieldSession.update({
            where: { id: sessionId },
            data: {
                status: SESSION_STATUS.COMPLETED,
                identityScore: computed.identityScore,
                behaviorScore: computed.behaviorScore,
                audioScore: computed.audioScore,
                answerIntegrityScore: computed.answerIntegrityScore,
                overallScore: computed.overallScore,
                riskLevel: computed.riskLevel,
                isHardRuleTriggered: computed.isHardRuleTriggered,
                hardRuleReasons: JSON.stringify(computed.hardRuleReasons || []),
                summary: summaryText,
                recommendations: JSON.stringify(computed.recommendations || []),
                completedAt: new Date()
            },
            include: { events: { orderBy: { timestamp: 'asc' } } }
        });

        auditService.log({
            userId: req.user?.id,
            companyId: session.companyId,
            action: 'COMPLETE_AI_SHIELD_SESSION',
            actionType: 'SECURITY',
            severity: computed.riskLevel === 'HIGH' ? 'HIGH' : 'low',
            target: `AIShieldSession:${sessionId}`,
            status: 'success',
            details: { overallScore: computed.overallScore, riskLevel: computed.riskLevel },
            ip: req.ip
        });

        logger.info(`[AIShield] Session ${sessionId} completed. Overall: ${computed.overallScore}, Risk: ${computed.riskLevel}`);

        return res.status(200).json({
            status: 'success',
            message: 'AI Shield session completed successfully.',
            data: { session: updatedSession }
        });
    } catch (error) {
        next(error);
    }
};

// ─── 9. Get Shield Report ─────────────────────────────────────────────────────

export const getShieldReport = async (req, res, next) => {
    try {
        const companyId = resolveCompanyId(req);
        const { interviewId } = req.params;

        const session = await prisma.aIShieldSession.findFirst({
            where: {
                interviewId,
                OR: [
                    { companyId },
                    { interview: { companyId } },
                    { interview: { candidate: { recruitmentjob: { companyId } } } }
                ]
            },
            orderBy: { createdAt: 'desc' },
            include: {
                events: { orderBy: { timestamp: 'asc' } },
                interview: {
                    select: {
                        id: true,
                        type: true,
                        status: true,
                        scheduledAt: true,
                        candidate: {
                            select: { id: true, fullName: true, email: true }
                        }
                    }
                }
            }
        });

        if (!session) {
            return res.status(404).json({
                status: 'error',
                code: 'REPORT_NOT_FOUND',
                message: 'No AI Shield session or report found for this interview.'
            });
        }

        const report = {
            id: session.id,
            interviewId: session.interviewId,
            candidateId: session.candidateId,
            candidateName: session.interview?.candidate?.fullName || 'N/A',
            candidateEmail: session.interview?.candidate?.email || 'N/A',
            status: session.status,
            createdAt: session.createdAt,
            completedAt: session.completedAt,

            scores: {
                overallScore: session.overallScore,
                identityScore: session.identityScore,
                behaviorScore: session.behaviorScore,
                audioScore: session.audioScore,
                answerIntegrityScore: session.answerIntegrityScore,
                riskLevel: session.riskLevel,
                isHardRuleTriggered: session.isHardRuleTriggered,
                hardRuleReasons: safeJsonParse(session.hardRuleReasons, [])
            },

            metrics: {
                totalFramesAnalyzed: session.totalFramesAnalyzed,
                totalAudioSlicesAnalyzed: session.totalAudioSlicesAnalyzed,
                suspiciousEventsCount: session.events.length
            },

            summary: session.summary || 'تم تسجيل جلسة الأمان ومراقبة النزاهة بنجاح.',
            recommendations: safeJsonParse(session.recommendations, []),

            humanReview: {
                status: session.humanReviewStatus,
                reviewedById: session.reviewedById,
                reviewedAt: session.reviewedAt,
                reviewNotes: session.reviewNotes,
                reviewerDecision: session.reviewerDecision
            },

            privacy: {
                consentGiven: session.consentGiven,
                consentTimestamp: session.consentTimestamp,
                consentVersion: session.consentVersion,
                consentPurpose: session.consentPurpose,
                retentionPolicy: session.retentionPolicy
            },

            eventsTimeline: session.events.map(e => ({
                id: e.id,
                eventType: e.eventType,
                timestamp: e.timestamp,
                duration: e.duration,
                occurrences: e.occurrences,
                severity: e.severity,
                confidence: e.confidence,
                description: e.description,
                metadata: safeJsonParse(e.metadata, {})
            }))
        };

        return res.status(200).json({
            status: 'success',
            data: { report }
        });
    } catch (error) {
        next(error);
    }
};

// ─── 10. Human Review Audit Action ────────────────────────────────────────────

export const submitHumanReview = async (req, res, next) => {
    try {
        const companyId = resolveCompanyId(req);
        const { sessionId } = req.params;
        const {
            status = 'REVIEWED',
            reviewerDecision = 'APPROVED',
            reviewNotes = ''
        } = req.body || {};

        const session = await prisma.aIShieldSession.findFirst({
            where: { id: sessionId, companyId }
        });

        if (!session) {
            return res.status(404).json({
                status: 'error',
                code: 'SESSION_NOT_FOUND',
                message: 'AI Shield session not found.'
            });
        }

        const updated = await prisma.aIShieldSession.update({
            where: { id: sessionId },
            data: {
                humanReviewStatus: status,
                reviewedById: req.user.id,
                reviewedAt: new Date(),
                reviewerDecision,
                reviewNotes: reviewNotes.trim()
            }
        });

        auditService.log({
            userId: req.user.id,
            companyId,
            action: 'SUBMIT_AI_SHIELD_HUMAN_REVIEW',
            actionType: 'AUDIT',
            severity: 'low',
            target: `AIShieldSession:${sessionId}`,
            status: 'success',
            details: { decision: reviewerDecision, notes: reviewNotes },
            ip: req.ip
        });

        return res.status(200).json({
            status: 'success',
            message: 'Human review recorded successfully.',
            data: { session: updated }
        });
    } catch (error) {
        next(error);
    }
};

// ─── 11. Scheduled 90-Day Retention Purge Routine ─────────────────────────────

/**
 * Executes cleanup of telemetry events and sensitive metadata older than 90 days.
 */
export const purgeExpiredRetentionData = async () => {
    try {
        const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);

        const expiredSessions = await prisma.aIShieldSession.findMany({
            where: {
                createdAt: { lte: ninetyDaysAgo },
                dataPurgedAt: null
            },
            select: { id: true, companyId: true }
        });

        if (expiredSessions.length === 0) return { purgedCount: 0 };

        const sessionIds = expiredSessions.map(s => s.id);

        // Delete all detailed timeline events for expired sessions
        const deleteResult = await prisma.aIShieldEvent.deleteMany({
            where: { sessionId: { in: sessionIds } }
        });

        // Mark sessions as purged while keeping audit summary
        await prisma.aIShieldSession.updateMany({
            where: { id: { in: sessionIds } },
            data: {
                dataPurgedAt: new Date(),
                identityDetails: null,
                hardRuleReasons: null
            }
        });

        logger.info(`[AIShield Retention] Purged ${deleteResult.count} events across ${sessionIds.length} expired sessions.`);
        return { purgedSessions: sessionIds.length, purgedEvents: deleteResult.count };
    } catch (err) {
        logger.error('[AIShield Retention] Purge failed:', err);
        throw err;
    }
};
