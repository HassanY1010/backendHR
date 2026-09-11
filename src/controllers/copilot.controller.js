import prisma from '../config/db.js';
import { copilotAiService, sanitizePromptInput } from '../ai/copilot-ai.service.js';
import logger from '../utils/logger.js';

/**
 * Audit log helper specifically for Copilot actions
 */
const logCopilotAudit = async ({ companyId, userId, action, targetEntity, status = 'success', details = {} }) => {
    try {
        await prisma.auditLog.create({
            data: {
                companyId,
                userId,
                action: `COPILOT_${action}`,
                actionType: 'AI_COPILOT',
                severity: status === 'success' ? 'low' : 'medium',
                status,
                target: targetEntity || 'CopilotSession',
                details: JSON.stringify(details)
            }
        });
    } catch (e) {
        logger.error('[CopilotAuditLog] Failed to record audit log:', e.message);
    }
};

/**
 * 1. POST /api/copilot/chat
 * Multi-turn conversational endpoint with tool extraction
 */
export const chatWithCopilot = async (req, res, next) => {
    try {
        const companyId = req.user?.companyId;
        const userId = req.user?.id;
        const { message, sessionId } = req.body;

        if (!companyId) {
            return res.status(403).json({ status: 'error', message: 'غير مصرح: الحساب غير مرتبط بشركة' });
        }

        if (!message || typeof message !== 'string') {
            return res.status(400).json({ status: 'error', message: 'نص الرسالة مطلوب' });
        }

        if (message.trim().length > 3000) {
            return res.status(400).json({ status: 'error', message: 'تجاوزت الرسالة الحد الأقصى المسموح به (3000 حرف)' });
        }

        let session = null;
        let conversation = [];
        let currentExtractedData = null;

        // 1. Fetch or create Copilot Session
        if (sessionId) {
            session = await prisma.copilotSession.findFirst({
                where: { id: sessionId, companyId }
            });
            if (session) {
                conversation = Array.isArray(session.conversation) ? session.conversation : [];
                currentExtractedData = session.extractedData;
            }
        }

        if (!session) {
            session = await prisma.copilotSession.create({
                data: {
                    companyId,
                    userId,
                    title: message.substring(0, 40) + '...',
                    conversation: []
                }
            });
            conversation = [];
        }

        // 2. Append user message
        const userMsgObj = {
            id: `msg_${Date.now()}`,
            role: 'user',
            content: sanitizePromptInput(message),
            createdAt: new Date().toISOString()
        };
        conversation.push(userMsgObj);

        // 3. Process LLM response with Tools
        const aiResponse = await copilotAiService.processChat({
            messages: conversation,
            companyId,
            currentExtractedData
        });

        // 4. Handle tool outputs
        let extractedRequirements = currentExtractedData || {};
        let marketInsights = session.marketInsights || null;
        let actions = [];

        if (aiResponse.toolCalls && aiResponse.toolCalls.length > 0) {
            for (const tool of aiResponse.toolCalls) {
                if (tool.name === 'extract_job_requirements') {
                    extractedRequirements = { ...extractedRequirements, ...tool.arguments };
                    actions.push({
                        type: 'PROPOSE_JOB_CREATION',
                        label: 'إنشاء وتأكيد طلب التوظيف',
                        payload: extractedRequirements
                    });
                } else if (tool.name === 'get_market_insights') {
                    marketInsights = tool.arguments;
                }
            }
        }

        // 5. Append Assistant message
        const assistantMsgObj = {
            id: `msg_${Date.now() + 1}`,
            role: 'assistant',
            content: aiResponse.content,
            actions,
            extractedData: extractedRequirements,
            marketInsights,
            createdAt: new Date().toISOString()
        };
        conversation.push(assistantMsgObj);

        // 6. Update session in DB
        const updatedSession = await prisma.copilotSession.update({
            where: { id: session.id },
            data: {
                conversation,
                extractedData: extractedRequirements,
                marketInsights,
                updatedAt: new Date()
            }
        });

        // 7. Audit log
        await logCopilotAudit({
            companyId,
            userId,
            action: 'CHAT_MESSAGE',
            targetEntity: session.id,
            details: { messageSnippet: message.substring(0, 50), toolsCalled: aiResponse.toolCalls?.map(t => t.name) }
        });

        res.status(200).json({
            status: 'success',
            data: {
                sessionId: session.id,
                message: assistantMsgObj,
                extractedData: extractedRequirements,
                marketInsights,
                session: updatedSession
            }
        });
    } catch (error) {
        logger.error('[CopilotController] chat error:', error.message);
        next(error);
    }
};

/**
 * 2. POST /api/copilot/create-job
 * User-confirmed creation of a JobRequest
 */
export const createJobFromCopilot = async (req, res, next) => {
    try {
        const companyId = req.user?.companyId;
        const userId = req.user?.id;
        const { sessionId, jobData } = req.body;

        if (!companyId) {
            return res.status(403).json({ status: 'error', message: 'غير مصرح: الحساب غير مرتبط بشركة' });
        }

        if (!jobData || !jobData.jobTitle) {
            return res.status(400).json({ status: 'error', message: 'المسمى الوظيفي مطلوب لإنشاء الطلب' });
        }

        // Get default department if not specified
        let department = await prisma.department.findFirst({
            where: { companyId }
        });

        if (!department) {
            department = await prisma.department.create({
                data: {
                    name: 'الإدارة العامة / التوظيف',
                    companyId
                }
            });
        }

        // Idempotency / Duplicate Creation Check
        if (sessionId) {
            const existingRecent = await prisma.jobRequest.findFirst({
                where: {
                    companyId,
                    jobTitle: jobData.jobTitle,
                    createdBy: userId,
                    createdAt: {
                        gte: new Date(Date.now() - 3 * 60 * 1000) // Within last 3 minutes
                    }
                },
                include: { skills: true, department: true }
            });

            if (existingRecent) {
                return res.status(200).json({
                    status: 'success',
                    message: 'تم استرجاع طلب التوظيف الموجود مسبقاً (Idempotent)',
                    data: { jobRequest: existingRecent, isDuplicateRetried: true }
                });
            }
        }

        const requestId = `REQ-${Date.now().toString().slice(-6)}`;

        // Create Job Request
        const jobRequest = await prisma.jobRequest.create({
            data: {
                requestId,
                companyId,
                createdBy: userId,
                departmentId: department.id,
                jobTitle: jobData.jobTitle,
                location: jobData.location || 'الرياض, المملكة العربية السعودية',
                employmentType: jobData.employmentType || 'FULL_TIME',
                vacancies: Number(jobData.vacancies) || 1,
                jobSummary: jobData.jobSummary || `طلب توظيف للمنصب: ${jobData.jobTitle}`,
                requiredExperience: `${jobData.experienceYears || 3} سنوات خبرة في المجال`,
                salaryMin: jobData.suggestedSalaryMin ? Number(jobData.suggestedSalaryMin) : null,
                salaryMax: jobData.suggestedSalaryMax ? Number(jobData.suggestedSalaryMax) : null,
                status: 'SUBMITTED',
                priority: 'HIGH',
                hiringType: 'IMMEDIATE',
                skills: {
                    create: (jobData.requiredSkills || ['مهارات قيادية', 'حل المشكلات']).map(s => ({ skillName: s }))
                }
            },
            include: {
                skills: true,
                department: true
            }
        });

        // Audit log
        await logCopilotAudit({
            companyId,
            userId,
            action: 'CREATE_JOB_REQUEST',
            targetEntity: jobRequest.id,
            details: { requestId: jobRequest.requestId, jobTitle: jobRequest.jobTitle, sessionId }
        });

        res.status(201).json({
            status: 'success',
            message: 'تم إنشاء طلب التوظيف بنجاح من خلال المساعد الذكي',
            data: { jobRequest }
        });
    } catch (error) {
        logger.error('[CopilotController] createJob error:', error.message);
        next(error);
    }
};

/**
 * 3. POST /api/copilot/search-candidates
 * Deterministic + AI candidate match search within company tenant pool
 */
export const searchCandidatesWithCopilot = async (req, res, next) => {
    try {
        const companyId = req.user?.companyId;
        const userId = req.user?.id;
        const { sessionId, jobSpec } = req.body;

        if (!companyId) {
            return res.status(403).json({ status: 'error', message: 'غير مصرح: الحساب غير مرتبط بشركة' });
        }

        const effectiveJobSpec = jobSpec || {};

        // 1. Fetch company candidates strictly by companyId
        const companyCandidates = await prisma.candidate.findMany({
            where: {
                recruitmentjob: { companyId },
                deletedAt: null
            },
            include: {
                candidateSkills: true,
                candidateExperiences: true,
                recruitmentjob: { select: { title: true } }
            },
            take: 20,
            orderBy: { createdAt: 'desc' }
        });

        // 2. Score and evaluate candidates
        const evaluatedCandidates = companyCandidates.map(candidate => {
            const evaluation = copilotAiService.evaluateCandidateMatch({
                candidate,
                jobSpec: effectiveJobSpec
            });

            return {
                candidateId: candidate.id,
                fullName: candidate.fullName,
                currentTitle: candidate.currentTitle || candidate.recruitmentjob?.title || 'مرشح متخصص',
                location: candidate.location || 'غير محدد',
                yearsOfExperience: candidate.yearsOfExperience || 3,
                email: candidate.email,
                phone: candidate.phone,
                ...evaluation
            };
        });

        // 3. Sort by matchScore descending
        evaluatedCandidates.sort((a, b) => b.matchScore - a.matchScore);

        // 4. Persist top recommendations if sessionId exists
        if (sessionId && evaluatedCandidates.length > 0) {
            for (const rec of evaluatedCandidates.slice(0, 5)) {
                await prisma.aIRecommendation.create({
                    data: {
                        companyId,
                        sessionId,
                        candidateId: rec.candidateId,
                        matchScore: rec.matchScore,
                        salaryFit: rec.salaryFit,
                        scoringBreakdown: rec.scoringBreakdown,
                        strengths: rec.strengths,
                        risks: rec.risks,
                        recommendation: rec.recommendation,
                        reason: `تطابق بنسبة ${rec.matchScore}% بناءً على معايير الخبرة والمهارات`
                    }
                }).catch(() => {}); // Avoid unique crash if already saved
            }
        }

        // Funnel stats simulation
        const totalPool = companyCandidates.length;
        const funnel = {
            totalAnalyzed: totalPool,
            matchedCandidatesCount: evaluatedCandidates.length,
            shortlisted: evaluatedCandidates.filter(c => c.matchScore >= 75).length,
            topRecommended: evaluatedCandidates.slice(0, 3)
        };

        await logCopilotAudit({
            companyId,
            userId,
            action: 'SEARCH_CANDIDATES',
            targetEntity: sessionId || 'CandidateSearch',
            details: { candidatesEvaluated: companyCandidates.length, topScore: evaluatedCandidates[0]?.matchScore || 0 }
        });

        res.status(200).json({
            status: 'success',
            data: {
                funnel,
                candidates: evaluatedCandidates
            }
        });
    } catch (error) {
        logger.error('[CopilotController] searchCandidates error:', error.message);
        next(error);
    }
};

/**
 * 4. GET /api/copilot/sessions
 */
export const getCopilotSessions = async (req, res, next) => {
    try {
        const companyId = req.user?.companyId;
        const userId = req.user?.id;

        if (!companyId) {
            return res.status(403).json({ status: 'error', message: 'غير مصرح: الحساب غير مرتبط بشركة' });
        }

        const sessions = await prisma.copilotSession.findMany({
            where: { companyId, userId },
            orderBy: { updatedAt: 'desc' },
            take: 30
        });

        res.status(200).json({ status: 'success', data: { sessions } });
    } catch (error) {
        next(error);
    }
};

/**
 * 5. GET /api/copilot/sessions/:id
 */
export const getCopilotSessionDetails = async (req, res, next) => {
    try {
        const companyId = req.user?.companyId;
        const { id } = req.params;

        if (!companyId) {
            return res.status(403).json({ status: 'error', message: 'غير مصرح: الحساب غير مرتبط بشركة' });
        }

        const session = await prisma.copilotSession.findFirst({
            where: { id, companyId },
            include: {
                recommendations: {
                    include: { candidate: true }
                }
            }
        });

        if (!session) {
            return res.status(404).json({ status: 'error', message: 'جلسة المساعد الذكي غير موجودة' });
        }

        res.status(200).json({ status: 'success', data: { session } });
    } catch (error) {
        next(error);
    }
};

/**
 * 6. GET /api/copilot/recommendations
 * Tenant-isolated candidate AI recommendations
 */
export const getAIRecommendations = async (req, res, next) => {
    try {
        const companyId = req.user?.companyId;
        if (!companyId) {
            return res.status(403).json({ status: 'error', message: 'غير مصرح: الحساب غير مرتبط بشركة' });
        }

        const recommendations = await prisma.aIRecommendation.findMany({
            where: { companyId },
            include: { candidate: true },
            orderBy: { createdAt: 'desc' },
            take: 50
        });

        res.status(200).json({ status: 'success', data: { recommendations } });
    } catch (error) {
        next(error);
    }
};

