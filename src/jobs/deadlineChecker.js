import prisma from '../config/db.js';
import { createNotification } from '../controllers/notification.controller.js';
import logger from '../utils/logger.js';

export const startDeadlineChecker = () => {
    // Run every 1 hour (3600000 ms)
    // For demo/testing purposes, we can make it more frequent if needed, but 1h is reasonable for deadlines.
    const INTERVAL = 3600000;

    logger.info('Starting Deadline Checker Job...');

    const checkDeadlines = async () => {
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

            // console.log(`[DeadlineChecker] Found ${tasks.length} tasks due soon.`);

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
                    // Need to fetch user id for manager
                    const manager = await prisma.employee.findUnique({
                        where: { id: task.project.managerId },
                        select: { id: true, userId: true }
                    });
                    if (manager) {
                        recipients.push({ userId: manager.userId, employeeId: manager.id });
                    }
                }

                for (const recipient of recipients) {
                    // Check if we already notified recently? 
                    // For simplicity, we trust the 'createNotification' logic or just send it. 
                    // To prevent spamming every hour, we might want to check a flag.
                    // But for this simplified scope, let's just send it. user settings 'deadlineReminders' will filter it.

                    // To avoid absolute spam: only send if we haven't sent a notification for this task in the last 23 hours?
                    // This requires querying notifications. 
                    const recentNotif = await prisma.notification.findFirst({
                        where: {
                            userId: recipient.userId,
                            type: 'deadline',
                            metadata: { contains: task.id }, // crude check
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
                    }
                }
            }

        } catch (error) {
            logger.error('Error in Deadline Checker', { error: error.message });
        }
    };

    // Run immediately on start
    checkDeadlines();

    // Then on interval
    setInterval(checkDeadlines, INTERVAL);
};
