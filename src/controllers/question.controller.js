import prisma from '../config/db.js';

export const getDailyQuestions = async (req, res, next) => {
    try {
        const questions = await prisma.dailyQuestion.findMany({
            where: { companyId: req.user.companyId },
        });

        res.status(200).json({ status: 'success', data: { questions } });
    } catch (error) {
        next(error);
    }
};

export const submitAnswer = async (req, res, next) => {
    try {
        const { questionId, content } = req.body;

        // Ensure user has an employee profile
        const employee = await prisma.employee.findUnique({
            where: { userId: req.user.id },
        });

        if (!employee) {
            const error = new Error('Employee profile not found');
            error.statusCode = 404;
            throw error;
        }

        const answer = await prisma.answer.create({
            data: {
                content,
                questionId,
                employeeId: employee.id,
            },
        });

        res.status(201).json({ status: 'success', data: { answer } });
    } catch (error) {
        next(error);
    }
};

export const createQuestion = async (req, res, next) => {
    try {
        const { question, type } = req.body;

        const newQuestion = await prisma.dailyQuestion.create({
            data: {
                question,
                type: type || 'TEXT',
                companyId: req.user.companyId,
            },
        });

        res.status(201).json({ status: 'success', data: { question: newQuestion } });
    } catch (error) {
        next(error);
    }
};
