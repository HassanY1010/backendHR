import prisma from '../config/db.js';
import { createNotification } from './notification.controller.js';
import { SearchService } from '../services/search.service.js';
import logger from '../utils/logger.js';

export const createTask = async (req, res, next) => {
    try {
        const { title, description, projectId, employeeId, priority, dueDate, estimatedTime, attachments } = req.body;

        // Verify project and employee belong to the same company
        const project = await prisma.project.findFirst({
            where: { id: projectId, companyId: req.user.companyId }
        });

        if (!project) {
            return res.status(403).json({ status: 'error', message: 'Unauthorized project access' });
        }

        if (employeeId) {
            const employee = await prisma.employee.findFirst({
                where: { id: employeeId, companyId: req.user.companyId }
            });
            if (!employee) {
                return res.status(403).json({ status: 'error', message: 'Unauthorized employee assignment' });
            }
        }

        const task = await prisma.task.create({
            data: {
                title,
                description,
                projectId,
                employeeId,
                priority: priority || 'MEDIUM',
                status: 'pending',
                status: 'pending',
                dueDate: dueDate ? new Date(dueDate) : null,
                estimatedTime: estimatedTime ? parseFloat(estimatedTime) : null,
                estimatedTimeUnit: req.body.estimatedTimeUnit || 'HOURS',
                attachments: attachments ? JSON.stringify(attachments) : undefined,
                updatedAt: new Date()
            },
            include: {
                employee: { select: { id: true, user: { select: { name: true, avatar: true } } } },
                project: { select: { id: true, name: true } }
            }
        });

        // Trigger notification if an employee is assigned
        if (employeeId) {
            await createNotification({
                employeeId,
                title: 'مهمة جديدة',
                message: `تم تعيين مهمة جديدة لك: "${title}" ${task.project ? `في مشروع "${task.project.name}"` : ''}`,
                type: 'task',
                priority: (priority || 'MEDIUM').toLowerCase(),
                metadata: { taskId: task.id, projectId: task.projectId }
            });
        }

        // Smart Search Indexing
        try {
            const indexContent = `Task: ${title}. Description: ${description || ''}. Priority: ${task.priority}. Project: ${task.project?.name || ''}.`;
            await SearchService.indexDocument({
                companyId: req.user.companyId,
                documentId: task.id,
                documentType: 'TASK',
                content: indexContent,
                metadata: { title: task.title, status: task.status }
            });
        } catch (idxError) {
            logger.error('Indexing failed for task', { taskId: task.id, error: idxError.message });
        }

        res.status(201).json({ status: 'success', data: { task } });
    } catch (error) {
        next(error);
    }
};

export const getTasks = async (req, res, next) => {
    try {
        const companyId = req.user.companyId;
        const { projectId, employeeId, status, search } = req.query;

        const where = {};

        // If getting tasks for a specific project, verify project belongs to company
        if (projectId) {
            where.projectId = projectId;
        } else {
            // Otherwise, get all tasks for projects in this company
            where.project = { companyId };
        }

        if (employeeId) where.employeeId = employeeId;
        if (status && status !== 'all') where.status = status;
        if (search) {
            where.OR = [
                { title: { contains: search } },
                { description: { contains: search } }
            ];
        }

        const tasks = await prisma.task.findMany({
            where,
            include: {
                employee: { select: { id: true, user: { select: { name: true, avatar: true } } } },
                project: { select: { name: true } }
            },
            orderBy: { createdAt: 'desc' }
        });

        const formattedTasks = tasks.map(t => ({
            ...t,
            attachments: typeof t.attachments === 'string' ? JSON.parse(t.attachments || '[]') : (t.attachments || [])
        }));

        res.status(200).json({ status: 'success', data: { tasks: formattedTasks } });
    } catch (error) {
        next(error);
    }
};

export const getTask = async (req, res, next) => {
    try {
        const task = await prisma.task.findFirst({
            where: {
                id: req.params.id,
                project: { companyId: req.user.companyId }
            },
            include: {
                employee: { select: { id: true, user: { select: { name: true, avatar: true } } } },
                project: { select: { id: true, name: true, managerId: true } }
            }
        });

        if (!task) {
            const error = new Error('Task not found');
            error.statusCode = 404;
            throw error;
        }

        const formattedTask = {
            ...task,
            attachments: typeof task.attachments === 'string' ? JSON.parse(task.attachments || '[]') : (task.attachments || [])
        };

        res.status(200).json({ status: 'success', data: { task: formattedTask } });
    } catch (error) {
        next(error);
    }
};


export const updateTask = async (req, res, next) => {
    try {
        const { title, description, status, priority, progress, dueDate, estimatedTime, estimatedTimeUnit, attachments, dependencies } = req.body;

        const updateData = {};
        if (title !== undefined) updateData.title = title;
        if (description !== undefined) updateData.description = description;
        if (status !== undefined) updateData.status = status;
        if (priority !== undefined) updateData.priority = priority;
        if (progress !== undefined) updateData.progress = parseFloat(progress);
        if (dueDate !== undefined) updateData.dueDate = new Date(dueDate);
        if (estimatedTime !== undefined) updateData.estimatedTime = parseFloat(estimatedTime);
        if (estimatedTimeUnit !== undefined) updateData.estimatedTimeUnit = estimatedTimeUnit;
        if (attachments !== undefined) updateData.attachments = JSON.stringify(attachments);
        if (dependencies !== undefined && Array.isArray(dependencies)) {
            updateData.dependencies = JSON.stringify(dependencies);
        }

        // Get existing task to check for changes and validate company access
        const existingTask = await prisma.task.findFirst({
            where: {
                id,
                project: { companyId: req.user.companyId }
            },
            include: { project: true, employee: { include: { user: true } } }
        });

        if (!existingTask) {
            const error = new Error('Task not found');
            error.statusCode = 404;
            throw error;
        }

        const task = await prisma.task.update({
            where: { id },
            data: {
                ...updateData,
                updatedAt: new Date()
            },
            include: {
                employee: { select: { id: true, user: { select: { name: true, avatar: true } } } },
                project: { select: { name: true, managerId: true } }
            }
        });

        // Notify manager if status or progress changed by employee
        if (task.project?.managerId && (req.body.status || req.body.progress !== undefined)) {
            let message = '';
            if (req.body.status && req.body.status !== existingTask.status) {
                message = `قام ${task.employee?.user?.name || 'الموظف'} بتحديث حالة المهمة "${task.title}" إلى ${req.body.status}`;
            } else if (req.body.progress !== undefined && req.body.progress !== existingTask.progress) {
                message = `قام ${task.employee?.user?.name || 'الموظف'} بتحديث نسبة إنجاز المهمة "${task.title}" إلى ${req.body.progress}%`;
            }

            if (message) {
                await createNotification({
                    employeeId: task.project.managerId,
                    title: 'تحديث في مشروع',
                    message,
                    type: 'task',
                    priority: 'medium',
                    metadata: { taskId: task.id, projectId: task.projectId }
                });
            }
        }

        const formattedTask = {
            ...task,
            attachments: typeof task.attachments === 'string' ? JSON.parse(task.attachments || '[]') : (task.attachments || [])
        };

        // Update Search Index
        try {
            const indexContent = `Task: ${task.title}. Description: ${task.description || ''}. Priority: ${task.priority}. Project: ${task.project?.name || ''}. Status: ${task.status}.`;
            await SearchService.indexDocument({
                companyId: req.user.companyId,
                documentId: task.id,
                documentType: 'TASK',
                content: indexContent,
                metadata: { title: task.title, status: task.status }
            });
        } catch (idxError) {
            logger.error('Indexing failed for task update', { taskId: task.id, error: idxError.message });
        }

        res.status(200).json({ status: 'success', data: { task: formattedTask } });
    } catch (error) {
        next(error);
    }
};

export const deleteTask = async (req, res, next) => {
    try {
        const { id } = req.params;

        // Verify task belongs to company before deletion
        const task = await prisma.task.findFirst({
            where: {
                id,
                project: { companyId: req.user.companyId }
            }
        });

        if (!task) {
            return res.status(404).json({ status: 'error', message: 'Task not found or unauthorized' });
        }

        await prisma.task.update({
            where: { id },
            data: { deletedAt: new Date() }
        });
        res.status(204).json({ status: 'success', data: null });
    } catch (error) {
        next(error);
    }
};

export const generateTasks = async (req, res, next) => {
    try {
        const { projectId, description } = req.body;

        let projectName = 'Project';
        if (projectId) {
            const project = await prisma.project.findUnique({ where: { id: projectId }, select: { name: true } });
            if (project) projectName = project.name;
        }

        const suggestions = await aiService.suggestTasks(projectName, description || 'New Task Group');

        res.status(200).json({ status: 'success', data: { suggestions } });
    } catch (error) {
        next(error);
    }
};
