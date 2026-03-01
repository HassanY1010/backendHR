import prisma from '../config/db.js';
import logger from '../utils/logger.js';

export const getNotifications = async (req, res, next) => {
    try {
        let employeeId;
        const employee = await prisma.employee.findUnique({
            where: { userId: req.user.id }
        });
        employeeId = employee?.id;

        const whereCondition = employeeId
            ? { OR: [{ employeeId }, { userId: req.user.id }] }
            : { userId: req.user.id };

        const notifications = await prisma.notification.findMany({
            where: whereCondition,
            orderBy: { createdAt: 'desc' },
            take: 50
        });

        const formattedNotifications = notifications.map(notif => ({
            ...notif,
            metadata: typeof notif.metadata === 'string' ? JSON.parse(notif.metadata || '{}') : (notif.metadata || {})
        }));

        res.status(200).json({ status: 'success', data: formattedNotifications });
    } catch (error) {
        next(error);
    }
};

export const markAsRead = async (req, res, next) => {
    try {
        const { id } = req.params;
        await prisma.notification.update({
            where: { id },
            data: {
                isRead: true,
                updatedAt: new Date()
            }
        });
        res.status(200).json({ status: 'success', message: 'Notification marked as read' });
    } catch (error) {
        next(error);
    }
};

export const markAllAsRead = async (req, res, next) => {
    try {
        const employee = await prisma.employee.findUnique({
            where: { userId: req.user.id }
        });

        const whereCondition = employee
            ? { employeeId: employee.id, isRead: false }
            : { userId: req.user.id, isRead: false };

        await prisma.notification.updateMany({
            where: whereCondition,
            data: {
                isRead: true,
                updatedAt: new Date()
            }
        });
        res.status(200).json({ status: 'success', message: 'All notifications marked as read' });
    } catch (error) {
        next(error);
    }
};

export const deleteNotification = async (req, res, next) => {
    try {
        const { id } = req.params;
        await prisma.notification.delete({
            where: { id }
        });
        res.status(200).json({ status: 'success', message: 'Notification deleted' });
    } catch (error) {
        next(error);
    }
};

export const updateNotificationMetadata = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { metadata } = req.body;

        const existing = await prisma.notification.findUnique({ where: { id } });
        if (!existing) {
            return res.status(404).json({ status: 'error', message: 'Notification not found' });
        }

        const newMetadata = typeof existing.metadata === 'object' && existing.metadata !== null
            ? { ...existing.metadata, ...metadata }
            : metadata;

        await prisma.notification.update({
            where: { id },
            data: {
                metadata: typeof newMetadata === 'object' ? JSON.stringify(newMetadata) : newMetadata,
                updatedAt: new Date()
            }
        });

        res.status(200).json({ status: 'success', message: 'Notification metadata updated' });
    } catch (error) {
        next(error);
    }
};

// Helper function to create notification (not an exported route handler)
// Helper function to create notification (not an exported route handler)
export const createNotification = async (data) => {
    try {
        // 1. Resolve User ID
        let userId = data.userId;
        if (!userId && data.employeeId) {
            const employee = await prisma.employee.findUnique({
                where: { id: data.employeeId },
                select: { userId: true }
            });
            if (employee) userId = employee.userId;
        }

        if (!userId) {
            logger.warn('Notification skipped: No valid userId or employeeId provided', { data });
            return null;
        }

        // 2. Fetch User Settings
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { settings: true, email: true, name: true }
        });

        if (!user) return null;

        let settings = {};
        try {
            settings = user.settings ? JSON.parse(user.settings) : {};
        } catch (e) {
            logger.error('Failed to parse user settings', { error: e.message, userId });
        }

        const notificationSettings = settings.notifications || {}; // Default to empty if not set (implies enabled? or disabled? let's assume enabled by default if missing, or strict check)

        // 3. Check Preferences
        // Mapping 'type' to settings keys
        // type: 'recruitment' -> newApplications
        // type: 'task' (with priority/deadline intent) -> deadlineReminders
        // type: 'system' -> systemAlerts
        // type: 'info' -> systemAlerts (default)

        let shouldNotify = true;
        const type = data.type || 'info';

        if (type === 'recruitment' && notificationSettings.newApplications === false) shouldNotify = false;
        if (type === 'deadline' && notificationSettings.deadlineReminders === false) shouldNotify = false;
        if (type === 'system' && notificationSettings.systemAlerts === false) shouldNotify = false;

        // Allow 'info' or 'task' updates to pass through unless explicitly mapped? 
        // Let's treat generic 'task' updates (status change) as system alerts or dedicated category?
        // User asked for: "Deadline Reminders"
        // Let's assume generic task updates are 'systemAlerts' or separate. 
        // For now, if simply 'task', we might let it slide or check systemAlerts.

        if (!shouldNotify) {
            // console.log(`Notification suppressed by user settings: ${type} for user ${user.email}`);
            return null;
        }

        // 4. Create Notification in DB
        const result = await prisma.notification.create({
            data: {
                employeeId: data.employeeId,
                userId: userId, // Ensure userId is linked
                title: data.title,
                message: data.message,
                type: data.type || 'info',
                priority: data.priority || 'medium',
                metadata: typeof data.metadata === 'object' ? JSON.stringify(data.metadata) : (data.metadata || '{}'),
                updatedAt: new Date()
            }
        });

        // 5. Email Notification Simulation
        if (notificationSettings.emailNotifications !== false) { // Default true
            logger.info('[MOCK EMAIL]', { to: user.email, subject: data.title, body: data.message });
            // In real app: await emailService.send(...)
        }

        return result;
    } catch (error) {
        logger.error('Failed to create notification', { error: error.message, data });
    }
};
