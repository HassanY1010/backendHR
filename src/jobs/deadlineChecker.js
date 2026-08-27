import prisma from '../config/db.js';
import { createNotification } from '../controllers/notification.controller.js';
import logger from '../utils/logger.js';

export const runDeadlineChecker = async () => {
    try {
        const now = new Date();
        const next24Hours = new Date(now.getTime() + 24 * 60 * 60 * 1000);

        // Find tasks due in the next 24 hours that are not completed
        const tasks = await prisma.task.findMany({
            where: {
                dueDate: {
                    gte: now,
                    lte: next24Hours
                },
                status: { notIn: ['completed', 'cancelled'] }
            },
            include: {
                project: true,
                employee: { include: { user: true } }
            }
        });

        let notifiedCount = 0;
        for (const task of tasks) {
            // Determine who to notify
            const recipients = [];

            // 1. Assigned Employee
            if (task.employeeId) {
                recipients.push({
                    userId: task.employee?.userId,
                    employeeId: task.employeeId
                });
            }

            // 2. Project Manager (if different)
            if (task.project?.managerId && task.project.managerId !== task.employeeId) {
                const manager = await prisma.employee.findUnique({
                    where: { id: task.project.managerId },
                    select: { id: true, userId: true }
                });
                if (manager) {
                    recipients.push({ userId: manager.userId, employeeId: manager.id });
                }
            }

            for (const recipient of recipients) {
                const recentNotif = await prisma.notification.findFirst({
                    where: {
                        userId: recipient.userId,
                        type: 'deadline',
                        metadata: { contains: task.id },
                        createdAt: { gte: new Date(now.getTime() - 23 * 60 * 60 * 1000) }
                    }
                });

                if (!recentNotif) {
                    await createNotification({
                        userId: recipient.userId,
                        employeeId: recipient.employeeId,
                        title: 'تذكير بموعد نهائي',
                        message: `المهمة "${task.title}" تستحق التسليم قريباً (خلال 24 ساعة).`,
                        type: 'deadline',
                        priority: 'high',
                        metadata: { taskId: task.id, projectId: task.projectId }
                    });
                    notifiedCount++;
                }
            }
        }
        return { tasksChecked: tasks.length, notifiedCount };
    } catch (error) {
        logger.error('Error in Deadline Checker', { error: error.message });
        return { error: error.message };
    }
};

export const startDeadlineChecker = () => {
    const INTERVAL = 3600000;
    logger.info('Starting Deadline Checker Job...');
    runDeadlineChecker();
    setInterval(runDeadlineChecker, INTERVAL);
};
