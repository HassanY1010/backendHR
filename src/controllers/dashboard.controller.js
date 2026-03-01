import prisma from '../config/db.js';

export const getManagerDashboard = async (req, res, next) => {
    try {
        const companyId = req.user.companyId;

        const [totalEmployees, totalJobs, pendingAnswers] = await Promise.all([
            prisma.user.count({ where: { companyId, role: 'EMPLOYEE' } }),
            prisma.recruitmentJob.count({ where: { companyId, status: 'OPEN' } }),
            prisma.answer.count({
                where: {
                    employee: { user: { companyId } },
                    createdAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) },
                },
            }),
        ]);

        // Simple AI simulation for risk levels
        const employeesAtRisk = await prisma.employee.findMany({
            where: {
                user: { companyId },
                riskLevel: { gte: 0.7 },
            },
            include: { user: { select: { name: true, email: true } } },
        });

        res.status(200).json({
            status: 'success',
            data: {
                stats: {
                    totalEmployees,
                    activeJobs: totalJobs,
                    todayAnswers: pendingAnswers,
                    riskAlerts: employeesAtRisk.length,
                },
                employeesAtRisk,
            },
        });
    } catch (error) {
        next(error);
    }
};
