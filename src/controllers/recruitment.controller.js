import { createRequire } from 'module';
import { aiService } from '../ai/ai-service.js';
import { createNotification } from './notification.controller.js';
import { SearchService } from '../services/search.service.js';
import crypto from 'crypto';
import { extractTextFromPDF } from '../utils/pdfExtractor.js';
import prisma from '../config/db.js';
import fs from 'fs';
import path from 'path';
import { getMimeTypeFromBuffer } from '../utils/magic-bytes.js';
import { uploadFileToSupabase } from '../utils/supabase.js';
import { emailService } from '../services/email.service.js';
import { jobRequestSyncService } from '../services/jobRequestSync.service.js';
import { CandidateStateMachine, NORMALIZE_STATUS } from '../services/candidateStateMachine.js';
import { auditService } from '../services/audit.service.js';
import logger from '../utils/logger.js';

// Helper to check file security
const validateFile = (fileInput) => {
    try {
        let buffer;
        if (Buffer.isBuffer(fileInput)) {
            buffer = fileInput;
        } else {
            buffer = fs.readFileSync(fileInput);
        }
        // Check first 4KB to be safe or just header
        const header = buffer.subarray(0, 4);
        const mime = getMimeTypeFromBuffer(header);

        if (mime === 'unknown') {
            return { valid: false, error: 'File type verification failed (Magic Bytes).' };
        }
        return { valid: true, mime, buffer };
    } catch (e) {
        return { valid: false, error: 'File read error.' };
    }
};

export const getAllJobs = async (req, res, next) => {
    try {
        const companyId = req.user?.companyId || req.user?.company?.id;
        if (!companyId) {
            return res.status(403).json({ status: 'error', message: 'غير مصرح: الحساب غير مرتبط بشركة' });
        }

        const jobs = await prisma.recruitmentJob.findMany({
            where: companyId ? {
                companyId,
                deletedAt: null
            } : { deletedAt: null },
            include: { _count: { select: { candidates: true } } },
            orderBy: { createdAt: 'desc' }
        });

        const parsedJobs = jobs.map(job => {
            let salaryRange = job.salaryRange;
            if (typeof salaryRange === 'string') {
                try { salaryRange = JSON.parse(salaryRange); } catch (e) { /* keep as string/raw */ }
            }
            let requirements = job.requirements;
            if (typeof requirements === 'string') {
                try { requirements = JSON.parse(requirements); } catch (e) { /* keep as string/raw */ }
            }
            let responsibilities = job.responsibilities;
            if (typeof responsibilities === 'string') {
                try { responsibilities = JSON.parse(responsibilities); } catch (e) { /* keep as string/raw */ }
            }

            return {
                ...job,
                salaryRange,
                requirements,
                responsibilities,
                applicantsCount: job._count?.candidates || 0
            };
        });

        res.status(200).json({ status: 'success', data: { jobs: parsedJobs } });
    } catch (error) {
        logger.error('[Recruitment] getAllJobs error:', error.message);
        next(error);
    }
};

export const getPublicJobs = async (req, res, next) => {
    try {
        const jobs = await prisma.recruitmentJob.findMany({
            where: { 
                status: 'OPEN',
                deletedAt: null
            },
            select: {
                id: true,
                title: true,
                department: true,
                location: true,
                type: true,
                company: { select: { name: true } },
                createdAt: true
            }
        });

        res.status(200).json({ status: 'success', data: { jobs } });
    } catch (error) {
        next(error);
    }
};

export const getPublicJobDetails = async (req, res, next) => {
    try {
        const job = await prisma.recruitmentJob.findFirst({
            where: { 
                id: req.params.id,
                deletedAt: null 
            },
            include: { company: { select: { name: true } } }
        });

        if (!job) {
            const error = new Error('Job not found');
            error.statusCode = 404;
            throw error;
        }

        res.status(200).json({ status: 'success', data: { job } });
    } catch (error) {
        next(error);
    }
};

export const createJob = async (req, res, next) => {
    try {
        const {
            title,
            description,
            department,
            departmentId,
            location,
            type,
            requirements,
            responsibilities,
            salaryRange,
            aiDescription,
            employmentType,
            city,
            workMode,
            seniorityLevel,
            yearsOfExperience,
            previousCompanyType,
            managedTeamBefore,
            teamSize,
            salaryMin,
            salaryMax,
            workEnvironment,
            openingReason,
            status
        } = req.body;

        const companyId = req.user.companyId;
        if (!companyId) {
            return res.status(403).json({ status: 'error', message: 'غير مصرح: الحساب غير مرتبط بشركة' });
        }

        // Validate title
        if (!title || typeof title !== 'string' || !title.trim()) {
            return res.status(400).json({ status: 'error', message: 'عنوان الوظيفة مطلوب ولا يمكن أن يكون فارغاً' });
        }

        // Normalize status: 'draft' -> 'ON_HOLD', 'published' -> 'OPEN', 'OPEN' -> 'OPEN', 'ON_HOLD' -> 'ON_HOLD'
        let finalStatus = 'OPEN';
        if (status === 'draft' || status === 'ON_HOLD') {
            finalStatus = 'ON_HOLD';
        } else if (status === 'published' || status === 'OPEN') {
            finalStatus = 'OPEN';
        } else if (status === 'CLOSED') {
            finalStatus = 'CLOSED';
        }

        // If publishing directly (OPEN), require description
        if (finalStatus === 'OPEN' && (!description || !description.trim())) {
            return res.status(400).json({ status: 'error', message: 'لا يمكن نشر الوظيفة بدون كتابة الوصف الوظيفي' });
        }

        const job = await prisma.recruitmentJob.create({
            data: {
                title: title.trim(),
                description: description || '',
                department,
                departmentId,
                location,
                type,
                requirements: requirements && typeof requirements === 'object' ? JSON.stringify(requirements) : requirements,
                responsibilities: responsibilities && typeof responsibilities === 'object' ? JSON.stringify(responsibilities) : responsibilities,
                salaryRange: salaryRange && typeof salaryRange === 'object' ? JSON.stringify(salaryRange) : salaryRange,
                aiDescription,
                employmentType,
                city,
                workMode,
                seniorityLevel,
                yearsOfExperience,
                previousCompanyType,
                managedTeamBefore,
                teamSize,
                salaryMin,
                salaryMax,
                workEnvironment,
                openingReason,
                status: finalStatus,
                createdBy: req.user.id,
                companyId,
                updatedAt: new Date()
            },
        });

        res.status(201).json({ status: 'success', data: { job } });
    } catch (error) {
        next(error);
    }
};

export const generateAiJobDescription = async (req, res, next) => {
    try {
        const { title, skills, responsibilities } = req.body;

        const aiResult = await aiService.generateJobDescription(
            { title, skills, responsibilities },
            req.user.companyId
        );

        res.status(200).json({
            status: 'success',
            data: {
                aiDescription: aiResult.job_summary,
                fullDetails: aiResult
            }
        });
    } catch (error) {
        next(error);
    }
};

export const getDailyRecruitmentAnalysis = async (req, res, next) => {
    try {
        const companyId = req.user.companyId;
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const [cvAnalyzedToday, highMatchCandidates, activeJobs] = await Promise.all([
            prisma.candidate.count({
                where: {
                    recruitmentjob: { companyId },
                    createdAt: { gte: today }
                }
            }),
            prisma.candidate.count({
                where: {
                    recruitmentjob: { companyId },
                    aiScore: { gte: 90 },
                    createdAt: { gte: today }
                }
            }),
            prisma.recruitmentJob.count({
                where: { companyId, status: 'OPEN' }
            })
        ]);

        res.status(200).json({
            status: 'success',
            data: {
                cvAnalyzedToday,
                highMatchCandidates,
                activeJobs,
                accuracy: 94
            }
        });
    } catch (error) {
        next(error);
    }
};

export const getJobDetails = async (req, res, next) => {
    try {
        const job = await prisma.recruitmentJob.findUnique({
            where: { id: req.params.id },
            include: {
                candidates: {
                    include: { interviews: true },
                    orderBy: { aiScore: 'desc' }
                },
                departmentRel: true
            },
        });

        if (!job || job.companyId !== req.user.companyId) {
            const error = new Error('Job not found');
            error.statusCode = 404;
            throw error;
        }

        res.status(200).json({ status: 'success', data: { job } });
    } catch (error) {
        next(error);
    }
};

export const handleInteractiveAiJobFlow = async (req, res, next) => {
    try {
        const { messages } = req.body;
        const companyId = req.user.companyId;

        if (!messages || !Array.isArray(messages)) {
            const error = new Error('Messages array is required');
            error.statusCode = 400;
            throw error;
        }

        const aiResponse = await aiService.interactiveJobRecruiter(messages, companyId);

        res.status(200).json({
            status: 'success',
            data: aiResponse
        });
    } catch (error) {
        next(error);
    }
};

export const parseCV = async (req, res, next) => {
    try {
        if (!req.file) {
            const error = new Error('No resume file uploaded');
            error.statusCode = 400;
            throw error;
        }

        // Security Check
        const validCheck = validateFile(req.file.buffer);
        if (!validCheck.valid) {
            const error = new Error(validCheck.error || "File validation failed");
            error.statusCode = 400;
            throw error;
        }

        let resumeText = '';

        try {
            if (validCheck.mime === 'application/pdf') {
                resumeText = await extractTextFromPDF(validCheck.buffer);
            } else if (validCheck.mime.includes('wordprocessingml')) {
                const mammoth = await import('mammoth');
                const result = await mammoth.extractRawText({ buffer: validCheck.buffer });
                resumeText = result.value;
            }
        } catch (parseError) {
            logger.error('Error parsing resume', { error: parseError.message });
        }

        let aiData = {};
        if (resumeText) {
            try {
                aiData = await aiService.extractCVData(resumeText, req.user?.companyId || 'PUBLIC');
            } catch (aiError) {
                logger.error('AI CV extraction failed', { error: aiError.message });
            }
        }

        res.status(200).json({
            status: 'success',
            data: {
                extracted: {
                    name: aiData?.name || '',
                    email: aiData?.email || '',
                    phone: aiData?.phone || '',
                    location: aiData?.location || '',
                    skills: aiData?.skills || [],
                    experience_years: aiData?.experience_years || 0
                }
            }
        });

    } catch (error) {
        next(error);
    }
};


export const applyToJob = async (req, res, next) => {
    try {
        const { name, fullName, email, phone, resumeUrl, location } = req.body;
        const jobId = req.params.id;

        const candidateName = (fullName || name || '').trim();
        const candidateEmail = (email || '').trim().toLowerCase();

        if (!candidateName || !candidateEmail) {
            return res.status(400).json({ status: 'error', message: 'الاسم والبريد الإلكتروني مطلوبان لإتمام التقديم' });
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(candidateEmail)) {
            return res.status(400).json({ status: 'error', message: 'صيغة البريد الإلكتروني غير صحيحة' });
        }

        const interviewCode = crypto.randomBytes(4).toString('hex').toUpperCase();

        // Find linked recruitment job or job request fallback
        let recJob = await prisma.recruitmentJob.findFirst({
            where: { id: jobId, deletedAt: null }
        });

        if (!recJob) {
            const jobReq = await prisma.jobRequest.findFirst({
                where: { id: jobId, deletedAt: null }
            });
            if (jobReq) {
                recJob = await prisma.recruitmentJob.findFirst({
                    where: { companyId: jobReq.companyId, title: jobReq.jobTitle, deletedAt: null }
                }) || await prisma.recruitmentJob.create({
                    data: {
                        companyId: jobReq.companyId,
                        title: jobReq.jobTitle,
                        department: jobReq.departmentId,
                        location: jobReq.location || 'الرياض',
                        status: 'OPEN'
                    }
                });
            }
        }

        if (!recJob) {
            return res.status(404).json({ status: 'error', message: 'الوظيفة غير موجودة أو معلقة' });
        }

        // Check for duplicate application on the exact same job
        const existingApplicant = await prisma.candidate.findFirst({
            where: {
                jobId: recJob.id,
                email: { equals: candidateEmail, mode: 'insensitive' },
                deletedAt: null
            }
        });

        if (existingApplicant) {
            return res.status(409).json({
                status: 'error',
                message: 'لقد قمت بالتقديم على هذه الوظيفة مسبقاً بنفس البريد الإلكتروني.'
            });
        }

        const candidate = await prisma.$transaction(async (tx) => {
            const created = await tx.candidate.create({
                data: {
                    fullName: candidateName,
                    email: candidateEmail,
                    phone: phone ? String(phone).trim() : '',
                    resumeUrl: resumeUrl || null,
                    location: location || null,
                    jobId: recJob.id,
                    interviewCode,
                    status: 'NEW',
                    updatedAt: new Date()
                }
            });

            // Log source accurately in CandidateHistory
            await tx.candidateHistory.create({
                data: {
                    candidateId: created.id,
                    action: 'CANDIDATE_CREATED:PUBLIC_PORTAL',
                    oldStatus: null,
                    newStatus: 'NEW',
                    comment: `تقديم طلب وظيفي ذاتي عبر بوابة التوظيف العامة (وظيفة: ${recJob.title})`,
                    performedBy: 'CANDIDATE_PORTAL'
                }
            });

            return created;
        }, { timeout: 15000, maxWait: 10000 });

        // Instant response to user
        res.status(201).json({
            status: 'success',
            message: 'تم تقديم طلبك بنجاح ✨',
            data: {
                candidateId: candidate.id,
                interviewCode
            }
        });

        // Non-blocking notifications
        (async () => {
            try {
                const managers = await prisma.user.findMany({
                    where: {
                        companyId: recJob.companyId,
                        role: { in: ['MANAGER', 'ADMIN', 'SUPER_ADMIN', 'HR_MANAGER'] }
                    },
                    select: { id: true, employee: { select: { id: true } } }
                });

                for (const manager of managers) {
                    await createNotification({
                        userId: manager.id,
                        employeeId: manager.employee?.id,
                        title: 'طلب توظيف جديد',
                        message: `تقدم ${candidateName} لوظيفة ${recJob.title}`,
                        type: 'recruitment',
                        priority: 'high',
                        metadata: { candidateId: candidate.id, jobId: recJob.id }
                    });
                }
            } catch (notifError) {
                logger.error('Failed to notify managers', { error: notifError.message });
            }
        })();
    } catch (error) {
        logger.error('applyToJob error:', error.message);
        next(error);
    }
};

export const getInterviewByCode = async (req, res, next) => {
    try {
        const { code } = req.params;
        const candidate = await prisma.candidate.findUnique({
            where: { interviewCode: code },
            include: { recruitmentjob: true }
        });

        if (!candidate) {
            const error = new Error('Invalid interview code');
            error.statusCode = 404;
            throw error;
        }

        res.status(200).json({ status: 'success', data: { candidate } });
    } catch (error) {
        next(error);
    }
};

export const getInterviewByToken = async (req, res, next) => {
    try {
        const { token } = req.params;

        // 1. Try to find interview directly by its token field
        let interview = await prisma.interview.findUnique({
            where: { token },
            include: {
                candidate: {
                    include: { recruitmentjob: true }
                }
            }
        });

        // 2. Fallback: The token in the URL might be the candidate's interviewCode
        if (!interview) {
            const candidate = await prisma.candidate.findUnique({
                where: { interviewCode: token },
                include: { recruitmentjob: true }
            });

            if (candidate) {
                // Look for an existing incomplete interview for this candidate
                interview = await prisma.interview.findFirst({
                    where: { candidateId: candidate.id, completed: false },
                    include: { candidate: { include: { recruitmentjob: true } } },
                    orderBy: { createdAt: 'desc' }
                });

                // No interview yet for this candidate — create a fresh one
                if (!interview) {
                    const newToken = crypto.randomBytes(16).toString('hex');
                    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
                    interview = await prisma.interview.create({
                        data: {
                            candidateId: candidate.id,
                            jobId: candidate.jobId,
                            type: 'VIDEO',
                            status: 'scheduled',
                            scheduledAt: new Date(),
                            interviewerName: 'تلقائي',
                            token: newToken,
                            expiresAt
                        },
                        include: { candidate: { include: { recruitmentjob: true } } }
                    });
                }
            }
        }

        if (!interview) {
            const error = new Error('رابط المقابلة غير صالح');
            error.statusCode = 404;
            throw error;
        }

        // Check expiration
        if (interview.expiresAt && new Date() > new Date(interview.expiresAt)) {
            const error = new Error('انتهت صلاحية رابط المقابلة');
            error.statusCode = 410; // Gone
            throw error;
        }

        res.status(200).json({ status: 'success', data: { interview } });
    } catch (error) {
        next(error);
    }
};

export const getInterviewQuestionsByToken = async (req, res, next) => {
    try {
        const { token } = req.params;
        // 1. Try to find interview directly by its token field
        let interview = await prisma.interview.findUnique({
            where: { token },
            include: {
                candidate: {
                    include: { recruitmentjob: true }
                }
            }
        });

        // 2. Fallback: The token in the URL might be the candidate's interviewCode
        if (!interview) {
            const candidate = await prisma.candidate.findUnique({
                where: { interviewCode: token },
                include: { recruitmentjob: true }
            });

            if (candidate) {
                // Look for an existing incomplete interview for this candidate
                interview = await prisma.interview.findFirst({
                    where: { candidateId: candidate.id, completed: false },
                    include: { candidate: { include: { recruitmentjob: true } } },
                    orderBy: { createdAt: 'desc' }
                });
            }
        }

        if (!interview || !interview.candidate) {
            const error = new Error('المقابلة غير موجودة');
            error.statusCode = 404;
            throw error;
        }

        const candidate = interview.candidate;
        let skills = [];
        if (candidate.skills) {
            skills = Array.isArray(candidate.skills) ? candidate.skills : JSON.parse(JSON.stringify(candidate.skills));
        }

        const questions = await aiService.generateInterviewQuestions(
            candidate.recruitmentjob.title,
            skills,
            {
                seniority: candidate.recruitmentjob.seniority || 'MID',
                questionsCount: 5
            }
        );

        res.status(200).json({ status: 'success', data: { questions } });
    } catch (error) {
        next(error);
    }
};

export const getInterviewQuestions = async (req, res, next) => {
    try {
        const { code } = req.params;
        const candidate = await prisma.candidate.findUnique({
            where: { interviewCode: code },
            include: { recruitmentjob: true }
        });

        if (!candidate) {
            const error = new Error('Invalid interview code');
            error.statusCode = 404;
            throw error;
        }

        let skills = [];
        if (candidate.skills) {
            skills = Array.isArray(candidate.skills) ? candidate.skills : JSON.parse(JSON.stringify(candidate.skills));
        }

        const questions = await aiService.generateInterviewQuestions(
            candidate.recruitmentjob.title,
            skills,
            {
                description: candidate.recruitmentjob.description,
                requirements: candidate.recruitmentjob.requirements,
                responsibilities: candidate.recruitmentjob.responsibilities
            }
        );

        res.status(200).json({ status: 'success', data: { questions } });
    } catch (error) {
        next(error);
    }
};

export const submitInterviewAnswer = async (req, res, next) => {
    try {
        const { candidateId, type, videoUrl, notes, token } = req.body;

        // 1. Validate Token if provided (New Security Layer)
        // 1. Validate Token if provided (New Security Layer)
        let interview;
        if (token) {
            // A. Try to find interview directly by its token field
            interview = await prisma.interview.findUnique({
                where: { token },
                include: { candidate: true }
            });

            // B. Fallback: The token might be the candidate's interviewCode
            if (!interview) {
                const candidate = await prisma.candidate.findUnique({
                    where: { interviewCode: token },
                    include: { recruitmentjob: true }
                });

                if (candidate) {
                    interview = await prisma.interview.findFirst({
                        where: { candidateId: candidate.id, completed: false },
                        include: { candidate: true },
                        orderBy: { createdAt: 'desc' }
                    });
                }
            }

            if (!interview) {
                return res.status(404).json({ status: 'error', message: 'رمز المقابلة غير صحيح' });
            }

            if (interview.completed) {
                return res.status(400).json({ status: 'error', message: 'تم إرسال هذه المقابلة مسبقاً' });
            }

            if (interview.expiresAt && new Date() > new Date(interview.expiresAt)) {
                return res.status(400).json({ status: 'error', message: 'انتهت صلاحية رمز المقابلة' });
            }
        }

        // 2. Enforce token or valid interviewCode requirement (no anonymous backdoors)
        if (!interview && candidateId) {
            // Require valid interviewCode matching candidate
            const candidate = await prisma.candidate.findUnique({
                where: { id: candidateId },
                include: { recruitmentjob: true }
            });
            if (candidate) {
                interview = await prisma.interview.findFirst({
                    where: { candidateId, completed: false },
                    orderBy: { createdAt: 'desc' }
                });
            }
        }

        if (!interview) {
            return res.status(404).json({ status: 'error', message: 'لم يتم العثور على مقابلة نشطة ومصرح بها لهذا المرشح' });
        }

        if (interview.completed) {
            return res.status(400).json({ status: 'error', message: 'تم إرسال هذه المقابلة مسبقاً' });
        }

        if (interview.expiresAt && new Date() > new Date(interview.expiresAt)) {
            return res.status(410).json({ status: 'error', message: 'انتهت صلاحية رابط المقابلة' });
        }

        // Update existing interview to completed
        interview = await prisma.interview.update({
            where: { id: interview.id },
            data: {
                videoUrl,
                notes,
                completed: true,
                status: 'completed',
                completedAt: new Date()
            }
        });

        // 3. AI Evaluation (run asynchronously to avoid timeout on Render free tier)
        const candidate = await prisma.candidate.findUnique({
            where: { id: interview.candidateId },
            include: { recruitmentjob: true }
        });

        // Return success immediately so the candidate doesn't wait for AI analysis
        res.status(200).json({
            status: 'success',
            data: {
                interview: { ...interview, status: 'completed' },
                message: 'تم حفظ المقابلة، جاري تحليل النتائج...'
            }
        });

        // Run AI evaluation in background
        try {
            const jobTitle = candidate?.recruitmentjob?.title || 'الوظيفة';
            const questions = ['General Questions'];
            const answers = notes || 'No notes provided';

            const evaluationResult = await aiService.evaluateInterview(
                questions,
                answers,
                candidate.recruitmentjob?.companyId,
                jobTitle,
                candidate.skills ? (typeof candidate.skills === 'string' ? candidate.skills.split(',') : candidate.skills) : []
            );

            const aiAnalysis = {
                communication: evaluationResult.score || 0,
                technical: 0,
                overall: evaluationResult.score || 0,
                strengths: evaluationResult.strengths || [],
                weaknesses: evaluationResult.weaknesses || [],
                decision: evaluationResult.decision || 'PENDING_REVIEW',
                recommendation: evaluationResult.decision || 'PENDING_REVIEW',
                isEvaluated: evaluationResult.isEvaluated ?? false
            };

            const score = evaluationResult.score;
            const summary = evaluationResult.summary || 'تم تسجيل المقابلة بنجاح وهي بانتظار المراجعة والتقييم.';

            await prisma.interview.update({
                where: { id: interview.id },
                data: {
                    aiAnalysis: JSON.stringify(aiAnalysis),
                    aiScore: score,
                    aiSummary: summary,
                    completedAt: new Date(),
                    status: 'completed'
                }
            });

            // Enforce candidate state machine and HIRED lockdown
            if (candidate && candidate.status !== 'HIRED') {
                const canTransition = CandidateStateMachine.canTransition(candidate.status, 'INTERVIEW_COMPLETED');
                if (canTransition) {
                    await prisma.candidate.update({
                        where: { id: interview.candidateId },
                        data: {
                            status: 'INTERVIEW_COMPLETED',
                            aiScore: score,
                            aiSummary: summary,
                            updatedAt: new Date()
                        }
                    });
                }
            }

            // 🔄 Automatic sync to linked JobRequest on interview completion
            if (candidate && candidate.recruitmentjob) {
                const jobReq = await prisma.jobRequest.findFirst({
                    where: {
                        jobTitle: candidate.recruitmentjob.title,
                        companyId: candidate.recruitmentjob.companyId,
                        deletedAt: null
                    }
                });

                if (jobReq) {
                    await prisma.jobRequest.update({
                        where: { id: jobReq.id },
                        data: { status: 'INTERVIEW_PROCESS' }
                    });

                    await prisma.jobRequestHistory.create({
                        data: {
                            jobRequestId: jobReq.id,
                            action: 'إكمال المقابلة والذكاء الاصطناعي',
                            oldStatus: jobReq.status,
                            newStatus: 'INTERVIEW_PROCESS',
                            comment: `تحديث تلقائي للنظام بعد إكمال المقابلة للمرشح (${candidate.fullName}) بنتيجة ${score}%`
                        }
                    });
                }
            }
        } catch (aiError) {
            logger.error('Background AI evaluation failed', { interviewId: interview.id, error: aiError.message });
        }
    } catch (error) {
        next(error);
    }
};

export const createCandidate = async (req, res, next) => {
    try {
        const companyId = req.user?.companyId || req.user?.company?.id;
        if (!companyId) {
            return res.status(403).json({ status: 'error', message: 'غير مصرح: الحساب غير مرتبط بشركة' });
        }

        const { name, fullName, email, phone, resumeUrl, jobId } = req.body;

        const candidateName = (fullName || name || '').trim();
        const candidateEmail = (email || '').trim().toLowerCase();

        if (!candidateName || !candidateEmail || !jobId) {
            return res.status(400).json({ status: 'error', message: 'الاسم والبريد الإلكتروني والوظيفة مطلوبة لإتمام التسجيل' });
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(candidateEmail)) {
            return res.status(400).json({ status: 'error', message: 'صيغة البريد الإلكتروني غير صحيحة' });
        }

        // Strict Tenant Isolation: Ensure target job belongs to user's company
        const targetJob = await prisma.recruitmentJob.findFirst({
            where: { id: jobId, companyId, deletedAt: null }
        });

        if (!targetJob) {
            return res.status(404).json({ status: 'error', message: 'الوظيفة المحددة غير موجودة أو غير تابعة لشركتكم' });
        }

        // Check duplicate applicant on the same job
        const existingApplicant = await prisma.candidate.findFirst({
            where: {
                jobId,
                email: { equals: candidateEmail, mode: 'insensitive' },
                deletedAt: null
            }
        });

        if (existingApplicant) {
            return res.status(409).json({
                status: 'error',
                message: 'المرشح مسجل بالفعل على هذه الوظيفة بنفس البريد الإلكتروني.'
            });
        }

        const interviewCode = crypto.randomBytes(4).toString('hex').toUpperCase();

        const candidate = await prisma.$transaction(async (tx) => {
            const created = await tx.candidate.create({
                data: {
                    fullName: candidateName,
                    email: candidateEmail,
                    phone: phone ? String(phone).trim() : null,
                    resumeUrl: resumeUrl || null,
                    jobId,
                    interviewCode,
                    status: 'NEW',
                    updatedAt: new Date()
                },
                include: { recruitmentjob: true }
            });

            // Record source accurately in CandidateHistory
            await tx.candidateHistory.create({
                data: {
                    candidateId: created.id,
                    action: 'CANDIDATE_CREATED:DIRECT_ATS_ENTRY',
                    oldStatus: null,
                    newStatus: 'NEW',
                    comment: `تم تسجيل المرشح يدوياً عبر لوحة التحكم (وظيفة: ${targetJob.title})`,
                    performedBy: req.user?.id || 'SYSTEM'
                }
            });

            return created;
        }, { timeout: 15000, maxWait: 10000 });

        // 🔄 Auto sync JobRequest status when a candidate applies/created
        if (candidate.recruitmentjob) {
            const jobReq = await prisma.jobRequest.findFirst({
                where: {
                    jobTitle: candidate.recruitmentjob.title,
                    companyId: candidate.recruitmentjob.companyId,
                    deletedAt: null
                }
            });

            if (jobReq && ['APPROVED', 'RECRUITMENT_STARTED'].includes(jobReq.status)) {
                await prisma.jobRequest.update({
                    where: { id: jobReq.id },
                    data: { status: 'INTERVIEW_PROCESS' }
                });

                await prisma.jobRequestHistory.create({
                    data: {
                        jobRequestId: jobReq.id,
                        action: 'بدء استقبال المرشحين والمقابلات تلقائياً',
                        oldStatus: jobReq.status,
                        newStatus: 'INTERVIEW_PROCESS',
                        comment: `تحديث تلقائي عند تقديم المرشح (${candidate.fullName}) على الوظيفة`
                    }
                });
            }
        }

        res.status(201).json({ status: 'success', data: { candidate } });
    } catch (error) {
        next(error);
    }
};

export const getCandidates = async (req, res, next) => {
    try {
        const candidates = await prisma.candidate.findMany({
            where: {
                recruitmentjob: { companyId: req.user.companyId },
                deletedAt: null
            },
            include: { recruitmentjob: true, interviews: true },
            orderBy: { aiScore: 'desc' }
        });
        res.status(200).json({ status: 'success', data: { candidates } });
    } catch (error) {
        next(error);
    }
};

export const updateCandidate = async (req, res, next) => {
    try {
        const companyId = req.user?.companyId;
        const candidateId = req.params.id;
        const data = { ...req.body };

        // 1. Company boundary check
        const existingCandidate = await prisma.candidate.findFirst({
            where: {
                id: candidateId,
                recruitmentjob: { companyId },
                deletedAt: null
            },
            include: { recruitmentjob: true }
        });

        if (!existingCandidate) {
            return res.status(404).json({
                status: 'error',
                message: 'المرشح غير موجود أو لا تملك صلاحية الوصول إليه'
            });
        }

        // 2. State Machine validation if status is changing
        if (data.status) {
            const targetStatus = NORMALIZE_STATUS(data.status);
            CandidateStateMachine.validateTransition(existingCandidate.status, targetStatus, { comment: data.comment });
            data.status = targetStatus;
        }

        const { comment, ...updateFields } = data;

        const candidate = await prisma.$transaction(async (tx) => {
            const updated = await tx.candidate.update({
                where: { id: candidateId },
                data: {
                    ...updateFields,
                    updatedAt: new Date()
                },
                include: { recruitmentjob: true }
            });

            if (data.status && data.status !== existingCandidate.status) {
                // Audit in CandidateHistory
                await tx.candidateHistory.create({
                    data: {
                        candidateId,
                        action: `تغيير مرحلة المرشح إلى ${data.status}`,
                        oldStatus: existingCandidate.status,
                        newStatus: data.status,
                        comment: (data.comment || `تحديث المرشح إلى ${data.status}`).substring(0, 500),
                        performedBy: req.user?.id || 'SYSTEM'
                    }
                });

                // AuditLog
                await tx.auditLog.create({
                    data: {
                        userId: req.user?.id || null,
                        companyId,
                        action: 'CANDIDATE_STATUS_CHANGED',
                        actionType: 'ATS_PIPELINE',
                        severity: ['HIRED', 'REJECTED'].includes(data.status) ? 'high' : 'medium',
                        target: candidateId,
                        status: 'success',
                        ip: req.ip || null,
                        details: JSON.stringify({
                            candidateId,
                            candidateName: existingCandidate.fullName,
                            jobId: existingCandidate.jobId,
                            oldStatus: existingCandidate.status,
                            newStatus: data.status,
                            comment: data.comment || null
                        })
                    }
                });

                // Sync with JobRequest
                try {
                    await jobRequestSyncService.syncOnCandidateStatusChange({
                        candidateId: updated.id,
                        newCandidateStatus: updated.status,
                        oldCandidateStatus: existingCandidate.status,
                        performedBy: req.user?.id || 'SYSTEM',
                        tx
                    });
                } catch (syncErr) {
                    logger.warn('[Recruitment] Sync error in jobRequestSyncService:', syncErr.message);
                }
            }

            return updated;
        }, { timeout: 15000, maxWait: 10000 });

        res.status(200).json({ status: 'success', data: { candidate } });
    } catch (error) {
        if (error.statusCode) {
            return res.status(error.statusCode).json({
                status: 'error',
                message: error.message
            });
        }
        next(error);
    }
};

export const updateJob = async (req, res, next) => {
    try {
        const companyId = req.user.companyId;
        const existingJob = await prisma.recruitmentJob.findFirst({
            where: { id: req.params.id, companyId, deletedAt: null }
        });

        if (!existingJob) {
            return res.status(404).json({ status: 'error', message: 'الوظيفة غير موجودة أو غير مصرح بتعديلها' });
        }

        const updateData = { ...req.body };

        const fieldsToStringify = ['salaryRange', 'requirements', 'responsibilities'];
        fieldsToStringify.forEach(field => {
            if (updateData[field] && typeof updateData[field] === 'object') {
                updateData[field] = JSON.stringify(updateData[field]);
            }
        });

        // Normalize status if updated
        if (updateData.status) {
            if (updateData.status === 'draft' || updateData.status === 'ON_HOLD') {
                updateData.status = 'ON_HOLD';
            } else if (updateData.status === 'published' || updateData.status === 'OPEN') {
                updateData.status = 'OPEN';
            }
        }

        const job = await prisma.recruitmentJob.update({
            where: { id: req.params.id },
            data: {
                ...updateData,
                updatedAt: new Date()
            }
        });
        res.status(200).json({ status: 'success', data: { job } });
    } catch (error) {
        next(error);
    }
};

export const deleteJob = async (req, res, next) => {
    try {
        const companyId = req.user.companyId;
        const jobId = req.params.id;
        const existingJob = await prisma.recruitmentJob.findFirst({
            where: { id: jobId, companyId, deletedAt: null }
        });

        if (!existingJob) {
            return res.status(404).json({ status: 'error', message: 'الوظيفة غير موجودة أو غير مصرح بحذفها' });
        }

        const now = new Date();
        await prisma.recruitmentJob.update({
            where: { id: jobId },
            data: { deletedAt: now }
        });

        res.status(200).json({ status: 'success', message: 'تم حذف الوظيفة بنجاح' });
    } catch (error) {
        logger.error('[Recruitment] deleteJob error:', error.message);
        next(error);
    }
};

export const deleteCandidate = async (req, res, next) => {
    try {
        const companyId = req.user?.companyId || req.user?.company?.id;
        const { id } = req.params;

        const candidate = await prisma.candidate.findFirst({
            where: {
                id,
                recruitmentjob: { companyId },
                deletedAt: null
            }
        });

        if (!candidate) {
            return res.status(404).json({
                status: 'error',
                message: 'المرشح غير موجود أو لا تملك صلاحية الوصول إليه'
            });
        }

        await prisma.$transaction(async (tx) => {
            await tx.candidate.update({
                where: { id },
                data: { deletedAt: new Date() }
            });

            await tx.candidateHistory.create({
                data: {
                    candidateId: id,
                    action: 'CANDIDATE_DELETED',
                    comment: 'تم حذف ملف المرشح من المنصة',
                    performedBy: req.user?.id || 'SYSTEM'
                }
            });
        });

        res.status(200).json({ status: 'success', message: 'تم حذف المرشح بنجاح' });
    } catch (error) {
        next(error);
    }
};

export const getCandidate = async (req, res, next) => {
    try {
        const companyId = req.user?.companyId || req.user?.company?.id;
        const candidate = await prisma.candidate.findFirst({
            where: {
                id: req.params.id,
                recruitmentjob: { companyId },
                deletedAt: null
            },
            include: { interviews: true, recruitmentjob: true },
        });

        if (!candidate) {
            return res.status(404).json({
                status: 'error',
                message: 'المرشح غير موجود أو لا تملك صلاحية الوصول إليه'
            });
        }

        res.status(200).json({ status: 'success', data: { candidate } });
    } catch (error) {
        next(error);
    }
};

export const getInterviews = async (req, res, next) => {
    try {
        let companyId = req.user?.companyId || req.user?.company?.id;

        const interviews = await prisma.interview.findMany({
            where: companyId ? {
                candidate: { recruitmentjob: { companyId } }
            } : {},
            include: {
                candidate: {
                    include: {
                        recruitmentjob: true,
                        candidateSkills: true
                    }
                }
            },
            orderBy: { createdAt: 'desc' },
            take: 100
        });
        res.status(200).json({ status: 'success', data: { interviews } });
    } catch (error) {
        logger.error('[Recruitment] getInterviews error:', error.message);
        res.status(200).json({ status: 'success', data: { interviews: [] } });
    }
};

export const getSmartInterviewNotes = async (req, res, next) => {
    try {
        const companyId = req.user?.companyId || req.user?.company?.id;
        if (!companyId) {
            return res.status(403).json({ status: 'error', message: 'غير مصرح: الحساب غير مرتبط بشركة' });
        }

        const upcomingInterviews = await prisma.interview.findMany({
            where: {
                candidate: { recruitmentjob: { companyId } },
                status: 'scheduled'
            },
            include: { candidate: true },
            take: 10
        });

        let notes = [];
        if (typeof aiService.getSmartInterviewNotes === 'function') {
            try {
                notes = await aiService.getSmartInterviewNotes(upcomingInterviews, companyId);
            } catch (e) {
                notes = [];
            }
        }

        if (!notes || notes.length === 0) {
            notes = [
                "تركيز الفحص على الإلمام التقني والمهارات الأساسية للمرشح.",
                "مراجعة المشاريع السابقة والاستفسار عن دور المرشح الفعلي.",
                "تقييم القدرة على التكيف والعمل ضمن فريق التوظيف."
            ];
        }

        res.status(200).json({ status: 'success', data: { notes } });
    } catch (error) {
        logger.error('[Recruitment] getSmartInterviewNotes error:', error.message);
        res.status(200).json({
            status: 'success',
            data: {
                notes: [
                    "تركيز الفحص على الإلمام التقني والمهارات الأساسية للمرشح.",
                    "مراجعة المشاريع السابقة والاستفسار عن دور المرشح الفعلي."
                ]
            }
        });
    }
};

export const publishJob = async (req, res, next) => {
    try {
        const companyId = req.user.companyId;
        const existingJob = await prisma.recruitmentJob.findFirst({
            where: { id: req.params.id, companyId, deletedAt: null }
        });

        if (!existingJob) {
            return res.status(404).json({ status: 'error', message: 'الوظيفة غير موجودة أو غير مصرح بنشرها' });
        }

        // Validation: Cannot publish job without description
        if (!existingJob.description || !existingJob.description.trim()) {
            return res.status(400).json({ status: 'error', message: 'لا يمكن نشر الوظيفة بدون كتابة الوصف الوظيفي' });
        }

        const job = await prisma.recruitmentJob.update({
            where: { id: req.params.id },
            data: {
                status: 'OPEN',
                updatedAt: new Date()
            }
        });
        res.status(200).json({ status: 'success', data: { job } });
    } catch (error) {
        next(error);
    }
};

export const uploadResume = async (req, res, next) => {
    try {
        if (!req.file) {
            const error = new Error('No resume file uploaded');
            error.statusCode = 400;
            throw error;
        }

        const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1E9)}`;
        const ext = path.extname(req.file.originalname) || '.pdf';
        const fileNameToSave = `resumes/resume-${uniqueSuffix}${ext}`;

        let url = await uploadFileToSupabase(req.file.buffer, fileNameToSave, req.file.mimetype);

        if (url.startsWith('/')) {
            const origin = process.env.BACKEND_URL || `${req.protocol}://${req.get('host')}`;
            url = `${origin}${url}`;
        }

        res.status(200).json({ status: 'success', data: { url } });
    } catch (error) {
        next(error);
    }
};

export const uploadInterviewVideo = async (req, res, next) => {
    try {
        if (!req.file) {
            const error = new Error('No video file uploaded');
            error.statusCode = 400;
            throw error;
        }

        console.log(`[Upload API] Received video file: ${req.file.originalname}, Size: ${req.file.size} bytes`);

        // We skip magic-bytes strict validation for videos here because WebM/MKV
        // might not be supported properly by the magic-bytes library and we don't 
        // want to abort the upload.

        const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1E9)}`;
        const ext = path.extname(req.file.originalname) || '.webm';
        const fileNameToSave = `interviews/interview-${uniqueSuffix}${ext}`;

        let videoUrl = await uploadFileToSupabase(req.file.buffer, fileNameToSave, req.file.mimetype);

        // Resolve local relative URLs to absolute so frontend (Vercel) can play them
        if (videoUrl.startsWith('/')) {
            const origin = process.env.BACKEND_URL || `${req.protocol}://${req.get('host')}`;
            videoUrl = `${origin}${videoUrl}`;
        }

        console.log(`[Upload API] Video uploaded to Supabase successfully: ${videoUrl}`);

        res.status(200).json({
            status: 'success',
            data: {
                url: videoUrl,
                filename: fileNameToSave,
                size: req.file.size,
                mimetype: req.file.mimetype
            }
        });
    } catch (error) {
        console.error(`[Upload API Error]`, error);
        next(error);
    }
};

export const deleteInterview = async (req, res, next) => {
    try {
        const companyId = req.user?.companyId || req.user?.company?.id;
        if (!companyId) {
            return res.status(403).json({ status: 'error', message: 'غير مصرح: الحساب غير مرتبط بشركة' });
        }

        const interview = await prisma.interview.findFirst({
            where: {
                id: req.params.id,
                OR: [
                    { companyId },
                    { candidate: { recruitmentjob: { companyId } } }
                ]
            },
            include: { candidate: true }
        });

        if (!interview) {
            return res.status(404).json({ status: 'error', message: 'المقابلة غير موجودة أو تابعة لشركة أخرى' });
        }

        await prisma.interview.delete({ where: { id: req.params.id } });

        // Record Centralized AuditLog
        await auditService.log({
            userId: req.user?.id,
            companyId,
            action: 'INTERVIEW_DELETED',
            actionType: 'RECRUITMENT',
            severity: 'medium',
            target: `Interview:${req.params.id}`,
            status: 'success',
            ip: req.ip,
            details: {
                interviewId: req.params.id,
                candidateId: interview.candidateId,
                deletedBy: req.user?.name || req.user?.id
            }
        });

        res.status(204).json({ status: 'success', data: null });
    } catch (error) {
        next(error);
    }
};

export const scheduleInterview = async (req, res, next) => {
    try {
        const companyId = req.user?.companyId || req.user?.company?.id;
        if (!companyId) {
            return res.status(403).json({ status: 'error', message: 'غير مصرح: الحساب غير مرتبط بشركة' });
        }

        const { candidateId, type, scheduledAt, notes, interviewerName } = req.body;

        const token = crypto.randomUUID();
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 7);

        // Verify Candidate belongs to user's company
        const candidate = await prisma.candidate.findFirst({
            where: {
                id: candidateId,
                recruitmentjob: { companyId },
                deletedAt: null
            },
            include: { recruitmentjob: true }
        });

        if (!candidate) {
            return res.status(404).json({ status: 'error', message: 'المرشح غير موجود أو تابع لشركة أخرى' });
        }

        const interview = await prisma.interview.create({
            data: {
                companyId,
                candidateId,
                jobId: candidate.jobId,
                type: type || 'VIDEO',
                interviewerName: interviewerName || req.user?.name || 'تلقائي',
                scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
                notes,
                status: 'scheduled',
                completed: false,
                token,
                expiresAt
            },
            include: {
                candidate: {
                    include: { recruitmentjob: true }
                }
            }
        });

        // Enforce candidate state machine if transitioning to INTERVIEW_SENT
        if (candidate.status !== 'HIRED') {
            const canTransition = CandidateStateMachine.canTransition(candidate.status, 'INTERVIEW_SENT');
            if (canTransition) {
                await prisma.candidate.update({
                    where: { id: candidateId },
                    data: {
                        status: 'INTERVIEW_SENT',
                        updatedAt: new Date()
                    }
                });
            }
        }

        // 🔄 Automatic sync to JobRequest on scheduling interview
        if (interview.candidate && interview.candidate.recruitmentjob) {
            const jobReq = await prisma.jobRequest.findFirst({
                where: {
                    jobTitle: interview.candidate.recruitmentjob.title,
                    companyId: interview.candidate.recruitmentjob.companyId,
                    deletedAt: null
                }
            });

            if (jobReq && ['APPROVED', 'RECRUITMENT_STARTED'].includes(jobReq.status)) {
                await prisma.jobRequest.update({
                    where: { id: jobReq.id },
                    data: { status: 'INTERVIEW_PROCESS' }
                });

                await prisma.jobRequestHistory.create({
                    data: {
                        jobRequestId: jobReq.id,
                        action: 'جدولة المقابلة والانتقال التلقائي لمرحلة المقابلات',
                        oldStatus: jobReq.status,
                        newStatus: 'INTERVIEW_PROCESS',
                        comment: `تحديث تلقائي للنظام عند جدولة مقابلة للمرشح (${interview.candidate.fullName})`
                    }
                });
            }
        }

        // Send Email
        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
        const interviewLink = `${frontendUrl}/interview/${token}`;

        try {
            await emailService.sendInterviewInvitation(
                interview.candidate,
                interview.candidate.recruitmentjob,
                interviewLink
            );
        } catch (emailError) {
            console.error('Failed to send interview email:', emailError);
            // Non-blocking error for email
        }

        // Centralized AuditLog
        await auditService.log({
            userId: req.user?.id,
            companyId,
            action: 'INTERVIEW_SCHEDULED',
            actionType: 'RECRUITMENT',
            severity: 'low',
            target: `Interview:${interview.id}`,
            status: 'success',
            ip: req.ip,
            details: {
                interviewId: interview.id,
                candidateId,
                jobId: candidate.jobId,
                scheduledAt
            }
        });

        res.status(201).json({ status: 'success', data: { interview } });
    } catch (error) {
        next(error);
    }
};

export const updateInterview = async (req, res, next) => {
    try {
        const companyId = req.user?.companyId || req.user?.company?.id;
        if (!companyId) {
            return res.status(403).json({ status: 'error', message: 'غير مصرح: الحساب غير مرتبط بشركة' });
        }

        const { id } = req.params;
        const updateData = { ...req.body };

        // Verify Interview belongs to user's company
        const existingInterview = await prisma.interview.findFirst({
            where: {
                id,
                OR: [
                    { companyId },
                    { candidate: { recruitmentjob: { companyId } } }
                ]
            },
            include: { candidate: true }
        });

        if (!existingInterview) {
            return res.status(404).json({ status: 'error', message: 'المقابلة غير موجودة أو تابعة لشركة أخرى' });
        }

        // Check completion state transition without violating HIRED lockdown
        if (updateData.status === 'completed' && existingInterview.candidate) {
            const cand = existingInterview.candidate;
            // Strict HIRED lockdown guard
            if (cand.status !== 'HIRED') {
                const canTransition = CandidateStateMachine.canTransition(cand.status, 'INTERVIEW_COMPLETED');
                if (canTransition) {
                    await prisma.candidate.update({
                        where: { id: cand.id },
                        data: {
                            status: 'INTERVIEW_COMPLETED',
                            updatedAt: new Date()
                        }
                    });
                }
            }
        }

        const interview = await prisma.interview.update({
            where: { id },
            data: updateData,
            include: { candidate: true }
        });

        // Centralized AuditLog
        await auditService.log({
            userId: req.user?.id,
            companyId,
            action: 'INTERVIEW_UPDATED',
            actionType: 'RECRUITMENT',
            severity: 'low',
            target: `Interview:${id}`,
            status: 'success',
            ip: req.ip,
            details: {
                interviewId: id,
                candidateId: existingInterview.candidateId,
                updatedFields: Object.keys(updateData)
            }
        });

        res.status(200).json({ status: 'success', data: { interview } });
    } catch (error) {
        next(error);
    }
};

export const uploadCandidateResume = async (req, res, next) => {
    try {
        const { id } = req.params;

        if (!req.file) {
            const error = new Error('No file uploaded');
            error.statusCode = 400;
            throw error;
        }

        // Security Check
        const validCheck = validateFile(req.file.buffer);
        if (!validCheck.valid) {
            const error = new Error(validCheck.error || "File validation failed");
            error.statusCode = 400;
            throw error;
        }

        const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1E9)}`;
        const ext = path.extname(req.file.originalname) || '.pdf';
        const fileNameToSave = `resumes/resume-${uniqueSuffix}${ext}`;

        let resumeUrl = await uploadFileToSupabase(req.file.buffer, fileNameToSave, req.file.mimetype);

        // Resolve local relative URLs to absolute so frontend (Vercel) can access them
        if (resumeUrl.startsWith('/')) {
            const origin = process.env.BACKEND_URL || `${req.protocol}://${req.get('host')}`;
            resumeUrl = `${origin}${resumeUrl}`;
        }

        let resumeText = '';
        const cleanExt = ext.replace('.', '').toLowerCase();

        try {
            if (cleanExt === 'pdf') {
                resumeText = await extractTextFromPDF(validCheck.buffer);
            } else if (cleanExt === 'docx') {
                const mammoth = await import('mammoth');
                const result = await mammoth.extractRawText({ buffer: validCheck.buffer });
                resumeText = result.value;
            } else if (ext === 'doc') {
                resumeText = 'Document text extraction unavailable for .doc. Manual review required.';
            }
        } catch (parseError) {
            logger.error('Error parsing resume', { error: parseError.message });
            resumeText = 'Resume uploaded. Text extraction failed.';
        }

        const candidate = await prisma.candidate.findUnique({
            where: { id },
            include: { recruitmentjob: true }
        });

        if (!candidate) {
            const error = new Error('Candidate not found');
            error.statusCode = 404;
            throw error;
        }

        const updatedCandidate = await prisma.candidate.update({
            where: { id },
            data: {
                resumeUrl,
                status: 'SCREENING',
                updatedAt: new Date()
            }
        });

        // Send instant response so the candidate doesn't hang waiting for AI
        res.status(200).json({
            status: 'success',
            message: 'تم رفع السيرة الذاتية بنجاح ✨',
            data: { candidate: updatedCandidate }
        });

        // Run AI screening & RAG Indexing asynchronously in background
        (async () => {
            try {
                const aiAnalysis = await aiService.screenCV(
                    resumeText,
                    candidate.recruitmentjob?.description || candidate.recruitmentjob?.title || 'وصف وظيفي',
                    candidate.recruitmentjob?.companyId
                );

                await prisma.candidate.update({
                    where: { id },
                    data: {
                        aiScore: aiAnalysis.score || null,
                        aiSummary: aiAnalysis.summary || '',
                        aiAnalysisDetails: JSON.stringify(aiAnalysis),
                        skills: aiAnalysis.skills ? JSON.stringify(aiAnalysis.skills) : null,
                        experience: aiAnalysis.experience?.years || null,
                        education: aiAnalysis.education ? JSON.stringify(aiAnalysis.education) : null
                    }
                });

                // RAG Indexing
                const indexContent = `Candidate: ${candidate.fullName}. Position: ${candidate.recruitmentjob?.title}. Skills: ${aiAnalysis.skills ? aiAnalysis.skills.join(', ') : 'N/A'}. Summary: ${aiAnalysis.summary}`;
                await aiService.indexDocument(
                    indexContent,
                    candidate.recruitmentjob?.companyId,
                    candidate.id,
                    'CANDIDATE',
                    { name: candidate.fullName, job: candidate.recruitmentjob?.title }
                );
            } catch (aiErr) {
                logger.error('Background AI CV screening failed', { candidateId: id, error: aiErr.message });
            }
        })();
    } catch (error) {
        next(error);
    }
};

export const submitFeedback = async (req, res, next) => {
    try {
        const { interviewId } = req.params;
        const { rating, feedback } = req.body;

        const interview = await prisma.interview.findFirst({
            where: { OR: [{ id: interviewId }, { candidateId: interviewId }] },
            orderBy: { createdAt: 'desc' }
        });

        if (!interview) {
            const error = new Error('Interview not found');
            error.statusCode = 404;
            throw error;
        }

        const updated = await prisma.interview.update({
            where: { id: interview.id },
            data: {
                candidateRating: rating,
                candidateFeedback: feedback
            }
        });

        res.status(200).json({
            status: 'success',
            data: { interview: updated }
        });
    } catch (error) {
        next(error);
    }
};


export const acceptTerms = async (req, res, next) => {
    try {
        const { candidateId } = req.body;

        await prisma.candidate.update({
            where: { id: candidateId },
            data: {
                termsAcceptedAt: new Date(),
                updatedAt: new Date()
            }
        });

        res.status(200).json({ status: 'success' });
    } catch (error) {
        next(error);
    }
};

export const getCandidateResume = async (req, res, next) => {
    try {
        const { id } = req.params;

        const candidate = await prisma.candidate.findUnique({
            where: { id },
            select: { resumeUrl: true, name: true }
        });

        if (!candidate || !candidate.resumeUrl) {
            const error = new Error('Resume not found');
            error.statusCode = 404;
            throw error;
        }

        let url = candidate.resumeUrl;
        if (url.startsWith('/')) {
            const origin = process.env.BACKEND_URL || `${req.protocol}://${req.get('host')}`;
            url = `${origin}${url}`;
        }
        return res.redirect(url);
    } catch (error) {
        next(error);
    }
};

// ==========================================
// DEPARTMENT CONTROLLERS (مرة واحدة فقط)
// ==========================================

export const getDepartments = async (req, res, next) => {
    try {
        const departments = await prisma.department.findMany({
            where: {
                companyId: req.user.companyId
            },
            include: {
                parent: {
                    select: {
                        name: true
                    }
                }
            }
        });

        res.status(200).json({
            status: 'success',
            data: { departments }
        });
    } catch (error) {
        next(error);
    }
};

export const createDepartment = async (req, res, next) => {
    try {
        const { name, description, parentId } = req.body;

        if (!name) {
            const error = new Error('Department name is required');
            error.statusCode = 400;
            throw error;
        }

        const newDepartment = await prisma.department.create({
            data: {
                name,
                description,
                parentId: parentId || null,
                companyId: req.user.companyId
            }
        });

        res.status(201).json({
            status: 'success',
            data: { department: newDepartment }
        });
    } catch (error) {
        next(error);
    }
};

export const updateDepartment = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { name, description, parentId } = req.body;

        const department = await prisma.department.findFirst({
            where: {
                id,
                companyId: req.user.companyId
            }
        });

        if (!department) {
            const error = new Error('Department not found');
            error.statusCode = 404;
            throw error;
        }

        const updatedDepartment = await prisma.department.update({
            where: { id },
            data: {
                name,
                description,
                parentId: parentId || null
            }
        });

        res.status(200).json({
            status: 'success',
            data: { department: updatedDepartment }
        });
    } catch (error) {
        next(error);
    }
};

export const deleteDepartment = async (req, res, next) => {
    try {
        const { id } = req.params;

        const department = await prisma.department.findFirst({
            where: {
                id,
                companyId: req.user.companyId
            }
        });

        if (!department) {
            const error = new Error('Department not found');
            error.statusCode = 404;
            throw error;
        }

        await prisma.department.delete({
            where: { id }
        });

        res.status(204).send();
    } catch (error) {
        next(error);
    }
};
