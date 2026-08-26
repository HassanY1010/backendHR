import crypto from 'crypto';
import prisma from '../config/db.js';
import logger from '../utils/logger.js';
import { aiService } from '../ai/ai-service.js';

// Helper to generate a SHA-256 hash from raw token
const hashToken = (token) => {
    return crypto.createHash('sha256').update(token).digest('hex');
};

// General practice questions bank (STRICTLY separated from real interview questions)
export const PRACTICE_QUESTIONS_BANK = [
    {
        id: 'pq-1',
        category: 'INTRO',
        question: 'عرفنا بنفسك باختصار، وما هي أبرز محطات مسيرتك المهنية؟',
        tip: 'ركز على الملخص المهني وتحدث بهدوء ووضوح دون استعجال.'
    },
    {
        id: 'pq-2',
        category: 'EXPERIENCE',
        question: 'حدثنا عن أهم إنجاز أو مشروع قمت بالعمل عليه في وظيفتك السابقة؟',
        tip: 'اذكر المشكلة، الحل الذي قدمته، والنتيجة الإيجابية التي تحققت.'
    },
    {
        id: 'pq-3',
        category: 'MOTIVATION',
        question: 'ما الذي دفعك للتقديم على هذه الفرصة والبحث عن تحدٍ جديد؟',
        tip: 'وضح شغفك بمجال العمل وكيف تتماشى أهدافك مع التطور المهني.'
    },
    {
        id: 'pq-4',
        category: 'CHALLENGE',
        question: 'حدثنا عن موقف واجهت فيه تحدياً في بيئة العمل، وكيف تعاملت معه؟',
        tip: 'ركز على المرونة والقدرة على حل المشكلات والعمل بروح الفريق.'
    }
];

/**
 * 1. Create or Retrieve Practice Session for a Candidate/Booking
 * POST /api/interviews/practice/session
 */
export const createPracticeSession = async (req, res, next) => {
    try {
        const { schedulingToken, candidateId } = req.body;

        let targetCandidateId = candidateId;
        let schedulingSessionId = null;

        // If booking token is provided, verify against SchedulingSession
        if (schedulingToken) {
            const tokenHash = hashToken(schedulingToken);
            const schedulingSession = await prisma.schedulingSession.findUnique({
                where: { tokenHash },
                include: { candidate: true }
            });

            if (!schedulingSession) {
                return res.status(404).json({
                    status: 'error',
                    code: 'SCHEDULING_NOT_FOUND',
                    message: 'جلسة المقابلة الأصلية غير موجودة أو الرابط غير صالح.'
                });
            }

            targetCandidateId = schedulingSession.candidateId;
            schedulingSessionId = schedulingSession.id;
        }

        if (!targetCandidateId) {
            return res.status(400).json({
                status: 'error',
                message: 'يجب توفير رمز الحجز أو معرف المرشح لبدء التدريب.'
            });
        }

        // Check if candidate already has a practice session (Enforce One-Time Policy)
        const existingSession = await prisma.practiceSession.findFirst({
            where: { candidateId: targetCandidateId },
            orderBy: { createdAt: 'desc' }
        });

        if (existingSession) {
            if (existingSession.status === 'COMPLETED') {
                return res.status(403).json({
                    status: 'error',
                    code: 'PRACTICE_ALREADY_COMPLETED',
                    message: 'لقد قمت بإجراء الجلسة التدريبية المخصصة لك مسبقاً. التدريب متاح لمرة واحدة فقط.',
                    data: {
                        sessionId: existingSession.id,
                        status: existingSession.status,
                        completedAt: existingSession.completedAt,
                        overallScore: existingSession.overallScore
                    }
                });
            }

            if (new Date() < new Date(existingSession.expiresAt)) {
                // If existing session is still active and not completed, return it
                return res.status(200).json({
                    status: 'success',
                    message: 'استئناف الجلسة التدريبية الحالية.',
                    data: {
                        sessionId: existingSession.id,
                        status: existingSession.status,
                        expiresAt: existingSession.expiresAt
                    }
                });
            }
        }

        // Generate strong unguessable raw token
        const rawToken = crypto.randomBytes(32).toString('hex');
        const tokenHash = hashToken(rawToken);
        const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours expiry

        const newSession = await prisma.practiceSession.create({
            data: {
                candidateId: targetCandidateId,
                schedulingSessionId,
                tokenHash,
                status: 'ACTIVE',
                expiresAt,
                startedAt: new Date()
            }
        });

        res.status(201).json({
            status: 'success',
            data: {
                sessionId: newSession.id,
                practiceToken: rawToken,
                expiresAt: newSession.expiresAt,
                maxDurationSeconds: 180, // 3 minutes max
                minDurationSeconds: 60   // 1 minute min
            }
        });
    } catch (error) {
        next(error);
    }
};

/**
 * 2. Get Practice Session Details by Token (Public Candidate Access)
 * GET /api/interviews/practice/session/:token
 */
export const getPracticeSessionDetails = async (req, res, next) => {
    try {
        const { token } = req.params;
        if (!token) {
            return res.status(400).json({ status: 'error', message: 'Token is required' });
        }

        const tokenHash = hashToken(token);
        const session = await prisma.practiceSession.findUnique({
            where: { tokenHash },
            include: {
                candidate: {
                    select: {
                        id: true,
                        fullName: true,
                        email: true,
                        recruitmentjob: {
                            select: { title: true, department: true }
                        }
                    }
                }
            }
        });

        if (!session) {
            return res.status(404).json({
                status: 'error',
                code: 'INVALID_PRACTICE_TOKEN',
                message: 'رابط التدريب غير صحيح أو غير موجود.'
            });
        }

        if (session.status === 'COMPLETED') {
            return res.status(403).json({
                status: 'error',
                code: 'SESSION_ALREADY_COMPLETED',
                message: 'تم إكمال هذه الجلسة التدريبية مسبقاً، التدريب متاح لمرة واحدة فقط.',
                data: {
                    completedAt: session.completedAt,
                    overallScore: session.overallScore,
                    feedback: session.feedback
                }
            });
        }

        if (new Date() > new Date(session.expiresAt)) {
            return res.status(410).json({
                status: 'error',
                code: 'SESSION_EXPIRED',
                message: 'انتهت صلاحية جلسة التدريب المخصصة لك.'
            });
        }

        res.status(200).json({
            status: 'success',
            data: {
                sessionId: session.id,
                candidateName: session.candidate.fullName,
                jobTitle: session.candidate.recruitmentjob?.title || 'وظيفة عامة',
                status: session.status,
                maxDurationSeconds: 180,
                minDurationSeconds: 60,
                expiresAt: session.expiresAt
            }
        });
    } catch (error) {
        next(error);
    }
};

/**
 * 3. Get Public Practice Questions
 * GET /api/interviews/practice/questions
 */
export const getPracticeQuestions = async (req, res) => {
    // Return practice questions bank directly (Guaranteed independent from real interview questions)
    res.status(200).json({
        status: 'success',
        data: PRACTICE_QUESTIONS_BANK
    });
};

/**
 * 4. Analyze Practice Performance and Generate AI Coach Report
 * POST /api/interviews/practice/analyze
 */
export const analyzePracticeSession = async (req, res, next) => {
    try {
        const { token, durationSeconds, answers, audioMetrics, videoMetrics } = req.body;

        if (!token) {
            return res.status(400).json({ status: 'error', message: 'Token is required' });
        }

        const tokenHash = hashToken(token);
        const session = await prisma.practiceSession.findUnique({
            where: { tokenHash },
            include: {
                candidate: {
                    include: { recruitmentjob: true }
                }
            }
        });

        if (!session) {
            return res.status(404).json({ status: 'error', code: 'INVALID_TOKEN', message: 'جلسة التدريب غير صالحة.' });
        }

        if (session.status === 'COMPLETED') {
            return res.status(403).json({
                status: 'error',
                code: 'SESSION_ALREADY_COMPLETED',
                message: 'تم إنهاء وتحليل هذه الجلسة مسبقاً.'
            });
        }

        const validDuration = Math.min(180, Math.max(10, parseInt(durationSeconds, 10) || 60));
        const companyId = session.candidate.recruitmentjob?.companyId;

        // Run AI analysis with strictly real data
        const evaluation = await aiService.evaluatePracticeSession({
            answers: answers || [],
            audioMetrics: audioMetrics || {},
            videoMetrics: videoMetrics || {},
            durationSeconds: validDuration,
            companyId
        });

        // Persist completed practice session
        const updatedSession = await prisma.practiceSession.update({
            where: { id: session.id },
            data: {
                duration: validDuration,
                overallScore: evaluation.overallScore,
                communicationScore: evaluation.communicationScore,
                answerScore: evaluation.answerScore,
                voiceScore: evaluation.voiceScore,
                visualScore: evaluation.visualScore,
                confidenceIndicators: evaluation.confidenceIndicators,
                feedback: evaluation.feedback,
                answersData: answers || [],
                status: 'COMPLETED',
                completedAt: new Date()
            }
        });

        res.status(200).json({
            status: 'success',
            message: 'تم تحليل أداء الجلسة التدريبية بنجاح.',
            data: {
                sessionId: updatedSession.id,
                duration: updatedSession.duration,
                overallScore: updatedSession.overallScore,
                communicationScore: updatedSession.communicationScore,
                answerScore: updatedSession.answerScore,
                voiceScore: updatedSession.voiceScore,
                visualScore: updatedSession.visualScore,
                confidenceIndicators: updatedSession.confidenceIndicators,
                feedback: updatedSession.feedback,
                completedAt: updatedSession.completedAt
            }
        });
    } catch (error) {
        next(error);
    }
};
