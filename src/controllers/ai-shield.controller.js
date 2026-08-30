/**
 * AI Shield Controller
 * =====================
 * Production-ready controller handling lifecycle management, privacy consent,
 * structured signal ingestion, deterministic report generation, and human review.
 */

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
    HUMAN_REVIEW_STATUS
} from '../services/ai-shield.service.js';

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

// ─── 1. Start / Initialize AI Shield Session ──────────────────────────────────

/**
 * POST /api/ai-shield/start
 * Initializes a new AI Shield session with candidate consent and baseline check.
 */
export const startShieldSession = async (req, res, next) => {
    try {
        const companyId = resolveCompanyId(req);
        const {
            interviewId,
            candidateId,
            consentGiven = false,
            consentVersion = 'v1.0',
            consentPurpose = 'ANTI_CHEATING_PROCTORING',
            baselineSnapshot = {}
        } = req.body || {};

        if (!interviewId) {
            return res.status(400).json({
                status: 'error',
                code: 'MISSING_INTERVIEW_ID',
                message: 'interviewId is required to start an AI Shield session.'
            });
        }

        // Validate Interview exists and belongs to Company (Multi-tenant check)
        const interview = await prisma.interview.findFirst({
            where: {
                id: interviewId,
                OR: [
                    { companyId },
                    { candidate: { recruitmentjob: { companyId } } }
                ]
            },
            include: { candidate: true }
        });

        if (!interview) {
            return res.status(404).json({
                status: 'error',
                code: 'INTERVIEW_NOT_FOUND',
                message: 'Interview not found or does not belong to your company.'
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
                companyId,
                status: { in: [SESSION_STATUS.CREATED, SESSION_STATUS.CONSENTED, SESSION_STATUS.ACTIVE] }
            }
        });

        if (existingActiveSession) {
            return res.status(200).json({
                status: 'success',
                message: 'An active AI Shield session already exists for this interview.',
                data: { session: existingActiveSession, isExisting: true }
            });
        }

        // Run Identity Verification Baseline
        const identityResult = verifyIdentityBaseline(baselineSnapshot);

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
                identityVerification: identityResult
            }
        });
    } catch (error) {
        next(error);
    }
};

// ─── 2. Ingest Frame / Visual Signals ─────────────────────────────────────────

/**
 * POST /api/ai-shield/analyze-frame
 * Analyzes structured visual signals (presence, face count, gaze, landmarks)
 */
export const analyzeFrame = async (req, res, next) => {
    try {
        const companyId = resolveCompanyId(req);
        const {
            sessionId,
            timestamp = 0,
            frameMetrics = {}
        } = req.body || {};

        if (!sessionId) {
            return res.status(400).json({
                status: 'error',
                code: 'MISSING_SESSION_ID',
                message: 'sessionId is required.'
            });
        }

        const session = await prisma.aIShieldSession.findFirst({
            where: { id: sessionId, companyId }
        });

        if (!session) {
            return res.status(404).json({
                status: 'error',
                code: 'SESSION_NOT_FOUND',
                message: 'AI Shield session not found or unauthorized.'
            });
        }

        // Validate Session Lifecycle
        if (session.status !== SESSION_STATUS.ACTIVE) {
            return res.status(409).json({
                status: 'error',
                code: 'SESSION_NOT_ACTIVE',
                message: `Cannot analyze frame: Session is currently in '${session.status}' state.`
            });
        }

        // Check if expired
        if (session.expiresAt && new Date(session.expiresAt) < new Date()) {
            await prisma.aIShieldSession.update({
                where: { id: sessionId },
                data: { status: SESSION_STATUS.EXPIRED }
            });
            return res.status(410).json({
                status: 'error',
                code: 'SESSION_EXPIRED',
                message: 'AI Shield session has expired.'
            });
        }

        // Process frame signals
        const { detectedEvents } = processFrameSignals(frameMetrics, timestamp);

        // Store detected events if any
        if (detectedEvents.length > 0) {
            for (const ev of detectedEvents) {
                await prisma.aIShieldEvent.create({
                    data: {
                        sessionId,
                        companyId,
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

        // Increment frame count and suspicious event counter
        await prisma.aIShieldSession.update({
            where: { id: sessionId },
            data: {
                totalFramesAnalyzed: { increment: 1 },
                suspiciousEventsCount: { increment: detectedEvents.length }
            }
        });

        return res.status(200).json({
            status: 'success',
            data: {
                eventsDetected: detectedEvents.length,
                events: detectedEvents
            }
        });
    } catch (error) {
        next(error);
    }
};

// ─── 3. Ingest Audio Signals ──────────────────────────────────────────────────

/**
 * POST /api/ai-shield/analyze-audio
 * Analyzes acoustic telemetry (multi-speakers, background voices, silent pauses)
 */
export const analyzeAudio = async (req, res, next) => {
    try {
        const companyId = resolveCompanyId(req);
        const {
            sessionId,
            timestamp = 0,
            audioMetrics = {}
        } = req.body || {};

        if (!sessionId) {
            return res.status(400).json({
                status: 'error',
                code: 'MISSING_SESSION_ID',
                message: 'sessionId is required.'
            });
        }

        const session = await prisma.aIShieldSession.findFirst({
            where: { id: sessionId, companyId }
        });

        if (!session) {
            return res.status(404).json({
                status: 'error',
                code: 'SESSION_NOT_FOUND',
                message: 'AI Shield session not found or unauthorized.'
            });
        }

        if (session.status !== SESSION_STATUS.ACTIVE) {
            return res.status(409).json({
                status: 'error',
                code: 'SESSION_NOT_ACTIVE',
                message: `Cannot analyze audio: Session is in '${session.status}' state.`
            });
        }

        const { detectedEvents } = processAudioSignals(audioMetrics, timestamp);

        if (detectedEvents.length > 0) {
            for (const ev of detectedEvents) {
                await prisma.aIShieldEvent.create({
                    data: {
                        sessionId,
                        companyId,
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
            data: {
                eventsDetected: detectedEvents.length,
                events: detectedEvents
            }
        });
    } catch (error) {
        next(error);
    }
};

// ─── 4. Ingest & Analyze Answer Integrity ─────────────────────────────────────

/**
 * POST /api/ai-shield/analyze-answers
 * Analyzes candidate answers for LLM recitation markers and CV complexity variance.
 */
export const analyzeAnswers = async (req, res, next) => {
    try {
        const companyId = resolveCompanyId(req);
        const {
            sessionId,
            answersText = '',
            cvText = '',
            jobTitle = ''
        } = req.body || {};

        if (!sessionId) {
            return res.status(400).json({
                status: 'error',
                code: 'MISSING_SESSION_ID',
                message: 'sessionId is required.'
            });
        }

        const session = await prisma.aIShieldSession.findFirst({
            where: { id: sessionId, companyId },
            include: {
                candidate: {
                    include: { recruitmentjob: true }
                }
            }
        });

        if (!session) {
            return res.status(404).json({
                status: 'error',
                code: 'SESSION_NOT_FOUND',
                message: 'AI Shield session not found or unauthorized.'
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
            data: {
                signalsDetected: signals.length,
                signals,
                metrics: extractedMetrics
            }
        });
    } catch (error) {
        next(error);
    }
};

// ─── 5. Complete AI Shield Session & Compute Final Scores ─────────────────────

/**
 * POST /api/ai-shield/complete/:sessionId
 * Closes the session and executes deterministic scoring + hard rule risk evaluation.
 */
export const completeShieldSession = async (req, res, next) => {
    try {
        const companyId = resolveCompanyId(req);
        const { sessionId } = req.params;

        const session = await prisma.aIShieldSession.findFirst({
            where: { id: sessionId, companyId },
            include: { events: true }
        });

        if (!session) {
            return res.status(404).json({
                status: 'error',
                code: 'SESSION_NOT_FOUND',
                message: 'AI Shield session not found or unauthorized.'
            });
        }

        if (session.status === SESSION_STATUS.COMPLETED) {
            return res.status(200).json({
                status: 'success',
                message: 'Session was already completed.',
                data: { session }
            });
        }

        // Deterministic Score & Risk Calculation
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
            companyId,
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

// ─── 6. Get AI Shield Report by Interview / Session ───────────────────────────

/**
 * GET /api/ai-shield/report/:interviewId
 * Fetches the complete explainable security report for an interview.
 */
export const getShieldReport = async (req, res, next) => {
    try {
        const companyId = resolveCompanyId(req);
        const { interviewId } = req.params;

        // Fetch latest session for interview
        const session = await prisma.aIShieldSession.findFirst({
            where: {
                interviewId,
                companyId
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

        // Parse structured metadata safely
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

// ─── 7. Human Review Audit Action ─────────────────────────────────────────────

/**
 * POST /api/ai-shield/review/:sessionId
 * Allows authorized HR Reviewer to mark human review decision and notes.
 */
export const submitHumanReview = async (req, res, next) => {
    try {
        const companyId = resolveCompanyId(req);
        const { sessionId } = req.params;
        const {
            status = 'REVIEWED', // UNDER_REVIEW, REVIEWED
            reviewerDecision = 'APPROVED', // APPROVED, REJECTED, INCONCLUSIVE
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
