import prisma from '../config/db.js';
import logger from '../utils/logger.js';
import { aiService } from '../ai/ai-service.js';
import { createNotification } from './notification.controller.js';
import { SearchService } from '../services/search.service.js';
import { QueueService } from '../services/queue.service.js';

// --- Course Repository Management (Admin) ---

export const getCourses = async (req, res, next) => {
    try {
        const courses = await prisma.trainingCourse.findMany({
            where: { status: 'active' }
        });
        res.status(200).json({ status: 'success', data: courses });
    } catch (error) {
        next(error);
    }
};

export const getCourseDetails = async (req, res, next) => {
    try {
        const course = await prisma.trainingCourse.findUnique({ where: { id: req.params.id } });
        res.status(200).json({ status: 'success', data: course });
    } catch (error) {
        next(error);
    }
};

export const createTraining = async (req, res, next) => {
    try {
        const { title, description, provider, category, url, duration, skills, level, language } = req.body;

        // Guardrail: Ensure logic doesn't allow empty URLs for "Smart" courses if needed, 
        // though for now we allow flexibility.

        const training = await prisma.trainingCourse.create({
            data: {
                title,
                description,
                provider,
                category,
                url,
                duration: Number(duration),
                skills: skills ? JSON.stringify(skills) : undefined,
                level: level || 'beginner',
                language: language || 'ar',
                isFree: true, // Default to true based on reqs
                status: 'active'
            }
        });

        // Smart Search Indexing
        try {
            const indexContent = `Course: ${title}. Description: ${description}. Category: ${category || ''}. Provider: ${provider || ''}.`;
            await SearchService.indexDocument({
                companyId: 'GLOBAL',
                documentId: training.id,
                documentType: 'COURSE',
                content: indexContent,
                metadata: { title: training.title, category: training.category }
            });
        } catch (idxError) {
            logger.error('Indexing failed for training course', { courseId: course.id, error: idxError.message });
        }

        res.status(201).json({ status: 'success', data: training });
    } catch (error) {
        next(error);
    }
};

export const updateTraining = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { title, description, category, duration, url, provider, skills, level, language, status } = req.body;

        const training = await prisma.trainingCourse.update({
            where: { id },
            data: {
                title,
                description,
                category,
                duration: duration ? Number(duration) : undefined,
                url,
                provider,
                skills: skills !== undefined ? JSON.stringify(skills) : undefined,
                level,
                language,
                status
            }
        });

        // Update Search Index
        if (training.status === 'active') {
            try {
                const indexContent = `Course: ${training.title}. Description: ${training.description}. Category: ${training.category || ''}. Provider: ${training.provider || ''}.`;
                await SearchService.indexDocument({
                    companyId: 'GLOBAL',
                    documentId: training.id,
                    documentType: 'COURSE',
                    content: indexContent,
                    metadata: { title: training.title, category: training.category }
                });
            } catch (idxError) {
                logger.error('Indexing failed for training update', { courseId: course.id, error: idxError.message });
            }
        }

        res.status(200).json({ status: 'success', data: training });
    } catch (error) {
        next(error);
    }
};

export const deleteTraining = async (req, res, next) => {
    try {
        const { id } = req.params;

        // Check if there are any assignments
        const assignments = await prisma.trainingAssignment.count({
            where: { courseId: id }
        });

        if (assignments > 0) {
            // Soft delete or just deactivate
            await prisma.trainingCourse.update({
                where: { id },
                data: { status: 'inactive' }
            });
            return res.status(200).json({
                status: 'success',
                message: 'تم تعطيل الدورة لوجود تعيينات مرتبطة بها'
            });
        }

        await prisma.trainingCourse.delete({
            where: { id }
        });

        res.status(204).json({ status: 'success', data: null });
    } catch (error) {
        next(error);
    }
};

// --- Employee / Assignment Management ---

export const getEnrolledCourses = async (req, res, next) => {
    try {
        const employee = await prisma.employee.findUnique({ where: { userId: req.user.id } });
        const assignments = await prisma.trainingAssignment.findMany({
            where: { employeeId: employee.id },
            include: { course: true },
            orderBy: { assignedAt: 'desc' }
        });
        res.status(200).json({ status: 'success', data: assignments });
    } catch (error) {
        next(error);
    }
};

export const assignTraining = async (req, res, next) => {
    try {
        const { employeeId, courseId, trainingId, title, description, category, duration } = req.body;

        let targetCourseId = courseId || trainingId;

        // If no course ID is provided and we have a title, create a new course on the fly
        if (!targetCourseId && title) {
            const newCourse = await prisma.trainingCourse.create({
                data: {
                    title,
                    description: description || '',
                    category: category || 'General',
                    duration: Number(duration) || 60,
                    status: 'active'
                }
            });
            targetCourseId = newCourse.id;

            // Index new course
            try {
                const indexContent = `Course: ${newCourse.title}. Description: ${newCourse.description}. Category: ${newCourse.category || ''}.`;
                await SearchService.indexDocument({
                    companyId: 'GLOBAL',
                    documentId: newCourse.id,
                    documentType: 'COURSE',
                    content: indexContent,
                    metadata: { title: newCourse.title, category: newCourse.category }
                });
            } catch (idxError) {
                logger.error('Indexing failed for dynamic training', { courseId: course.id, error: idxError.message });
            }
        }

        if (!targetCourseId) {
            return res.status(400).json({ status: 'error', message: 'يرجى تحديد دورة موجودة أو إدخال بيانات دورة جديدة' });
        }

        // Prevent Duplicate Active Assignment
        const existing = await prisma.trainingAssignment.findFirst({
            where: {
                employeeId,
                courseId: targetCourseId,
                status: { in: ['PENDING', 'IN_PROGRESS'] }
            }
        });

        if (existing) {
            return res.status(400).json({ status: 'error', message: 'الموظف لديه تعيين نشط لهذه الدورة بالفعل' });
        }

        // Fetch full employee details for AI
        const employee = await prisma.employee.findUnique({
            where: { id: employeeId },
            include: { user: true }
        });

        if (!employee) {
            return res.status(404).json({ status: 'error', message: 'الموظف غير موجود' });
        }

        // Fetch course details
        const course = await prisma.trainingCourse.findUnique({ where: { id: targetCourseId } });

        if (!course) {
            return res.status(404).json({ status: 'error', message: 'الدورة غير موجودة' });
        }

        // Assign to employee with new fields
        const assignment = await prisma.trainingAssignment.create({
            data: {
                employeeId,
                courseId: targetCourseId,
                status: 'PENDING',
                assignedAt: new Date(),
                trainingPlan: null, // Will be filled by worker
                quiz: null          // Will be filled by worker
            },
            include: {
                course: true
            }
        });

        // Generate Plan & Quiz (Async Background Job)
        // We do NOT wait for this anymore to prevent timeout
        await QueueService.addJob('generateTrainingPlan', {
            assignmentId: assignment.id,
            courseId: targetCourseId,
            employeeId
        });

        // Notify employee
        await createNotification({
            employeeId,
            title: 'توصية تدريب ذكية',
            message: `تم اختيار دورة "${assignment.course.title}" لك لتحسين مهاراتك. جاري إعداد الخطة الدراسية...`,
            type: 'training',
            priority: 'high',
            metadata: { courseId: targetCourseId, assignmentId: assignment.id }
        });

        res.status(201).json({ status: 'success', data: assignment, message: 'Training assigned. AI is generating the plan in the background.' });
    } catch (error) {
        next(error);
    }
};

// --- Execution & Lifecycle ---

export const startTraining = async (req, res, next) => {
    try {
        const { id } = req.params; // Assignment ID

        const assignment = await prisma.trainingAssignment.update({
            where: { id },
            data: {
                status: 'IN_PROGRESS',
                startedAt: new Date(),
                progress: 10 // Started
            }
        });

        res.status(200).json({ status: 'success', data: assignment });
    } catch (error) {
        next(error);
    }
};

export const completeTraining = async (req, res, next) => {
    try {
        const { id } = req.params; // Assignment ID
        const { notes } = req.body;

        const assignment = await prisma.trainingAssignment.update({
            where: { id },
            data: {
                status: 'COMPLETED', // Waiting for 'EVALUATED' later by Impact Analyzer
                completedAt: new Date(),
                progress: 100,
                employeeNotes: notes
            },
            include: { course: true, employee: { include: { user: true } } }
        });

        // Notify Manager
        // ... (Logic to find manager and notify)

        res.status(200).json({ status: 'success', data: assignment });
    } catch (error) {
        next(error);
    }
};

export const updateEnrollmentProgress = async (req, res, next) => {
    try {
        const { enrollmentId } = req.params;
        const { progress, score } = req.body;

        const data = {
            progress: Number(progress)
        };

        if (score !== undefined) {
            data.quizScore = Number(score);
        }

        if (Number(progress) >= 100) {
            data.status = 'COMPLETED';
            data.completedAt = new Date();
        } else if (Number(progress) > 0) {
            data.status = 'IN_PROGRESS';
            if (!data.startedAt) data.startedAt = new Date(); // Only if not already started? Prisma won't check. 
            // Better not to overwrite startedAt if exists.
        }

        const assignment = await prisma.trainingAssignment.update({
            where: { id: enrollmentId },
            data,
            include: { course: true }
        });

        res.status(200).json({ status: 'success', data: assignment });
    } catch (error) {
        next(error);
    }
};

// --- AI & Impact ---

export const detectTrainingNeeds = async (req, res, next) => {
    try {
        const { employeeId } = req.params;

        // 1. Check Cache (Redis or DB Log) - TODO: Implement if expensive

        // 2. Fetch Employee Performance Data
        const employee = await prisma.employee.findUnique({
            where: { id: employeeId },
            include: {
                tasks: { take: 10, orderBy: { createdAt: 'desc' } }, // Recent tasks
                user: { select: { name: true, role: true } }
            }
        });

        if (!employee) {
            return res.status(404).json({ status: 'error', message: 'Employee not found' });
        }

        // 3. AI Analysis - Identify Skill Gaps
        const analysis = await aiService.analyzeTrainingNeeds(employee);

        // 4. Fetch Available Active Courses
        const availableCourses = await prisma.trainingCourse.findMany({
            where: { status: 'active' },
            select: { id: true, title: true, skills: true, provider: true, level: true }
        });

        // 5. AI Matching - Match Gaps to Courses
        const matches = await aiService.matchTrainingCourses(analysis.needs, availableCourses);

        // Enhance matches with full course details
        const recommendedCourses = matches.matches.map(match => {
            const course = availableCourses.find(c => c.id === match.courseId);
            return {
                ...match,
                course
            };
        });

        res.status(200).json({
            status: 'success',
            data: {
                employeeName: employee.user.name,
                needsAnalysis: analysis,
                recommendations: recommendedCourses
            }
        });
    } catch (error) {
        next(error);
    }
};

// Manual trigger for impact analysis (or scheduled)
export const evaluateTraining = async (req, res, next) => {
    try {
        const { id } = req.params; // Assignment ID

        const assignment = await prisma.trainingAssignment.findUnique({
            where: { id },
            include: { employee: true, course: true }
        });

        if (!assignment) return res.status(404).json({ message: 'Assignment not found' });

        // Simulate fetching before/after metrics (Mock for now or fetch real)
        const assignmentData = {
            course: assignment.course.title,
            employee: assignment.employee.id,
            completedAt: assignment.completedAt,
            notes: assignment.employeeNotes
        };

        const impact = await aiService.analyzeTrainingImpact(assignmentData);

        const updated = await prisma.trainingAssignment.update({
            where: { id },
            data: {
                status: 'EVALUATED',
                evaluatedAt: new Date(),
                impactScore: impact.impactScore,
                impactAnalysis: impact.impactAnalysis
            }
        });

        res.status(200).json({ status: 'success', data: updated });
    } catch (error) {
        next(error);
    }
};

export const getTrainingAnalytics = async (req, res, next) => {
    try {
        // Impact Analysis Dashboard
        const completed = await prisma.trainingAssignment.findMany({
            where: { status: { in: ['COMPLETED', 'EVALUATED'] } },
            include: { course: true, employee: { include: { user: true } } },
            take: 20
        });

        const results = completed.map(a => ({
            id: a.course.id,
            title: a.course.title,
            employeeName: a.employee.user.name,
            status: a.status,
            impactScore: a.impactScore || 0,
            impactAnalysis: a.impactAnalysis || 'في انتظار التحليل...'
        }));

        res.status(200).json({ status: 'success', data: results });
    } catch (error) {
        next(error);
    }
};

// --- Leftovers to maintain API compat or cleanup ---

export const deleteAssignment = async (req, res, next) => {
    try {
        const { id } = req.params;
        await prisma.trainingAssignment.delete({ where: { id } });
        res.status(204).json({ status: 'success', data: null });
    } catch (error) {
        next(error);
    }
};

// --- New Implementations for Routes ---

export const enrollInCourse = async (req, res, next) => {
    try {
        const { courseId } = req.params;
        const employee = await prisma.employee.findUnique({ where: { userId: req.user.id } });

        if (!employee) {
            return res.status(404).json({ status: 'error', message: 'Employee profile not found' });
        }

        // Check if already requested or enrolled
        const existingRequest = await prisma.trainingRequest.findFirst({
            where: {
                employeeId: employee.id,
                courseId,
                status: 'PENDING'
            }
        });

        if (existingRequest) {
            return res.status(400).json({ status: 'error', message: 'لقد قمت بطلب التسجيل في هذه الدورة بالفعل' });
        }

        const existingAssignment = await prisma.trainingAssignment.findFirst({
            where: {
                employeeId: employee.id,
                courseId,
                status: { in: ['PENDING', 'IN_PROGRESS', 'COMPLETED'] }
            }
        });

        if (existingAssignment) {
            return res.status(400).json({ status: 'error', message: 'أنت مسجل بالفعل في هذه الدورة' });
        }

        const request = await prisma.trainingRequest.create({
            data: {
                employeeId: employee.id,
                courseId,
                reason: 'طلب تسجيل من الموظف',
                status: 'PENDING',
                updatedAt: new Date()
            },
            include: {
                course: true
            }
        });

        // Notify Manager
        // For now, simple console log or you can use your notification service
        logger.info('New training enrollment request', { employeeId: employee.id, courseId });

        res.status(201).json({ status: 'success', data: request });
    } catch (error) {
        next(error);
    }
};

export const getTrainingNeeds = async (req, res, next) => {
    try {
        // Fetch training needs for the company/team
        // For now, return a placeholder or recent analysis
        const needs = await prisma.trainingRequest.findMany({
            where: { status: 'PENDING' },
            include: { employee: { include: { user: true } }, course: true }
        });
        res.status(200).json({ status: 'success', data: needs });
    } catch (error) {
        next(error);
    }
};

export const approveTrainingRequest = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { status } = req.body; // 'APPROVED' or 'REJECTED'

        const request = await prisma.trainingRequest.findUnique({
            where: { id },
            include: { employee: { include: { user: true } }, course: true }
        });

        if (!request) {
            return res.status(404).json({ status: 'error', message: 'طلب التدريب غير موجود' });
        }

        if (status === 'REJECTED') {
            const updated = await prisma.trainingRequest.update({
                where: { id },
                data: { status: 'REJECTED', updatedAt: new Date() }
            });
            return res.status(200).json({ status: 'success', data: updated });
        }

        // Logic for APPROVED
        // 1. Update Request
        await prisma.trainingRequest.update({
            where: { id },
            data: { status: 'APPROVED', updatedAt: new Date() }
        });

        let targetCourseId = request.courseId;
        let targetCourse = request.course;

        // If no courseId but has topic, create a course for it
        if (!targetCourseId && request.topic) {
            targetCourse = await prisma.trainingCourse.create({
                data: {
                    title: request.topic,
                    description: request.reason || 'تم إنشاؤه بناءً على توصية AI',
                    category: 'General',
                    duration: 60,
                    status: 'active'
                }
            });
            targetCourseId = targetCourse.id;

            // Index new course
            try {
                const indexContent = `Course: ${targetCourse.title}. Description: ${targetCourse.description}. Category: ${targetCourse.category || ''}.`;
                await SearchService.indexDocument({
                    companyId: 'GLOBAL',
                    documentId: targetCourse.id,
                    documentType: 'COURSE',
                    content: indexContent,
                    metadata: { title: targetCourse.title, category: targetCourse.category }
                });
            } catch (idxError) {
                logger.error('Indexing failed for approved topic training', { courseId: course.id, error: idxError.message });
            }
        }

        if (!targetCourseId) {
            return res.status(400).json({ status: 'error', message: 'لا يمكن البدء بدون تحديد دورة تدريبية' });
        }

        // 2. Create Assignment (mirroring assignTraining logic)
        // Generate AI Plan & Quiz
        const [trainingPlan, quiz] = await Promise.all([
            aiService.generateTrainingPlan(targetCourse, {
                name: request.employee.user.name,
                position: request.employee.position
            }),
            aiService.generateQuiz(targetCourse)
        ]);

        const assignment = await prisma.trainingAssignment.create({
            data: {
                employeeId: request.employeeId,
                courseId: targetCourseId,
                status: 'PENDING',
                assignedAt: new Date(),
                trainingPlan: JSON.stringify(trainingPlan),
                quiz: JSON.stringify(quiz)
            },
            include: {
                course: true
            }
        });

        // Notify employee
        await createNotification({
            employeeId: request.employeeId,
            title: 'تمت الموافقة على طلب التدريب',
            message: `تمت الموافقة على طلبك لدورة "${assignment.course.title}". يمكنك البدء الآن!`,
            type: 'training',
            priority: 'high',
            metadata: { courseId: targetCourseId, assignmentId: assignment.id }
        });

        res.status(200).json({ status: 'success', data: assignment });
    } catch (error) {
        next(error);
    }
};

export const getAssignedTrainings = async (req, res, next) => {
    try {
        const assignments = await prisma.trainingAssignment.findMany({
            where: {
                employee: {
                    companyId: req.user.companyId
                }
            },
            include: { course: true, employee: { include: { user: true } } },
            orderBy: { assignedAt: 'desc' }
        });
        res.status(200).json({ status: 'success', data: assignments });
    } catch (error) {
        next(error);
    }
};

export const respondToAssignment = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { status, feedback } = req.body;

        const assignment = await prisma.trainingAssignment.update({
            where: { id },
            data: {
                status,
                managerNotes: feedback
            }
        });
        res.status(200).json({ status: 'success', data: assignment });
    } catch (error) {
        next(error);
    }
};

export const getComprehensiveProposal = async (req, res, next) => {
    try {
        const companyId = req.user.companyId;

        // 1. Fetch relevant data for the proposal
        const [pendingRequests, recentImpact, performanceLogs] = await Promise.all([
            prisma.trainingRequest.findMany({
                where: { status: 'PENDING' },
                include: { employee: true, course: true },
                take: 10
            }),
            prisma.trainingAssignment.findMany({
                where: { status: 'EVALUATED' },
                orderBy: { evaluatedAt: 'desc' },
                take: 5
            }),
            prisma.aIUsageLog.findMany({
                where: { companyId, service: 'performance_analysis' },
                orderBy: { timestamp: 'desc' },
                take: 5
            })
        ]);

        const contextData = {
            pendingRequests: pendingRequests.map(r => ({ topic: r.topic || r.course?.title, employee: r.employee.id })),
            recentImpact: recentImpact.map(i => ({ score: i.impactScore, analysis: i.impactAnalysis })),
            performanceNotes: performanceLogs.map(l => l.prompt) // Simplified
        };

        // 2. Call AI to generate structured proposal
        const proposal = await aiService.generateTrainingProposal(contextData, companyId);

        res.status(200).json({
            status: 'success',
            data: proposal
        });
    } catch (error) {
        next(error);
    }
};

export const assignTrainingOld = async (req, res, next) => {
    // Deprecated or mapped to new logic if needed
    next(new Error("Use new assignTraining endpoint"));
};
