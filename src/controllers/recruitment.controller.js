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
        const jobs = await prisma.recruitmentJob.findMany({
            where: {
                companyId: req.user.companyId
            },
            include: { _count: { select: { candidates: true } } },
        });

        const parsedJobs = jobs.map(job => ({
            ...job,
            salaryRange: job.salaryRange ? (typeof job.salaryRange === 'string' ? JSON.parse(job.salaryRange) : job.salaryRange) : null,
            requirements: job.requirements ? (typeof job.requirements === 'string' ? JSON.parse(job.requirements) : job.requirements) : null,
            responsibilities: job.responsibilities ? (typeof job.responsibilities === 'string' ? JSON.parse(job.responsibilities) : job.responsibilities) : null,
            applicantsCount: job._count?.candidates || 0
        }));

        res.status(200).json({ status: 'success', data: { jobs: parsedJobs } });
    } catch (error) {
        next(error);
    }
};

export const getPublicJobs = async (req, res, next) => {
    try {
        const jobs = await prisma.recruitmentJob.findMany({
            where: { status: 'OPEN' },
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
        const job = await prisma.recruitmentJob.findUnique({
            where: { id: req.params.id },
            include: { company: { select: { name: true } } }
        });

        if (!job || job.status !== 'OPEN') {
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
            openingReason
        } = req.body;

        const job = await prisma.recruitmentJob.create({
            data: {
                title,
                description,
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
                companyId: req.user.companyId,
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
        const ext = req.file.originalname.split('.').pop().toLowerCase();

        try {
            if (validCheck.mime === 'application/pdf') {
                resumeText = await extractTextFromPDF(validCheck.buffer);
            } else if (validCheck.mime.includes('wordprocessingml')) {
                const mammoth = await import('mammoth');
                const result = await mammoth.extractRawText({ buffer: validCheck.buffer });
                resumeText = result.value;
            } else {
                // Text fallback logic only if allowed
                throw new Error("Unsupported file type for parsing");
            }
        } catch (parseError) {
            logger.error('Error parsing resume', { error: parseError.message });
            // Don't set resumeText to 'Text extraction failed.' to avoid AI trying to parse this string
        }

        const aiData = resumeText ? await aiService.extractCVData(resumeText, req.user?.companyId || 'PUBLIC') : {};

        res.status(200).json({
            status: 'success',
            data: {
                extracted: aiData,
                resumeText: resumeText.substring(0, 500) + '...'
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

        const interviewCode = crypto.randomBytes(4).toString('hex').toUpperCase();

        const candidate = await prisma.candidate.create({
            data: {
                fullName: fullName || name,
                email,
                phone,
                resumeUrl,
                location,
                jobId,
                interviewCode,
                status: 'NEW',
                updatedAt: new Date()
            }
        });

        const job = await prisma.recruitmentJob.findUnique({ where: { id: jobId } });

        // Removed: Fake screening based on name/email.
        // Logic: Application is accepted, but marked as NEW. 
        // Real parsing happens when Resume is uploaded or if resumeUrl is a processable link.

        // Notify Managers
        try {
            const managers = await prisma.user.findMany({
                where: {
                    companyId: job.companyId,
                    role: { in: ['MANAGER', 'ADMIN', 'SUPER_ADMIN'] }
                },
                select: { id: true, employee: { select: { id: true } } }
            });

            for (const manager of managers) {
                await createNotification({
                    userId: manager.id,
                    employeeId: manager.employee?.id,
                    title: 'طلب توظيف جديد',
                    message: `تقدم ${name} لوظيفة ${job.title}`,
                    type: 'recruitment',
                    priority: 'high',
                    metadata: { candidateId: candidate.id, jobId: job.id }
                });
            }
        } catch (notifError) {
            logger.error('Failed to notify managers', { error: notifError.message });
        }

        res.status(201).json({
            status: 'success',
            data: {
                candidateId: candidate.id,
                interviewCode
            }
        });
    } catch (error) {
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
        const interview = await prisma.interview.findUnique({
            where: { token },
            include: {
                candidate: {
                    include: { recruitmentjob: true }
                }
            }
        });

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
        const interview = await prisma.interview.findUnique({
            where: { token },
            include: {
                candidate: {
                    include: { recruitmentjob: true }
                }
            }
        });

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
        let interview;
        if (token) {
            interview = await prisma.interview.findUnique({
                where: { token },
                include: { candidate: true }
            });

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

        // 2. Fallback to candidate-based lookup if no token (backward compatibility)
        if (!interview && candidateId) {
            interview = await prisma.interview.findFirst({
                where: { candidateId, completed: false },
                orderBy: { createdAt: 'desc' }
            });
        }

        if (!interview) {
            // If still no interview, create a new one (legacy behavior)
            interview = await prisma.interview.create({
                data: {
                    candidateId,
                    type: type || 'VIDEO',
                    videoUrl,
                    notes,
                    completed: true,
                    status: 'completed'
                }
            });
        } else {
            // Update existing interview
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
        }

        // 3. AI Evaluation
        const candidate = await prisma.candidate.findUnique({
            where: { id: interview.candidateId },
            include: { recruitmentjob: true }
        });

        const questions = ['General Questions'];
        const answers = notes || 'No notes provided';

        const evaluationResult = await aiService.evaluateInterview(
            questions,
            answers,
            candidate.recruitmentjob.companyId,
            interview.candidateId
        );

        // Fixed: Use real AI result or fallback to "Pending Review" - NO RANDOM NUMBERS
        const aiAnalysis = {
            communication: evaluationResult.score || 0,
            technical: 0,
            overall: evaluationResult.score || 0,
            strengths: evaluationResult.strengths || [],
            weaknesses: evaluationResult.weaknesses || [],
            decision: evaluationResult.decision || 'review',
            recommendation: evaluationResult.decision || 'review'
        };

        const score = evaluationResult.score || 0;
        const summary = evaluationResult.summary || 'تم إكمال المقابلة بنجاح وهي بانتظار المراجعة.';

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

        await prisma.candidate.update({
            where: { id: candidateId },
            data: {
                status: 'INTERVIEW_COMPLETED',
                aiScore: score,
                aiSummary: summary
            }
        });

        res.status(200).json({ status: 'success', data: { interview: { ...interview, aiScore: score, aiSummary: summary, status: 'completed' } } });
    } catch (error) {
        next(error);
    }
};

export const createCandidate = async (req, res, next) => {
    try {
        const { name, fullName, email, phone, resumeUrl, jobId } = req.body;

        const interviewCode = crypto.randomBytes(4).toString('hex').toUpperCase();

        const candidate = await prisma.candidate.create({
            data: {
                fullName: fullName || name,
                email,
                phone,
                resumeUrl,
                jobId,
                interviewCode,
                status: 'NEW',
                updatedAt: new Date()
            },
            include: { recruitmentjob: true }
        });

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
        const data = { ...req.body };
        if (data.status && typeof data.status === 'string') {
            data.status = data.status.toUpperCase();
        }

        const candidate = await prisma.candidate.update({
            where: { id: req.params.id },
            data: {
                ...data,
                updatedAt: new Date()
            }
        });
        res.status(200).json({ status: 'success', data: { candidate } });
    } catch (error) {
        next(error);
    }
};

export const updateJob = async (req, res, next) => {
    try {
        const updateData = { ...req.body };

        const fieldsToStringify = ['salaryRange', 'requirements', 'responsibilities'];
        fieldsToStringify.forEach(field => {
            if (updateData[field] && typeof updateData[field] === 'object') {
                updateData[field] = JSON.stringify(updateData[field]);
            }
        });

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
        const jobId = req.params.id;
        const now = new Date();
        await prisma.$transaction([
            prisma.candidate.updateMany({
                where: { jobId, deletedAt: null },
                data: { deletedAt: now }
            }),
            prisma.recruitmentJob.delete({
                where: { id: jobId }
            })
        ]);
        res.status(204).json({ status: 'success', data: null });
    } catch (error) {
        next(error);
    }
};

export const deleteCandidate = async (req, res, next) => {
    try {
        const { id } = req.params;
        await prisma.candidate.update({
            where: { id },
            data: { deletedAt: new Date() }
        });
        res.status(204).json({ status: 'success', data: null });
    } catch (error) {
        next(error);
    }
};

export const getCandidate = async (req, res, next) => {
    try {
        const candidate = await prisma.candidate.findUnique({
            where: { id: req.params.id },
            include: { interviews: true, recruitmentjob: true },
        });
        res.status(200).json({ status: 'success', data: { candidate } });
    } catch (error) {
        next(error);
    }
};

export const getInterviews = async (req, res, next) => {
    try {
        const interviews = await prisma.interview.findMany({
            where: { candidate: { recruitmentjob: { companyId: req.user.companyId } } },
            include: {
                candidate: {
                    include: {
                        recruitmentjob: true
                    }
                }
            },
            orderBy: { scheduledAt: 'asc' }
        });
        res.status(200).json({ status: 'success', data: { interviews } });
    } catch (error) {
        next(error);
    }
};

export const getSmartInterviewNotes = async (req, res, next) => {
    try {
        const companyId = req.user.companyId;
        const upcomingInterviews = await prisma.interview.findMany({
            where: {
                candidate: { recruitmentjob: { companyId } },
                status: 'scheduled',
                scheduledAt: { gte: new Date() }
            },
            include: { candidate: true },
            take: 10
        });

        const notes = await aiService.getSmartInterviewNotes(upcomingInterviews, companyId);
        res.status(200).json({ status: 'success', data: { notes } });
    } catch (error) {
        next(error);
    }
};

export const publishJob = async (req, res, next) => {
    try {
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

        const url = await uploadFileToSupabase(req.file.buffer, fileNameToSave, req.file.mimetype);

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

        const videoUrl = await uploadFileToSupabase(req.file.buffer, fileNameToSave, req.file.mimetype);

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
        await prisma.interview.delete({ where: { id: req.params.id } });
        res.status(204).json({ status: 'success', data: null });
    } catch (error) {
        next(error);
    }
};

export const scheduleInterview = async (req, res, next) => {
    try {
        const { candidateId, type, scheduledAt, notes, interviewerName } = req.body;

        const token = crypto.randomUUID();
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 7);

        const candidate = await prisma.candidate.findUnique({
            where: { id: candidateId }
        });
        if (!candidate) return res.status(404).json({ status: 'error', message: 'المرشح غير موجود' });

        const interview = await prisma.interview.create({
            data: {
                candidateId,
                jobId: candidate.jobId,
                type: type || 'VIDEO',
                interviewerName: interviewerName || null,
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

        await prisma.candidate.update({
            where: { id: candidateId },
            data: {
                status: 'INTERVIEW_SENT',
                updatedAt: new Date()
            }
        });

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

        res.status(201).json({ status: 'success', data: { interview } });
    } catch (error) {
        next(error);
    }
};

export const updateInterview = async (req, res, next) => {
    try {
        const { id } = req.params;
        const updateData = { ...req.body };

        if (updateData.status === 'completed') {
            const interview = await prisma.interview.findUnique({
                where: { id },
                select: { candidateId: true }
            });
            if (interview) {
                await prisma.candidate.update({
                    where: { id: interview.candidateId },
                    data: {
                        status: 'SCREENING', // Or should check score first
                        updatedAt: new Date()
                    }
                });
            }
        }

        const interview = await prisma.interview.update({
            where: { id },
            data: updateData,
            include: { candidate: true }
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

        const resumeUrl = await uploadFileToSupabase(req.file.buffer, fileNameToSave, req.file.mimetype);

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

        const aiAnalysis = await aiService.screenCV(
            resumeText,
            candidate.recruitmentjob.description,
            candidate.recruitmentjob.companyId
        );

        // Smart Search Indexing for RAG
        try {
            const indexContent = `Candidate: ${candidate.name}. Position: ${candidate.recruitmentjob.title}. Skills: ${aiAnalysis.skills ? aiAnalysis.skills.join(', ') : 'N/A'}. Experience: ${aiAnalysis.experience_years || 'N/A'}. Summary: ${aiAnalysis.final_reason}`;
            await aiService.indexDocument(
                indexContent,
                candidate.recruitmentjob.companyId,
                candidate.id,
                'CANDIDATE',
                { name: candidate.name, job: candidate.recruitmentjob.title }
            );
        } catch (idxError) {
            logger.error('Indexing failed for candidate', { candidateId: candidate.id, error: idxError.message });
        }

        const updatedCandidate = await prisma.candidate.update({
            where: { id },
            data: {
                resumeUrl,
                aiScore: aiAnalysis.score || null,
                aiSummary: aiAnalysis.summary,
                aiAnalysisDetails: JSON.stringify(aiAnalysis),
                skills: aiAnalysis.skills ? JSON.stringify(aiAnalysis.skills) : null,
                experience: aiAnalysis.experience?.years || null,
                education: aiAnalysis.education ? JSON.stringify(aiAnalysis.education) : null,
                status: 'SCREENING',
                updatedAt: new Date()
            }
        });

        res.status(200).json({
            status: 'success',
            data: {
                candidate: updatedCandidate,
                aiAnalysis
            }
        });
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

        return res.redirect(candidate.resumeUrl);
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
        const { name, description } = req.body;

        if (!name) {
            const error = new Error('Department name is required');
            error.statusCode = 400;
            throw error;
        }

        const newDepartment = await prisma.department.create({
            data: {
                name,
                description,
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
        const { name, description } = req.body;

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
            data: { name, description }
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
