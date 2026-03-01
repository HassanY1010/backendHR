import { aiService } from '../ai/ai-service.js';
import prisma from '../config/db.js';

// Configuration
// const QUESTION_INTERVAL_MS = 3600 * 1000; // 1 Hour normally
const QUESTION_INTERVAL_MS = 3600 * 1000; // 1 Hour Strict Interval

export const getStatus = async (req, res, next) => {
    try {
        // req.user might have id (userId) and other fields. 
        // We generally need employeeId. 
        // In other controllers: const companyId = req.user.companyId; 
        // employee.controller.js uses req.user.id as userId to find employee.
        // We should probably find the employee first if not in req.user.

        let employeeId = req.user.employeeId;

        if (!employeeId) {
            const employee = await prisma.employee.findUnique({
                where: { userId: req.user.id }
            });
            if (employee) employeeId = employee.id;
        }

        if (!employeeId) return res.status(400).json({ status: 'error', message: 'Not an employee' });

        // Find active (PENDING) assessment
        const activeAssessment = await prisma.checkInAssessment.findFirst({
            where: {
                employeeId,
                status: 'PENDING'
            },
            include: {
                checkinentries: {
                    orderBy: { order: 'asc' }
                }
            }
        });

        if (!activeAssessment) {
            return res.status(200).json({ status: 'success', data: { state: 'IDLE' } });
        }

        const entries = activeAssessment.checkinentries;

        // Logic to find next question
        // If all answered?
        const allAnswered = entries.every(e => !!e.answeredAt);
        if (allAnswered) {
            // Should have been completed, but just in case
            await prisma.checkInAssessment.update({
                where: { id: activeAssessment.id },
                data: {
                    status: 'COMPLETED',
                    updatedAt: new Date()
                }
            });
            return res.status(200).json({ status: 'success', data: { state: 'IDLE' } });
        }

        const nextQuestion = entries.find(e => !e.answeredAt);

        if (!nextQuestion) {
            return res.status(200).json({ status: 'success', data: { state: 'IDLE' } });
        }

        // Check lock
        const now = new Date();
        const unlockTime = new Date(nextQuestion.unlockTime);

        if (now < unlockTime) {
            return res.status(200).json({
                status: 'success',
                data: {
                    state: 'LOCKED',
                    unlockTime: nextQuestion.unlockTime,
                    nextQuestionOrder: nextQuestion.order
                }
            });
        }

        return res.status(200).json({
            status: 'success',
            data: {
                state: 'ACTIVE_QUESTION',
                assessmentId: activeAssessment.id,
                entryId: nextQuestion.id,
                question: {
                    order: nextQuestion.order,
                    type: nextQuestion.questionType,
                    text: nextQuestion.questionText
                },
                expiresAt: new Date(now.getTime() + 30000)
            }
        });

    } catch (error) {
        next(error);
    }
};

export const triggerCheckIn = async (req, res, next) => {
    try {
        let employeeId = req.user.employeeId;
        if (!employeeId) {
            const employee = await prisma.employee.findUnique({
                where: { userId: req.user.id }
            });
            if (employee) employeeId = employee.id;
        }

        if (!employeeId) return res.status(400).json({ status: 'error', message: 'Not an employee - User ID not linked to Employee Profile' });

        const existing = await prisma.checkInAssessment.findFirst({
            where: { employeeId, status: 'PENDING' }
        });

        if (existing) {
            return res.status(400).json({ status: 'error', message: 'Assessment already in progress', assessmentId: existing.id });
        }

        const now = new Date();

        // Generate dynamic questions using AI service
        const aiQuestions = await aiService.generateCheckInQuestions({ employeeId });


        const assessmentData = {
            employeeId,
            status: 'PENDING',
            updatedAt: new Date(),
            checkinentries: {
                create: aiQuestions.map((q, idx) => {
                    return {
                        order: q.order,
                        questionType: q.type,
                        questionText: q.text,
                        unlockTime: idx === 0 ? now : new Date(now.getTime() + (idx * QUESTION_INTERVAL_MS))
                    };
                })
            }
        };

        const newAssessment = await prisma.checkInAssessment.create({
            data: assessmentData
        });

        return res.status(200).json({ status: 'success', data: { assessmentId: newAssessment.id } });

    } catch (error) {
        next(error);
    }
};

export const answerQuestion = async (req, res, next) => {
    try {
        const { entryId } = req.params;
        const { answerText, answerValue, timeToAnswer } = req.body;

        let employeeId = req.user.employeeId;
        if (!employeeId) {
            const employee = await prisma.employee.findUnique({
                where: { userId: req.user.id }
            });
            if (employee) employeeId = employee.id;
        }

        if (!employeeId) return res.status(403).json({ status: 'error', message: 'Unauthorized' });

        const entry = await prisma.checkInEntry.findUnique({
            where: { id: entryId },
            include: { checkinassessment: true }
        });

        if (!entry) return res.status(404).json({ status: 'error', message: 'Entry not found' });
        if (entry.checkinassessment.employeeId !== employeeId) return res.status(403).json({ status: 'error', message: 'Unauthorized' });
        if (entry.answeredAt) return res.status(400).json({ status: 'error', message: 'Already answered', reason: 'DUPLICATE_SUBMISSION' });

        // Validate data types to avoid Prisma errors
        const parsedValue = answerValue !== undefined && answerValue !== null ? parseInt(answerValue) : undefined;
        const parsedTime = timeToAnswer !== undefined && timeToAnswer !== null ? parseInt(timeToAnswer) : undefined;

        if (answerValue !== undefined && answerValue !== null && isNaN(parsedValue)) {
            return res.status(400).json({ status: 'error', message: 'Invalid answer value' });
        }

        // Save answer
        await prisma.checkInEntry.update({
            where: { id: entryId },
            data: {
                answerText: answerText || (answerText === '' ? '' : undefined),
                answerValue: !isNaN(parsedValue) ? parsedValue : undefined,
                timeToAnswer: !isNaN(parsedTime) ? parsedTime : undefined,
                answeredAt: new Date()
            }
        });

        // Check if this was the last question
        const allEntries = await prisma.checkInEntry.findMany({
            where: { assessmentId: entry.assessmentId }
        });

        const allAnswered = allEntries.every(e => e.id === entryId || !!e.answeredAt);

        if (allAnswered) {
            const formattedAnswers = allEntries.map(e => ({
                question: e.questionText,
                answer: e.answerText,
                value: e.answerValue
            }));

            const aiAnalysis = await aiService.analyzeDailyCheckIn(formattedAnswers);

            await prisma.checkInAssessment.update({
                where: { id: entry.assessmentId },
                data: {
                    status: 'COMPLETED',
                    score: aiAnalysis.score || 100,
                    riskLevel: aiAnalysis.riskLevel || 'STABLE',
                    recommendation: aiAnalysis.recommendation || 'شكراً لمشاركتك!',
                    updatedAt: new Date()
                }
            });
        }

        return res.status(200).json({ status: 'success', message: 'Answer recorded' });

    } catch (error) {
        next(error);
    }
};

export const getEmployeeCheckIns = async (req, res, next) => {
    try {
        const { employeeId } = req.params;

        const checkIns = await prisma.checkInAssessment.findMany({
            where: {
                employeeId,
                employee: { companyId: req.user.companyId },
                status: 'COMPLETED'
            },
            orderBy: { createdAt: 'desc' },
            take: 20 // Last 20
        });

        res.status(200).json({ status: 'success', data: checkIns });
    } catch (error) {
        next(error);
    }
};
