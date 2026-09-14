import prisma from '../config/db.js';
import { recruitmentAgentService } from '../ai/recruitment-agent.service.js';
import logger from '../utils/logger.js';

/**
 * Controller for Autonomous Recruitment AI Agent
 */

/**
 * 1. POST /api/agent/run
 * Trigger full or partial autonomous sweep
 */
export const runAgentSweep = async (req, res, next) => {
    try {
        const companyId = req.user?.companyId;
        const userId = req.user?.id;
        const { taskType } = req.body;

        if (!companyId) {
            return res.status(403).json({ status: 'error', message: 'غير مصرح: الحساب غير مرتبط بشركة' });
        }

        const sweepResult = await recruitmentAgentService.planSweep({
            companyId,
            requestedTaskType: taskType || 'ALL',
            userId
        });

        res.status(200).json({
            status: 'success',
            message: 'تم تشغيل مهام وكيل التوظيف الآلي بنجاح',
            data: sweepResult
        });
    } catch (error) {
        logger.error('[AgentController] runAgentSweep error:', error.message);
        next(error);
    }
};

/**
 * 2. GET /api/agent/tasks
 * Retrieve agent tasks for current company with status filtering
 */
export const getAgentTasks = async (req, res, next) => {
    try {
        const companyId = req.user?.companyId;
        const { status, taskType, limit = 50 } = req.query;

        if (!companyId) {
            return res.status(403).json({ status: 'error', message: 'غير مصرح: الحساب غير مرتبط بشركة' });
        }

        const where = { companyId };
        if (status) where.status = status;
        if (taskType) where.taskType = taskType;

        const tasks = await prisma.agentTask.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            take: Number(limit),
            include: {
                logs: {
                    orderBy: { timestamp: 'desc' },
                    take: 10
                }
            }
        });

        res.status(200).json({
            status: 'success',
            data: {
                tasks,
                count: tasks.length
            }
        });
    } catch (error) {
        logger.error('[AgentController] getAgentTasks error:', error.message);
        next(error);
    }
};

/**
 * 3. GET /api/agent/logs
 * Retrieve audit log of agent actions and recommendations
 */
export const getAgentLogs = async (req, res, next) => {
    try {
        const companyId = req.user?.companyId;
        const { actionStatus, limit = 100 } = req.query;

        if (!companyId) {
            return res.status(403).json({ status: 'error', message: 'غير مصرح: الحساب غير مرتبط بشركة' });
        }

        const where = { companyId };
        if (actionStatus) where.actionStatus = actionStatus;

        const logs = await prisma.agentLog.findMany({
            where,
            orderBy: { timestamp: 'desc' },
            take: Number(limit),
            include: {
                task: {
                    select: { id: true, title: true, taskType: true, status: true }
                }
            }
        });

        res.status(200).json({
            status: 'success',
            data: {
                logs,
                count: logs.length
            }
        });
    } catch (error) {
        logger.error('[AgentController] getAgentLogs error:', error.message);
        next(error);
    }
};

/**
 * 4. POST /api/agent/actions/:id/execute
 * Approve or reject an Agent recommendation with Human-in-the-loop authorization
 */
export const executeAgentAction = async (req, res, next) => {
    try {
        const companyId = req.user?.companyId;
        const userId = req.user?.id;
        const userRole = req.user?.role;
        const logId = req.params.id;
        const { decision = 'APPROVE' } = req.body;

        if (!companyId) {
            return res.status(403).json({ status: 'error', message: 'غير مصرح: الحساب غير مرتبط بشركة' });
        }

        const result = await recruitmentAgentService.executeAction({
            companyId,
            logId,
            decision,
            userId,
            userRole
        });

        res.status(200).json({
            status: 'success',
            message: decision === 'APPROVE' ? 'تم اعتماد وتنفيذ إجراء الوكيل الذكي بنجاح' : 'تم رفض الإجراء',
            data: result
        });
    } catch (error) {
        logger.error('[AgentController] executeAgentAction error:', error.message);
        next(error);
    }
};
