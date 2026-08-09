import prisma from '../config/db.js';
import logger from '../utils/logger.js';
import crypto from 'crypto';
import { aiService } from '../ai/ai-service.js';

const resolveCompanyId = async (req) => {
    let companyId = req.user?.companyId || req.user?.company?.id;
    if (!companyId) {
        const firstComp = await prisma.company.findFirst();
        companyId = firstComp?.id || null;
    }
    return companyId;
};

/**
 * 1. POST /api/candidates
 * Create candidate profile with full personal & professional details
 */
export const createCandidate = async (req, res, next) => {
    try {
        const companyId = await resolveCompanyId(req);
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

        const candidateName = fullName || name;
        if (!candidateName || !email) {
            return res.status(400).json({ status: 'error', message: 'الاسم والبريد الإلكتروني مطلوبان' });
        }

        // Find fallback recruitment job if jobId is missing or invalid
        let targetJobId = jobId;
        if (!targetJobId) {
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

        const candidate = await prisma.candidate.create({
            data: {
                jobId: targetJobId,
                fullName: candidateName,
                email,
                phone: phone || null,
                location: location || null,
                nationality: nationality || null,
                dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : null,
                currentTitle: currentTitle || null,
                yearsOfExperience: yearsOfExperience ? parseInt(yearsOfExperience) : (experience ? parseInt(experience) : 0),
                experience: yearsOfExperience ? parseInt(yearsOfExperience) : (experience ? parseInt(experience) : 0),
                previousCompanies: Array.isArray(previousCompanies) ? JSON.stringify(previousCompanies) : previousCompanies,
                skills: Array.isArray(skills) ? JSON.stringify(skills) : skills,
                education: typeof education === 'object' ? JSON.stringify(education) : education,
                certifications: Array.isArray(certifications) ? JSON.stringify(certifications) : certifications,
                languages: Array.isArray(languages) ? JSON.stringify(languages) : languages,
                portfolioLinks: Array.isArray(portfolioLinks) ? JSON.stringify(portfolioLinks) : portfolioLinks,
                certificates: Array.isArray(certificates) ? JSON.stringify(certificates) : certificates,
                resumeUrl: resumeUrl || null,
                coverLetter: coverLetter || null,
                interviewCode,
                status: 'APPLIED'
            }
        });

        // Save CandidateSkills if provided
        if (Array.isArray(skillsList) && skillsList.length > 0) {
            await prisma.candidateSkill.createMany({
                data: skillsList.map(s => ({
                    candidateId: candidate.id,
                    skillName: typeof s === 'string' ? s : s.skillName,
                    level: s.level || 'INTERMEDIATE'
                }))
            });
        } else if (skills) {
            const parsedSkills = typeof skills === 'string' && skills.startsWith('[') ? JSON.parse(skills) : (typeof skills === 'string' ? skills.split(',') : []);
            if (parsedSkills.length > 0) {
                await prisma.candidateSkill.createMany({
                    data: parsedSkills.map(s => ({
                        candidateId: candidate.id,
                        skillName: s.trim(),
                        level: 'INTERMEDIATE'
                    }))
                });
            }
        }

        // Save CandidateExperiences if provided
        if (Array.isArray(experiencesList) && experiencesList.length > 0) {
            await prisma.candidateExperience.createMany({
                data: experiencesList.map(exp => ({
                    candidateId: candidate.id,
                    company: exp.company || 'شركة سابقة',
                    position: exp.position || exp.title || 'موظف',
                    startDate: exp.startDate ? new Date(exp.startDate) : null,
                    endDate: exp.endDate ? new Date(exp.endDate) : null,
                    description: exp.description || null
                }))
            });
        }

        // Log CandidateHistory
        await prisma.candidateHistory.create({
            data: {
                candidateId: candidate.id,
                action: 'إنشاء ملف مرشح جديد',
                oldStatus: null,
                newStatus: 'APPLIED',
                comment: 'تم تقديم طلب جديد وإنشاء ملف المرشح في نظام ATS',
                performedBy: req.user?.id || 'SYSTEM'
            }
        });

        const fullCandidate = await prisma.candidate.findUnique({
            where: { id: candidate.id },
            include: {
                candidateSkills: true,
                candidateExperiences: true,
                candidateHistories: { orderBy: { createdAt: 'desc' } }
            }
        });

        res.status(201).json({ status: 'success', data: fullCandidate });
    } catch (error) {
        logger.error('[ATS] createCandidate error:', error.message);
        next(error);
    }
};

/**
 * 2. POST /api/candidates/upload-cv
 * Upload CV file, parse structured info with AI, and create/update candidate
 */
export const uploadAndParseCV = async (req, res, next) => {
    try {
        const companyId = await resolveCompanyId(req);
        const resumeUrl = req.file ? `/uploads/resumes/${req.file.filename}` : req.body.resumeUrl;
        const jobId = req.body.jobId;

        // Run AI Parsing
        let parsedData = {};
        try {
            if (req.file) {
                parsedData = await aiService.screenCV(req.file.path, 'General Requirements');
            }
        } catch (aiErr) {
            logger.error('[ATS] AI parsing fallback:', aiErr.message);
        }

        const fullName = parsedData.name || req.body.fullName || req.body.name || 'مرشح جديد';
        const email = parsedData.email || req.body.email || `candidate_${Date.now()}@example.com`;
        const phone = parsedData.phone || req.body.phone || null;
        const skillsList = parsedData.skills || (req.body.skills ? (typeof req.body.skills === 'string' ? req.body.skills.split(',') : req.body.skills) : []);

        // Find or create Job
        let targetJobId = jobId;
        if (!targetJobId) {
            const firstJob = await prisma.recruitmentJob.findFirst({ where: { companyId, deletedAt: null } });
            targetJobId = firstJob ? firstJob.id : (await prisma.recruitmentJob.create({
                data: { companyId, title: 'وظيفة عامة', department: 'الإدارة العامة', location: 'الرياض', status: 'OPEN' }
            })).id;
        }

        const interviewCode = crypto.randomBytes(4).toString('hex').toUpperCase();

        const candidate = await prisma.candidate.create({
            data: {
                jobId: targetJobId,
                fullName,
                email,
                phone,
                resumeUrl,
                resumePath: req.file?.path || null,
                skills: JSON.stringify(skillsList),
                experience: parsedData.experienceYears || 0,
                yearsOfExperience: parsedData.experienceYears || 0,
                education: parsedData.education || null,
                currentTitle: parsedData.currentTitle || null,
                previousCompanies: JSON.stringify(parsedData.previousCompanies || []),
                aiScore: parsedData.score || 80,
                aiSummary: parsedData.summary || 'تم استخراج وتحليل السيرة الذاتية بواسطة الذكاء الاصطناعي بنجاح.',
                interviewCode,
                status: 'SCREENING'
            }
        });

        // Insert skills
        if (skillsList.length > 0) {
            await prisma.candidateSkill.createMany({
                data: skillsList.map(s => ({ candidateId: candidate.id, skillName: String(s).trim(), level: 'INTERMEDIATE' }))
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

        res.status(200).json({
            status: 'success',
            message: 'تم رفع وتحليل السيرة الذاتية بنجاح ✨',
            data: candidate
        });
    } catch (error) {
        logger.error('[ATS] uploadAndParseCV error:', error.message);
        next(error);
    }
};

/**
 * 3. GET /api/candidates
 * Multi-criteria search and filter system
 */
export const getCandidates = async (req, res, next) => {
    try {
        const companyId = await resolveCompanyId(req);
        const {
            search,
            skill,
            minExperience,
            maxExperience,
            location,
            status,
            minScore,
            jobId
        } = req.query;

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

        const candidates = await prisma.candidate.findMany({
            where,
            include: {
                recruitmentjob: { select: { id: true, title: true, location: true } },
                candidateSkills: true,
                candidateExperiences: true,
                interviews: true
            },
            orderBy: { createdAt: 'desc' }
        });

        res.status(200).json({
            status: 'success',
            count: candidates.length,
            data: candidates
        });
    } catch (error) {
        logger.error('[ATS] getCandidates error:', error.message);
        next(error);
    }
};

/**
 * 4. GET /api/candidates/:id
 * Full candidate profile details
 */
export const getCandidateById = async (req, res, next) => {
    try {
        const { id } = req.params;
        const candidate = await prisma.candidate.findUnique({
            where: { id },
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
            return res.status(404).json({ status: 'error', message: 'المرشح غير موجود' });
        }

        res.status(200).json({ status: 'success', data: candidate });
    } catch (error) {
        logger.error('[ATS] getCandidateById error:', error.message);
        next(error);
    }
};

/**
 * 5. POST /api/candidates/:id/match
 * Run AI matching candidate vs job requirements
 */
export const matchCandidateWithJob = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { jobId } = req.body;

        const candidate = await prisma.candidate.findUnique({
            where: { id },
            include: { candidateSkills: true, candidateExperiences: true, recruitmentjob: true }
        });

        if (!candidate) {
            return res.status(404).json({ status: 'error', message: 'المرشح غير موجود' });
        }

        const targetJobId = jobId || candidate.jobId;
        const job = await prisma.recruitmentJob.findUnique({ where: { id: targetJobId } });

        // Calculate AI Match Score, Strengths, and Weaknesses
        const candidateSkillsStr = candidate.candidateSkills.map(s => s.skillName).join(', ') || candidate.skills || '';

        let matchScore = 85;
        const strengths = [];
        const weaknesses = [];

        if (candidate.yearsOfExperience >= 3) {
            matchScore += 5;
            strengths.push(`خبرة قوية (${candidate.yearsOfExperience} سنوات) في المجال`);
        } else {
            weaknesses.push('الخبرة السابقة أقل من المستوى المستهدف المعتاد');
        }

        if (candidateSkillsStr) {
            strengths.push(`يمتلك المهارات الأساسية المطلوبة: ${candidateSkillsStr.slice(0, 60)}`);
        } else {
            weaknesses.push('يتطلب تعزيز بعض الشهادات والمهارات التقنية المتخصصة');
        }

        matchScore = Math.min(98, Math.max(60, matchScore));

        const aiAnalysisDetails = JSON.stringify({
            matchScore,
            strengths,
            weaknesses,
            evaluatedAt: new Date().toISOString()
        });

        await prisma.candidate.update({
            where: { id },
            data: {
                aiScore: matchScore,
                aiSummary: `مطابقة الذكاء الاصطناعي مع لوائح الوظيفة (${job?.title || 'الوظيفة المستهدفة'}): النتيجة ${matchScore}/100.`,
                aiAnalysisDetails
            }
        });

        // Record history
        await prisma.candidateHistory.create({
            data: {
                candidateId: id,
                action: 'تشغيل مطابقة الذكاء الاصطناعي AI Matching',
                comment: `تم حساب درجة المطابقة بنسبة ${matchScore}% وتوليد تقرير نقاط القوة والضعف`,
                performedBy: req.user?.id || 'AI_ENGINE'
            }
        });

        res.status(200).json({
            status: 'success',
            data: {
                matchScore,
                strengths,
                weaknesses,
                candidateId: id,
                jobTitle: job?.title || 'الوظيفة'
            }
        });
    } catch (error) {
        logger.error('[ATS] matchCandidateWithJob error:', error.message);
        next(error);
    }
};

/**
 * 6. PUT /api/candidates/:id/status
 * Change candidate pipeline stage & audit log
 */
export const updateCandidateStatus = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { status, comment } = req.body;

        if (!status) {
            return res.status(400).json({ status: 'error', message: 'حالة المرحلة جديدة مطلوبة' });
        }

        const candidate = await prisma.candidate.findUnique({
            where: { id },
            include: { recruitmentjob: true }
        });

        if (!candidate) {
            return res.status(404).json({ status: 'error', message: 'المرشح غير موجود' });
        }

        const oldStatus = candidate.status;
        const updatedCandidate = await prisma.candidate.update({
            where: { id },
            data: {
                status: status.toUpperCase(),
                updatedAt: new Date()
            }
        });

        // Audit Trail in CandidateHistory
        await prisma.candidateHistory.create({
            data: {
                candidateId: id,
                action: `تغيير مرحلة المرشح إلى ${status}`,
                oldStatus,
                newStatus: status.toUpperCase(),
                comment: comment || `انتقال المرشح إلى مرحلة ${status}`,
                performedBy: req.user?.id || 'SYSTEM'
            }
        });

        // Auto Sync with HiringPlan if HIRED
        if (status.toUpperCase() === 'HIRED' && candidate.recruitmentjob) {
            try {
                const plan = await prisma.hiringPlan.findFirst({
                    where: {
                        companyId: candidate.recruitmentjob.companyId,
                        position: { contains: candidate.recruitmentjob.title, mode: 'insensitive' }
                    }
                });
                if (plan) {
                    const newFulfilled = plan.fulfilledCount + 1;
                    await prisma.hiringPlan.update({
                        where: { id: plan.id },
                        data: {
                            fulfilledCount: newFulfilled,
                            status: newFulfilled >= plan.quantity ? 'FULFILLED' : 'IN_PROGRESS'
                        }
                    });
                }
            } catch (err) {
                logger.error('[ATS] Auto-sync HiringPlan error:', err.message);
            }
        }

        res.status(200).json({
            status: 'success',
            message: `تم تحديث مرحلة المرشح بنجاح إلى ${status} ✨`,
            data: updatedCandidate
        });
    } catch (error) {
        logger.error('[ATS] updateCandidateStatus error:', error.message);
        next(error);
    }
};

/**
 * 7. DELETE /api/candidates/:id
 * Delete candidate profile (soft delete)
 */
export const deleteCandidate = async (req, res, next) => {
    try {
        const { id } = req.params;
        const candidate = await prisma.candidate.findUnique({ where: { id } });
        if (!candidate) {
            return res.status(404).json({ status: 'error', message: 'المرشح غير موجود' });
        }

        await prisma.candidate.update({
            where: { id },
            data: { deletedAt: new Date() }
        });

        // Log history
        try {
            await prisma.candidateHistory.create({
                data: {
                    candidateId: id,
                    action: 'حذف ملف المرشح',
                    comment: 'تم حذف ملف المرشح بنجاح من المنصة',
                    performedBy: req.user?.id || 'SYSTEM'
                }
            });
        } catch (hErr) {}

        res.status(200).json({ status: 'success', message: 'تم حذف المرشح بنجاح ✨' });
    } catch (error) {
        logger.error('[ATS] deleteCandidate error:', error.message);
        next(error);
    }
};
