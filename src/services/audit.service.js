import prisma from '../config/db.js';
import logger from '../utils/logger.js';

/**
 * Audit Logging Service
 * Ensures all critical actions are immutable and trackable.
 */
export const auditService = {
    /**
     * Log a system action
     * @param {Object} params
     * @param {string} params.userId - Who performed the action (optional)
     * @param {string} params.action - Human readable action (e.g., "Deleted User")
     * @param {string} params.actionType - Category (AUTH, DATA, ADMIN)
     * @param {string} params.severity - LOW, MEDIUM, HIGH, CRITICAL
     * @param {string} params.target - ID of the object being acted upon
     * @param {string} params.status - SUCCESS, FAILURE
     * @param {Object} params.details - JSON object with extra info
     * @param {string} params.ip - IP address
     * @param {string} params.companyId - Company Context
     */
    log: async ({ userId, action, actionType, severity = 'LOW', target, status = 'SUCCESS', details, ip, companyId }) => {
        try {
            await prisma.auditLog.create({
                data: {
                    userId: userId || null,
                    action,
                    actionType,
                    severity: severity.toLowerCase(),
                    target: target || null,
                    status: status.toLowerCase(),
                    ip: ip || null,
                    details: details ? JSON.stringify(details) : null,
                    companyId: companyId || null,
                }
            });
        } catch (error) {
            logger.error('Failed to write audit log', { error: error.message });
            // In a real high-security env, we might want to crash or alert infrastructure here
        }
    }
};

/**
 * Middleware to audit log specific routes automatically
 */
export const auditRoute = (actionName, severity = 'LOW') => {
    return async (req, res, next) => {
        const originalSend = res.send;
        let logged = false;

        res.send = function (body) {
            if (!logged) {
                const isError = res.statusCode >= 400;
                auditService.log({
                    userId: req.user?.id,
                    companyId: req.user?.companyId,
                    action: actionName,
                    actionType: req.method,
                    severity: isError ? 'MEDIUM' : severity,
                    target: req.params.id || req.body.id,
                    status: isError ? 'FAILURE' : 'SUCCESS',
                    ip: req.ip,
                    details: {
                        method: req.method,
                        url: req.originalUrl,
                        admin: req.user?.role === 'SUPER_ADMIN' || req.user?.role === 'ADMIN'
                    }
                });
                logged = true;
            }
            return originalSend.apply(this, arguments);
        };
        next();
    };
};
