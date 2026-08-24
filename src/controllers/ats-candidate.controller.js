import prisma from '../config/db.js';
import logger from '../utils/logger.js';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { aiService } from '../ai/ai-service.js';
import { extractTextFromPDF } from '../utils/pdfExtractor.js';
import { isAllowedCV, getMimeTypeFromBuffer } from '../utils/magic-bytes.js';
import { auditService } from '../services/audit.service.js';

const resolveCompanyId = (req) => {
    const companyId = req.user?.companyId || req.user?.company?.id;
    if (!companyId) {
        const error = new Error('الشركة غير محددة أو غير صالحة للمستخدم.');
        error.statusCode = 403;
        throw error;
    }
    return companyId;
};

// Sanitization and validation helpers
const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

/**
 * 1. POST /api/candidates
 * Create candidate profile with full personal & professional details in an Atomic Transaction
 */
export const createCandidate = async (req, res, next) => {
    try {
        const companyId = resolveCompanyId(req);
        const {
            jobId,
            fullName,
            name,
            email,
            phone,
            location,
            nationality,
            dateOfBirth,
            currentTitle,
            yearsOfExperience,
            experience,
            previousCompanies,
            skills,
            education,
            certifications,
            languages,
            portfolioLinks,
            certificates,
            resumeUrl,
            coverLetter,
            skillsList,
            experiencesList
        } = req.body;

        const candidateName = (fullName || name || '').trim();
        const candidateEmail = (email || '').trim();

        if (!candidateName || !candidateEmail) {
            return res.status(400).json({ status: 'error', message: 'الاسم والبريد الإلكتروني مطلوبان' });
        }

        if (!isValidEmail(candidateEmail)) {
            return res.status(400).json({ status: 'error', message: 'صيغة البريد الإلكتروني غير صحيحة' });
        }

        // Validate years of experience
        const expNum = yearsOfExperience !== undefined ? parseInt(yearsOfExperience) : (experience !== undefined ? parseInt(experience) : 0);
        if (isNaN(expNum) || expNum < 0) {
            return res.status(400).json({ status: 'error', message: 'سنوات الخبرة يجب أن تكون رقماً موجباً' });
        }

        // Verify target job belongs to user's company
        let targetJobId = jobId;
        if (targetJobId) {
            const existingJob = await prisma.recruitmentJob.findFirst({
                where: { id: targetJobId, companyId, deletedAt: null }
            });
            if (!existingJob) {
                return res.status(404).json({ status: 'error', message: 'الوظيفة المحددة غير موجودة أو تابعة لشركة أخرى' });
            }
        } else {
            const firstJob = await prisma.recruitmentJob.findFirst({
                where: { companyId, deletedAt: null }
            });
            if (firstJob) {
                targetJobId = firstJob.id;
            } else {
                const newJob = await prisma.recruitmentJob.create({
                    data: {
                        companyId,
                        title: currentTitle || 'مسمى وظيفي عام',
                        description: 'وصف الوظيفة العام المعتمد للمرشحين',
                        department: 'الإدارة العامة',
                        location: location || 'الرياض',
                        status: 'OPEN'
                    }
                });
                targetJobId = newJob.id;
            }
        }

        const interviewCode = crypto.randomBytes(4).toString('hex').toUpperCase();

        // Perform creation inside an atomic Prisma Transaction
        const fullCandidate = await prisma.$transaction(async (tx) => {
            const createdCandidate = await tx.candidate.create({
                data: {
                    jobId: targetJobId,
                    fullName: candidateName.substring(0, 200),
                    email: candidateEmail.substring(0, 200),
                    phone: phone ? String(phone).substring(0, 50) : null,
                    location: location ? String(location).substring(0, 100) : null,
                    nationality: nationality ? String(nationality).substring(0, 100) : null,
                    dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : null,
                    currentTitle: currentTitle ? String(currentTitle).substring(0, 150) : null,
                    yearsOfExperience: expNum,
                    experience: expNum,
                    previousCompanies: Array.isArray(previousCompanies) ? JSON.stringify(previousCompanies) : (typeof previousCompanies === 'string' ? previousCompanies : null),
                    skills: Array.isArray(skills) ? JSON.stringify(skills) : (typeof skills === 'string' ? skills : null),
                    education: typeof education === 'object' ? JSON.stringify(education) : (education || null),
                    certifications: Array.isArray(certifications) ? JSON.stringify(certifications) : (typeof certifications === 'string' ? certifications : null),
                    languages: Array.isArray(languages) ? JSON.stringify(languages) : (typeof languages === 'string' ? languages : null),
                    portfolioLinks: Array.isArray(portfolioLinks) ? JSON.stringify(portfolioLinks) : (typeof portfolioLinks === 'string' ? portfolioLinks : null),
                    certificates: Array.isArray(certificates) ? JSON.stringify(certificates) : (typeof certificates === 'string' ? certificates : null),
                    resumeUrl: resumeUrl || null,
                    coverLetter: coverLetter || null,
                    interviewCode,
                    status: 'APPLIED'
                }
            });

            // Save CandidateSkills if provided
            if (Array.isArray(skillsList) && skillsList.length > 0) {
                await tx.candidateSkill.createMany({
                    data: skillsList.map(s => ({
                        candidateId: createdCandidate.id,
                        skillName: (typeof s === 'string' ? s : s.skillName).substring(0, 100),
                        level: (typeof s === 'object' && s.level) ? s.level : 'INTERMEDIATE'
                    }))
                });
            } else if (skills) {
                const parsedSkills = typeof skills === 'string' && skills.startsWith('[') ? JSON.parse(skills) : (typeof skills === 'string' ? skills.split(',') : (Array.isArray(skills) ? skills : []));
                if (parsedSkills.length > 0) {
                    await tx.candidateSkill.createMany({
                        data: parsedSkills.map(s => ({
                            candidateId: createdCandidate.id,
                            skillName: String(s).trim().substring(0, 100),
                            level: 'INTERMEDIATE'
                        }))
                    });
                }
            }

            // Save CandidateExperiences if provided
            if (Array.isArray(experiencesList) && experiencesList.length > 0) {
                await tx.candidateExperience.createMany({
                    data: experiencesList.map(exp => ({
                        candidateId: createdCandidate.id,
                        company: (exp.company || 'شركة سابقة').substring(0, 150),
                        position: (exp.position || exp.title || 'موظف').substring(0, 150),
                        startDate: exp.startDate ? new Date(exp.startDate) : null,
                        endDate: exp.endDate ? new Date(exp.endDate) : null,
                        description: exp.description || null
                    }))
                });
            }

            // Log CandidateHistory
            await tx.candidateHistory.create({
                data: {
                    candidateId: createdCandidate.id,
                    action: 'إنشاء ملف مرشح جديد',
                    oldStatus: null,
                    newStatus: 'APPLIED',
                    comment: 'تم تقديم طلب جديد وإنشاء ملف المرشح في نظام ATS',
                    performedBy: req.user?.id || 'SYSTEM'
                }
            });

            const fullCand = await tx.candidate.findFirst({
                where: { id: createdCandidate.id },
                include: {
                    candidateSkills: true,
                    candidateExperiences: true,
                    candidateHistories: { orderBy: { createdAt: 'desc' } }
                }
            });

            return fullCand || createdCandidate;
        }, { timeout: 15000, maxWait: 10000 });

        res.status(201).json({ status: 'success', data: fullCandidate });
    } catch (error) {
        logger.error('[ATS] createCandidate error:', error.message);
        next(error);
    }
};

/**
 * 2. POST /api/candidates/upload-cv
 * Upload CV file, validate magic bytes, parse structured info with AI, and create candidate
 */
export const uploadAndParseCV = async (req, res, next) => {
    try {
        const companyId = resolveCompanyId(req);
        let resumeUrl = req.body.resumeUrl || null;
        let resumePath = null;
        let extractedText = '';

        if (req.file) {
            // Validate file magic bytes
            const fileBuffer = fs.readFileSync(req.file.path);
            const isValid = isAllowedCV(fileBuffer);
            if (!isValid) {
                // Delete invalid file immediately
                try { fs.unlinkSync(req.file.path); } catch (e) { }
                return res.status(400).json({
                    status: 'error',
                    message: 'نوع الملف غير مدعوم أو غير آمن. يسمح فقط بملفات PDF أو Word (DOCX/DOC).'
                });
            }

            resumeUrl = `/uploads/resumes/${req.file.filename}`;
            resumePath = req.file.path;

            const mime = getMimeTypeFromBuffer(fileBuffer);
            if (mime === 'application/pdf') {
                try {
                    extractedText = await extractTextFromPDF(fileBuffer);
                } catch (pdfErr) {
                    logger.warn('[ATS] PDF text extraction failed, fallback to raw', pdfErr.message);
                }
            } else if (mime && mime.includes('wordprocessingml')) {
                try {
                    const mammoth = await import('mammoth');
                    const result = await mammoth.extractRawText({ buffer: fileBuffer });
                    extractedText = result.value;
                } catch (docErr) {
                    logger.warn('[ATS] DOCX text extraction failed', docErr.message);
                }
            }
        }

        // Find target Job for the current company
        let targetJobId = jobId;
        let targetJob = null;
        if (targetJobId) {
            targetJob = await prisma.recruitmentJob.findFirst({
                where: { id: targetJobId, companyId, deletedAt: null }
            });
            if (!targetJob) {
                return res.status(404).json({ status: 'error', message: 'الوظيفة المحددة غير موجودة لدى شركتكم' });
            }
        } else {
            targetJob = await prisma.recruitmentJob.findFirst({ where: { companyId, deletedAt: null } });
            if (!targetJob) {
                targetJob = await prisma.recruitmentJob.create({
                    data: {
                        companyId,
                        title: 'وظيفة عامة',
                        department: 'الإدارة العامة',
                        location: 'الرياض',
                        description: 'وظيفة عامة لاستقبال السير الذاتية والترشيحات المباشرة',
                        status: 'OPEN'
                    }
                });
            }
            targetJobId = targetJob.id;
        }

        // Run Structured AI CV Parsing
        let extractedData = {};
        let screeningResult = null;

        if (extractedText && extractedText.trim().length > 10) {
            try {
                // 1. Pure extraction of facts
                extractedData = await aiService.extractCVData(extractedText, companyId);

                // 2. Job-specific match if job description exists
                const jobDesc = `${targetJob.title} - ${targetJob.description || ''} - متطلبات: ${targetJob.requirements || ''}`;
                screeningResult = await aiService.screenCV(extractedText, jobDesc, companyId);
            } catch (aiErr) {
                logger.error('[ATS] AI parsing error:', aiErr.message);
            }
        }

        const fullName = extractedData.name || req.body.fullName || req.body.name || (req.file ? req.file.originalname.replace(/\.[^/.]+$/, '') : 'مرشح بدون اسم');
        const email = extractedData.email || req.body.email || `applicant_${Date.now()}@cv-parsed.local`;
        const phone = extractedData.phone || req.body.phone || null;
        const location = extractedData.location || req.body.location || null;
        const nationality = extractedData.nationality || req.body.nationality || null;
        const currentTitle = extractedData.currentTitle || req.body.currentTitle || null;
        const yearsOfExperience = typeof extractedData.experienceYears === 'number' ? extractedData.experienceYears : (req.body.yearsOfExperience ? Number(req.body.yearsOfExperience) : 0);
        const skillsList = Array.isArray(extractedData.skills) && extractedData.skills.length > 0
            ? extractedData.skills
            : (req.body.skills ? (typeof req.body.skills === 'string' ? req.body.skills.split(',') : req.body.skills) : []);
        const previousCompanies = Array.isArray(extractedData.previousCompanies) ? extractedData.previousCompanies : [];
        const education = extractedData.education || req.body.education || null;

        const aiScore = screeningResult && typeof screeningResult.score === 'number' ? Math.round(screeningResult.score) : null;
        const aiSummary = screeningResult?.summary || (extractedData.summary ? extractedData.summary : 'تم استخراج بيانات السيرة الذاتية وحفظها في النظام.');
        const aiAnalysisDetails = screeningResult ? JSON.stringify({
            jobId: targetJobId,
            jobTitle: targetJob.title,
            matchScore: aiScore,
            scoreBreakdown: screeningResult.scoreBreakdown || {},
            strengths: screeningResult.strengths || [],
            weaknesses: screeningResult.weaknesses || [],
            missingSkills: screeningResult.missingSkills || [],
            evidence: screeningResult.evidence || [],
            recommendation: screeningResult.recommendation || 'REVIEW',
            evaluatedAt: new Date().toISOString()
        }) : null;

        const interviewCode = crypto.randomBytes(4).toString('hex').toUpperCase();

        const candidate = await prisma.candidate.create({
            data: {
                jobId: targetJobId,
                fullName: fullName.substring(0, 200),
                email: email.substring(0, 200),
                phone: phone ? String(phone).substring(0, 50) : null,
                location: location ? String(location).substring(0, 100) : null,
                nationality: nationality ? String(nationality).substring(0, 100) : null,
                resumeUrl,
                resumePath,
                skills: JSON.stringify(skillsList),
                experience: yearsOfExperience,
                yearsOfExperience: yearsOfExperience,
                education,
                currentTitle,
                previousCompanies: JSON.stringify(previousCompanies),
                aiScore,
                aiSummary,
                aiAnalysisDetails,
                interviewCode,
                status: 'SCREENING'
            }
        });

        // Insert skills in CandidateSkill table
        if (skillsList.length > 0) {
            await prisma.candidateSkill.createMany({
                data: skillsList.map(s => ({ candidateId: candidate.id, skillName: String(s).trim().substring(0, 100), level: 'INTERMEDIATE' }))
            });
        }

        // Log history
        await prisma.candidateHistory.create({
            data: {
                candidateId: candidate.id,
                action: 'رفع وتفكيك السيرة الذاتية CV',
                oldStatus: null,
                newStatus: 'SCREENING',
                comment: 'تم تحليل الـ CV بالذكاء الاصطناعي وتحويله لبيانات هيكلية منظمة',
                performedBy: req.user?.id || 'SYSTEM'
            }
        });

        const fullResult = await prisma.candidate.findUnique({
            where: { id: candidate.id },
            include: { candidateSkills: true, candidateExperiences: true, candidateHistories: true }
        });

        res.status(200).json({
            status: 'success',
            message: 'تم رفع وتحليل السيرة الذاتية بنجاح ✨',
            data: fullResult
        });
    } catch (error) {
        logger.error('[ATS] uploadAndParseCV error:', error.message);
        next(error);
    }
};

/**
 * 3. GET /api/candidates
 * Multi-criteria search and filter system with Pagination and Multi-tenant isolation
 */
export const getCandidates = async (req, res, next) => {
    try {
        const companyId = resolveCompanyId(req);
        const {
            search,
            skill,
            minExperience,
            maxExperience,
            location,
            status,
            minScore,
            jobId,
            page = 1,
            limit = 20
        } = req.query;

        const pageNum = Math.max(1, parseInt(page) || 1);
        const take = Math.min(100, Math.max(1, parseInt(limit) || 20));
        const skip = (pageNum - 1) * take;

        const where = {
            recruitmentjob: { companyId },
            deletedAt: null
        };

        if (jobId) where.jobId = jobId;
        if (status) where.status = status;
        if (location) where.location = { contains: location, mode: 'insensitive' };
        if (minScore) where.aiScore = { gte: parseFloat(minScore) };

        if (minExperience || maxExperience) {
            where.yearsOfExperience = {};
            if (minExperience) where.yearsOfExperience.gte = parseInt(minExperience);
            if (maxExperience) where.yearsOfExperience.lte = parseInt(maxExperience);
        }

        if (search) {
            where.OR = [
                { fullName: { contains: search, mode: 'insensitive' } },
                { email: { contains: search, mode: 'insensitive' } },
                { phone: { contains: search, mode: 'insensitive' } },
                { currentTitle: { contains: search, mode: 'insensitive' } },
                { skills: { contains: search, mode: 'insensitive' } }
            ];
        }

        if (skill) {
            where.candidateSkills = {
                some: { skillName: { contains: skill, mode: 'insensitive' } }
            };
        }

        const [total, candidates] = await Promise.all([
            prisma.candidate.count({ where }),
            prisma.candidate.findMany({
                where,
                select: {
                    id: true,
                    jobId: true,
                    fullName: true,
                    email: true,
                    phone: true,
                    location: true,
                    currentTitle: true,
                    yearsOfExperience: true,
                    experience: true,
                    aiScore: true,
                    aiSummary: true,
                    status: true,
                    createdAt: true,
                    updatedAt: true,
                    recruitmentjob: { select: { id: true, title: true, location: true } },
                    candidateSkills: { select: { id: true, skillName: true, level: true } }
                },
                orderBy: { createdAt: 'desc' },
                skip,
                take
            })
        ]);

        res.status(200).json({
            status: 'success',
            count: candidates.length,
            total,
            page: pageNum,
            totalPages: Math.ceil(total / take),
            data: candidates
        });
    } catch (error) {
        logger.error('[ATS] getCandidates error:', error.message);
        next(error);
    }
};

/**
 * 4. GET /api/candidates/:id
 * Full candidate profile details with strict multi-tenant isolation
 */
export const getCandidateById = async (req, res, next) => {
    try {
        const companyId = resolveCompanyId(req);
        const { id } = req.params;

        const candidate = await prisma.candidate.findFirst({
            where: {
                id,
                recruitmentjob: { companyId },
                deletedAt: null
            },
            include: {
                recruitmentjob: true,
                candidateSkills: true,
                candidateExperiences: true,
                candidateApplications: { include: { jobRequest: true } },
                candidateHistories: { orderBy: { createdAt: 'desc' } },
                interviews: { orderBy: { createdAt: 'desc' } }
            }
        });

        if (!candidate) {
            return res.status(404).json({ status: 'error', message: 'المرشح غير موجود أو لا تملك صلاحية الوصول إليه' });
        }

        res.status(200).json({ status: 'success', data: candidate });
    } catch (error) {
        logger.error('[ATS] getCandidateById error:', error.message);
        next(error);
    }
};

/**
 * 5. GET /api/candidates/:id/cv
 * Securely stream candidate CV file only to authorized company users
 */
export const getCandidateCV = async (req, res, next) => {
    try {
        const companyId = resolveCompanyId(req);
        const { id } = req.params;

        const candidate = await prisma.candidate.findFirst({
            where: { id, recruitmentjob: { companyId }, deletedAt: null }
        });

        if (!candidate || !candidate.resumePath) {
            return res.status(404).json({ status: 'error', message: 'ملف السيرة الذاتية غير متوفر أو لا تملك صلاحية الوصول إليه' });
        }

        const safePath = path.resolve(candidate.resumePath);
        const uploadsRoot = path.resolve(process.cwd(), 'uploads');
        if (!safePath.startsWith(uploadsRoot) || !fs.existsSync(safePath)) {
            return res.status(404).json({ status: 'error', message: 'الملف غير موجود على الخادم' });
        }

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `inline; filename="cv-${candidate.id}.pdf"`);
        const stream = fs.createReadStream(safePath);
        stream.pipe(res);
    } catch (error) {
        logger.error('[ATS] getCandidateCV error:', error.message);
        next(error);
    }
};

/**
 * 6. POST /api/candidates/:id/match
 * Run AI matching candidate vs job requirements with company boundary verification
 */
export const matchCandidateWithJob = async (req, res, next) => {
    try {
        const companyId = resolveCompanyId(req);
        const { id } = req.params;
        const { jobId } = req.body;

        const candidate = await prisma.candidate.findFirst({
            where: { id, recruitmentjob: { companyId }, deletedAt: null },
            include: { candidateSkills: true, candidateExperiences: true, recruitmentjob: true }
        });

        if (!candidate) {
            return res.status(404).json({ status: 'error', message: 'المرشح غير موجود أو لا تملك صلاحية الوصول إليه' });
        }

        const targetJobId = jobId || candidate.jobId;
        const job = await prisma.recruitmentJob.findFirst({
            where: { id: targetJobId, companyId, deletedAt: null }
        });

        if (!job) {
            return res.status(404).json({ status: 'error', message: 'الوظيفة المحددة غير موجودة لدى شركتكم' });
        }

        // Read CV content if available
        let cvText = '';
        if (candidate.resumePath && fs.existsSync(candidate.resumePath)) {
            try {
                const fileBuffer = fs.readFileSync(candidate.resumePath);
                const mime = getMimeTypeFromBuffer(fileBuffer);
                if (mime === 'application/pdf') {
                    cvText = await extractTextFromPDF(fileBuffer);
                } else if (mime && mime.includes('wordprocessingml')) {
                    const mammoth = await import('mammoth');
                    const result = await mammoth.extractRawText({ buffer: fileBuffer });
                    cvText = result.value;
                }
            } catch (err) {
                logger.warn('[ATS] Could not re-read CV file during matching:', err.message);
            }
        }

        const candidatePayload = {
            fullName: candidate.fullName,
            currentTitle: candidate.currentTitle,
            yearsOfExperience: candidate.yearsOfExperience || candidate.experience || 0,
            skills: candidate.candidateSkills.length > 0
                ? candidate.candidateSkills.map(s => s.skillName)
                : (candidate.skills ? (candidate.skills.startsWith('[') ? JSON.parse(candidate.skills) : candidate.skills.split(',')) : []),
            education: candidate.education,
            previousCompanies: candidate.candidateExperiences.length > 0
                ? candidate.candidateExperiences.map(e => `${e.position} في ${e.company}`)
                : (candidate.previousCompanies ? (candidate.previousCompanies.startsWith('[') ? JSON.parse(candidate.previousCompanies) : [candidate.previousCompanies]) : []),
            cvText
        };

        const jobPayload = {
            title: job.title,
            department: job.department,
            description: job.description,
            requirements: job.requirements,
            responsibilities: job.responsibilities,
            employmentType: job.employmentType,
            yearsOfExperience: job.yearsOfExperience,
            requiredSkills: job.requiredSkills || job.skills
        };

        // Call real LLM matching engine
        const aiResult = await aiService.matchCandidateWithJobAI(candidatePayload, jobPayload, companyId);
        logger.info(`[ATS-MATCH-AI] jobId=${job.id} title="${job.title}" matchScore=${aiResult?.matchScore}`);

        let matchScore = null;
        let strengths = [];
        let weaknesses = [];
        let missingSkills = [];
        let evidence = [];
        let scoreBreakdown = {};
        let summary = '';
        let recommendation = 'REVIEW';

        if (aiResult) {
            matchScore = typeof aiResult.matchScore === 'number' ? Math.min(100, Math.max(0, Math.round(aiResult.matchScore))) : null;
            strengths = Array.isArray(aiResult.strengths) ? aiResult.strengths : [];
            weaknesses = Array.isArray(aiResult.weaknesses) ? aiResult.weaknesses : [];
            missingSkills = Array.isArray(aiResult.missingSkills) ? aiResult.missingSkills : [];
            evidence = Array.isArray(aiResult.evidence) ? aiResult.evidence : [];
            scoreBreakdown = aiResult.scoreBreakdown || {};
            summary = aiResult.summary || `تمت مطابقة المرشح مع وظيفة (${job.title}).`;
            recommendation = aiResult.recommendation || 'REVIEW';
        } else {
            summary = `تعذر استخراج تحليل الذكاء الاصطناعي لوظيفة (${job.title}) في الوقت الحالي.`;
        }

        const aiAnalysisDetails = JSON.stringify({
            jobId: targetJobId,
            jobTitle: job.title,
            matchScore,
            scoreBreakdown,
            strengths,
            weaknesses,
            missingSkills,
            evidence,
            recommendation,
            evaluatedAt: new Date().toISOString()
        });

        // Update candidate with real job matching result
        await prisma.candidate.update({
            where: { id },
            data: {
                aiScore: matchScore,
                aiSummary: summary,
                aiAnalysisDetails
            }
        });

        // Also upsert / record in CandidateApplication if exists
        const existingApp = await prisma.candidateApplication.findFirst({
            where: { candidateId: id, jobId: targetJobId }
        });

        if (existingApp) {
            await prisma.candidateApplication.update({
                where: { id: existingApp.id },
                data: {
                    score: matchScore,
                    matchAnalysis: summary
                }
            });
        }

        // Record history
        await prisma.candidateHistory.create({
            data: {
                candidateId: id,
                action: 'تشغيل مطابقة الذكاء الاصطناعي الفعلي AI Matching',
                comment: matchScore !== null
                    ? `تم حساب درجة المطابقة الحقيقية بنسبة ${matchScore}% لوظيفة (${job.title}) بناءً على متطلبات الوظيفة والسيرة الذاتية.`
                    : `تم طلب مطابقة الذكاء الاصطناعي لوظيفة (${job.title}).`,
                performedBy: req.user?.id || 'AI_ENGINE'
            }
        });

        res.status(200).json({
            status: 'success',
            data: {
                matchScore,
                scoreBreakdown,
                strengths,
                weaknesses,
                missingSkills,
                evidence,
                candidateId: id,
                jobId: targetJobId,
                jobTitle: job.title,
                summary,
                recommendation
            }
        });
    } catch (error) {
        logger.error('[ATS] matchCandidateWithJob error:', error.message);
        next(error);
    }
};

/**
 * 7. PUT /api/candidates/:id/status
 * Change candidate pipeline stage & audit log atomically with transaction and concurrency control
 */
export const updateCandidateStatus = async (req, res, next) => {
    try {
        const companyId = resolveCompanyId(req);
        const { id } = req.params;
        const { status, comment } = req.body;

        if (!status) {
            return res.status(400).json({ status: 'error', message: 'حالة المرحلة جديدة مطلوبة' });
        }

        const validStatuses = [
            'NEW', 'APPLIED', 'SCREENING', 'AI_REVIEW', 'SHORTLISTED',
            'INTERVIEW_SCHEDULED', 'INTERVIEW_SENT', 'INTERVIEW_COMPLETED',
            'OFFER_SENT', 'OFFERED', 'ACCEPTED', 'PRE_ACCEPTED',
            'INTERVIEWING', 'HIRED', 'REJECTED', 'WITHDRAWN', 'NO_RESPONSE'
        ];

        const targetStatus = status.toUpperCase();
        if (!validStatuses.includes(targetStatus)) {
            return res.status(400).json({ status: 'error', message: `حالة المرحلة (${status}) غير صحيحة أو غير مدعومة` });
        }

        const result = await prisma.$transaction(async (tx) => {
            const candidate = await tx.candidate.findFirst({
                where: { id, recruitmentjob: { companyId }, deletedAt: null },
                include: { recruitmentjob: true }
            });

            if (!candidate) {
                const err = new Error('المرشح غير موجود أو لا تملك صلاحية الوصول إليه');
                err.statusCode = 404;
                throw err;
            }

            const oldStatus = candidate.status;
            const updated = await tx.candidate.update({
                where: { id },
                data: {
                    status: targetStatus,
                    updatedAt: new Date()
                }
            });

            // Audit Trail in CandidateHistory
            await tx.candidateHistory.create({
                data: {
                    candidateId: id,
                    action: `تغيير مرحلة المرشح إلى ${targetStatus}`,
                    oldStatus,
                    newStatus: targetStatus,
                    comment: (comment || `انتقال المرشح إلى مرحلة ${targetStatus}`).substring(0, 500),
                    performedBy: req.user?.id || 'SYSTEM'
                }
            });

            // Auto Sync with HiringPlan if HIRED
            if (targetStatus === 'HIRED' && candidate.recruitmentjob) {
                const plan = await tx.hiringPlan.findFirst({
                    where: {
                        companyId,
                        position: { contains: candidate.recruitmentjob.title, mode: 'insensitive' }
                    }
                });
                if (plan) {
                    const newFulfilled = plan.fulfilledCount + 1;
                    await tx.hiringPlan.update({
                        where: { id: plan.id },
                        data: {
                            fulfilledCount: newFulfilled,
                            status: newFulfilled >= plan.quantity ? 'FULFILLED' : 'IN_PROGRESS'
                        }
                    });
                }
            }

            return updated;
        }, { timeout: 15000, maxWait: 10000 });

        res.status(200).json({
            status: 'success',
            message: `تم تحديث مرحلة المرشح بنجاح إلى ${targetStatus} ✨`,
            data: result
        });
    } catch (error) {
        logger.error('[ATS] updateCandidateStatus error:', error.message);
        next(error);
    }
};

/**
 * 8. DELETE /api/candidates/:id
 * Delete candidate profile (soft delete with multi-tenant check)
 */
export const deleteCandidate = async (req, res, next) => {
    try {
        const companyId = resolveCompanyId(req);
        const { id } = req.params;

        const candidate = await prisma.candidate.findFirst({
            where: { id, recruitmentjob: { companyId }, deletedAt: null }
        });

        if (!candidate) {
            return res.status(404).json({ status: 'error', message: 'المرشح غير موجود أو لا تملك صلاحية الوصول إليه' });
        }

        await prisma.$transaction(async (tx) => {
            await tx.candidate.update({
                where: { id },
                data: { deletedAt: new Date() }
            });

            await tx.candidateHistory.create({
                data: {
                    candidateId: id,
                    action: 'حذف ملف المرشح',
                    comment: 'تم حذف ملف المرشح بنجاح من المنصة',
                    performedBy: req.user?.id || 'SYSTEM'
                }
            });
        }, { timeout: 15000, maxWait: 10000 });

        // Record immutable system audit log
        await auditService.log({
            userId: req.user?.id,
            companyId,
            action: 'DELETE_CANDIDATE',
            actionType: 'ATS_RECRUITMENT',
            severity: 'MEDIUM',
            target: id,
            status: 'SUCCESS',
            details: { candidateName: candidate.fullName, email: candidate.email, jobId: candidate.jobId }
        });

        res.status(200).json({ status: 'success', message: 'تم حذف المرشح بنجاح ✨' });
    } catch (error) {
        logger.error('[ATS] deleteCandidate error:', error.message);
        next(error);
    }
};

/**
 * 9. PUT /api/candidates/:id
 * Update candidate personal & professional information
 */
export const updateCandidate = async (req, res, next) => {
    try {
        const companyId = resolveCompanyId(req);
        const { id } = req.params;
        const {
            fullName,
            name,
            email,
            phone,
            location,
            nationality,
            dateOfBirth,
            currentTitle,
            yearsOfExperience,
            skills,
            education,
            certifications,
            languages,
            portfolioLinks,
            certificates,
            salaryExpectation,
            availability
        } = req.body;

        const candidate = await prisma.candidate.findFirst({
            where: { id, recruitmentjob: { companyId }, deletedAt: null }
        });

        if (!candidate) {
            return res.status(404).json({ status: 'error', message: 'المرشح غير موجود أو لا تملك صلاحية الوصول إليه' });
        }

        const candidateName = fullName || name || candidate.fullName;
        const candidateEmail = email || candidate.email;

        const updated = await prisma.candidate.update({
            where: { id },
            data: {
                fullName: candidateName.substring(0, 200),
                email: candidateEmail.substring(0, 200),
                phone: phone !== undefined ? (phone ? String(phone).substring(0, 50) : null) : candidate.phone,
                location: location !== undefined ? (location ? String(location).substring(0, 100) : null) : candidate.location,
                nationality: nationality !== undefined ? (nationality ? String(nationality).substring(0, 100) : null) : candidate.nationality,
                dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : candidate.dateOfBirth,
                currentTitle: currentTitle !== undefined ? (currentTitle ? String(currentTitle).substring(0, 150) : null) : candidate.currentTitle,
                yearsOfExperience: yearsOfExperience !== undefined ? parseInt(yearsOfExperience) : candidate.yearsOfExperience,
                skills: skills ? (typeof skills === 'object' ? JSON.stringify(skills) : String(skills)) : candidate.skills,
                education: education ? (typeof education === 'object' ? JSON.stringify(education) : String(education)) : candidate.education,
                certifications: certifications ? (typeof certifications === 'object' ? JSON.stringify(certifications) : String(certifications)) : candidate.certifications,
                languages: languages ? (typeof languages === 'object' ? JSON.stringify(languages) : String(languages)) : candidate.languages,
                portfolioLinks: portfolioLinks ? (typeof portfolioLinks === 'object' ? JSON.stringify(portfolioLinks) : String(portfolioLinks)) : candidate.portfolioLinks,
                certificates: certificates ? (typeof certificates === 'object' ? JSON.stringify(certificates) : String(certificates)) : candidate.certificates,
                salaryExpectation: salaryExpectation !== undefined ? parseFloat(salaryExpectation) : candidate.salaryExpectation,
                availability: availability !== undefined ? String(availability).substring(0, 100) : candidate.availability,
                updatedAt: new Date()
            }
        });

        await prisma.candidateHistory.create({
            data: {
                candidateId: id,
                action: 'تحديث بيانات المرشح',
                comment: 'تم تحديث الملف الشخصي والبيانات المهنية للمرشح',
                performedBy: req.user?.id || 'SYSTEM'
            }
        });

        res.status(200).json({ status: 'success', message: 'تم تحديث بيانات المرشح بنجاح ✨', data: updated });
    } catch (error) {
        logger.error('[ATS] updateCandidate error:', error.message);
        next(error);
    }
};

/**
 * 10. POST /api/candidates/:id/notes
 * Add internal HR note for a candidate
 */
export const addCandidateNote = async (req, res, next) => {
    try {
        const companyId = resolveCompanyId(req);
        const { id } = req.params;
        const { content } = req.body;

        if (!content || !content.trim()) {
            return res.status(400).json({ status: 'error', message: 'محتوى الملاحظة مطلوب' });
        }

        const candidate = await prisma.candidate.findFirst({
            where: { id, recruitmentjob: { companyId }, deletedAt: null }
        });

        if (!candidate) {
            return res.status(404).json({ status: 'error', message: 'المرشح غير موجود أو لا تملك صلاحية الوصول إليه' });
        }

        const note = await prisma.candidateNote.create({
            data: {
                candidateId: id,
                authorId: req.user?.id || null,
                authorName: req.user?.name || req.user?.email || 'مسؤول التوظيف',
                content: content.trim(),
                createdAt: new Date()
            }
        });

        await prisma.candidateHistory.create({
            data: {
                candidateId: id,
                action: 'إضافة ملاحظة داخلية',
                comment: `أضاف ${note.authorName} ملاحظة جديدة: ${content.slice(0, 50)}...`,
                performedBy: req.user?.id || 'SYSTEM'
            }
        });

        res.status(201).json({ status: 'success', message: 'تمت إضافة الملاحظة بنجاح ✨', data: note });
    } catch (error) {
        logger.error('[ATS] addCandidateNote error:', error.message);
        next(error);
    }
};

/**
 * 11. GET /api/candidates/:id/notes
 * List all notes for a candidate
 */
export const getCandidateNotes = async (req, res, next) => {
    try {
        const companyId = resolveCompanyId(req);
        const { id } = req.params;

        const candidate = await prisma.candidate.findFirst({
            where: { id, recruitmentjob: { companyId }, deletedAt: null }
        });

        if (!candidate) {
            return res.status(404).json({ status: 'error', message: 'المرشح غير موجود أو لا تملك صلاحية الوصول إليه' });
        }

        const notes = await prisma.candidateNote.findMany({
            where: { candidateId: id },
            orderBy: { createdAt: 'desc' }
        });

        res.status(200).json({ status: 'success', count: notes.length, data: notes });
    } catch (error) {
        logger.error('[ATS] getCandidateNotes error:', error.message);
        next(error);
    }
};

/**
 * 12. DELETE /api/candidates/:id/notes/:noteId
 * Delete a specific note
 */
export const deleteCandidateNote = async (req, res, next) => {
    try {
        const companyId = resolveCompanyId(req);
        const { id, noteId } = req.params;

        const candidate = await prisma.candidate.findFirst({
            where: { id, recruitmentjob: { companyId }, deletedAt: null }
        });

        if (!candidate) {
            return res.status(404).json({ status: 'error', message: 'المرشح غير موجود أو لا تملك صلاحية الوصول إليه' });
        }

        const note = await prisma.candidateNote.findFirst({
            where: { id: noteId, candidateId: id }
        });

        if (!note) {
            return res.status(404).json({ status: 'error', message: 'الملاحظة غير موجودة' });
        }

        await prisma.candidateNote.delete({ where: { id: noteId } });

        res.status(200).json({ status: 'success', message: 'تم حذف الملاحظة بنجاح ✨' });
    } catch (error) {
        logger.error('[ATS] deleteCandidateNote error:', error.message);
        next(error);
    }
};

/**
 * 13. POST /api/candidates/:id/applications
 * Apply candidate to a Job (Multi-Job Application support)
 */
export const createCandidateApplication = async (req, res, next) => {
    try {
        const companyId = resolveCompanyId(req);
        const { id } = req.params;
        const { jobRequestId, jobId, status } = req.body;

        const targetJobId = jobRequestId || jobId;
        if (!targetJobId) {
            return res.status(400).json({ status: 'error', message: 'معرف الوظيفة (jobRequestId/jobId) مطلوب' });
        }

        const candidate = await prisma.candidate.findFirst({
            where: { id, recruitmentjob: { companyId }, deletedAt: null }
        });

        if (!candidate) {
            return res.status(404).json({ status: 'error', message: 'المرشح غير موجود أو لا تملك صلاحية الوصول إليه' });
        }

        // Check RecruitmentJob first, then JobRequest
        const rJob = await prisma.recruitmentJob.findFirst({
            where: { id: targetJobId, companyId, deletedAt: null }
        });
        const jRequest = !rJob ? await prisma.jobRequest.findFirst({
            where: { id: targetJobId, companyId }
        }) : null;

        if (!rJob && !jRequest) {
            return res.status(404).json({ status: 'error', message: 'الوظيفة المحددة غير موجودة لدى شركتكم' });
        }

        const jobTitle = rJob?.title || jRequest?.jobTitle || 'وظيفة';
        const candidateScore = candidate.aiScore !== null && candidate.aiScore !== undefined ? candidate.aiScore : null;
        const matchAnalysis = candidateScore !== null 
            ? `تم تقديم طلب للمرشح ${candidate.fullName} على وظيفة (${jobTitle}) بدرجة مطابقة ${candidateScore}%`
            : `تم تقديم طلب للمرشح ${candidate.fullName} على وظيفة (${jobTitle}) (بانتظار إجراء مطابقة الذكاء الاصطناعي)`;

        const appStatus = (status || 'APPLIED').toUpperCase();

        const application = await prisma.candidateApplication.create({
            data: {
                candidateId: id,
                jobId: rJob?.id || null,
                jobRequestId: jRequest?.id || null,
                status: appStatus,
                score: candidateScore,
                matchAnalysis
            }
        });

        await prisma.candidateHistory.create({
            data: {
                candidateId: id,
                action: 'تقديم طلب على وظيفة جديدة',
                comment: `تم ربط وتقديم طلب على وظيفة (${jobTitle}) - الحالة: ${appStatus}`,
                performedBy: req.user?.id || 'SYSTEM'
            }
        });

        res.status(201).json({ status: 'success', message: 'تم تقديم الطلب على الوظيفة بنجاح ✨', data: application });
    } catch (error) {
        logger.error('[ATS] createCandidateApplication error:', error.message);
        next(error);
    }
};

/**
 * 14. GET /api/candidates/:id/applications
 * List all job applications for a candidate
 */
export const getCandidateApplications = async (req, res, next) => {
    try {
        const companyId = resolveCompanyId(req);
        const { id } = req.params;

        const candidate = await prisma.candidate.findFirst({
            where: { id, recruitmentjob: { companyId }, deletedAt: null }
        });

        if (!candidate) {
            return res.status(404).json({ status: 'error', message: 'المرشح غير موجود أو لا تملك صلاحية الوصول إليه' });
        }

        const applications = await prisma.candidateApplication.findMany({
            where: { candidateId: id },
            include: { recruitmentjob: true, jobRequest: true },
            orderBy: { createdAt: 'desc' }
        });

        res.status(200).json({ status: 'success', count: applications.length, data: applications });
    } catch (error) {
        logger.error('[ATS] getCandidateApplications error:', error.message);
        next(error);
    }
};



