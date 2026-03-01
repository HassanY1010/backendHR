import prisma from '../config/db.js';
import { aiService } from '../ai/ai-service.js';

export const createProject = async (req, res, next) => {
    try {
        const { name, description, managerId, startDate, deadline, budget, priority, riskLevel } = req.body;
        const companyId = req.user.companyId;

        const project = await prisma.project.create({
            data: {
                name,
                description,
                companyId,
                managerId,
                startDate: startDate ? new Date(startDate) : null,
                deadline: deadline ? new Date(deadline) : null,
                budget: budget ? parseFloat(budget) : null,
                priority: priority || 'MEDIUM',
                riskLevel: riskLevel || 'LOW',
                status: 'PLANNING',
                updatedAt: new Date()
            },
            include: { employee: { include: { user: { select: { name: true, avatar: true } } } } }
        });

        // Map employee to manager for frontend
        const projectWithManager = { ...project, manager: project.employee };
        delete projectWithManager.employee;

        res.status(201).json({ status: 'success', data: { project: projectWithManager } });
    } catch (error) {
        next(error);
    }
};

export const getProjects = async (req, res, next) => {
    try {
        const companyId = req.user.companyId;
        const { status, managerId, search } = req.query;

        const where = { companyId };
        if (status && status !== 'all') where.status = status;
        if (managerId) where.managerId = managerId;
        if (search) {
            where.OR = [
                { name: { contains: search } },
                { description: { contains: search } }
            ];
        }

        const projects = await prisma.project.findMany({
            where,
            include: {
                employee: { include: { user: { select: { name: true, avatar: true } } } },
                tasks: { select: { status: true } },
                _count: { select: { tasks: true } }
            },
            orderBy: { createdAt: 'desc' }
        });

        const now = new Date();
        const stats = {
            total: projects.length,
            completed: projects.filter(p => p.status === 'COMPLETED').length,
            planning: projects.filter(p => p.status === 'PLANNING').length,
            delayed: projects.filter(p => p.status === 'ACTIVE' && p.deadline && new Date(p.deadline) < now).length
        };

        // Calculate progress for each project
        const projectsWithProgress = projects.map(p => {
            const totalTasks = p._count.tasks;
            const completedTasks = p.tasks.filter(t => t.status === 'completed').length;
            const progress = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
            const { tasks, employee, ...rest } = p;
            return { ...rest, progress, completedTasks, totalTasks, manager: employee };
        });

        res.status(200).json({ status: 'success', data: { projects: projectsWithProgress, stats } });
    } catch (error) {
        next(error);
    }
};

export const getProject = async (req, res, next) => {
    try {
        const project = await prisma.project.findUnique({
            where: { id: req.params.id },
            include: {
                employee: { include: { user: { select: { name: true, avatar: true } } } },
                tasks: {
                    include: {
                        employee: { select: { id: true, user: { select: { name: true, avatar: true } } } }
                    },
                    orderBy: { createdAt: 'desc' }
                }
            }
        });

        if (!project || project.companyId !== req.user.companyId) {
            const error = new Error('Project not found');
            error.statusCode = 404;
            throw error;
        }

        // Calculate progress
        const totalTasks = project.tasks.length;
        const completedTasks = project.tasks.filter(t => t.status === 'completed').length;
        const progress = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

        res.status(200).json({ status: 'success', data: { project: { ...project, progress, completedTasks, totalTasks, manager: project.employee } } });
    } catch (error) {
        next(error);
    }
};

export const updateProject = async (req, res, next) => {
    try {
        const { startDate, deadline, budget, ...otherData } = req.body;

        const updateData = { ...otherData };
        if (startDate) updateData.startDate = new Date(startDate);
        if (deadline) updateData.deadline = new Date(deadline);
        if (budget) updateData.budget = parseFloat(budget);

        const project = await prisma.project.update({
            where: { id: req.params.id },
            data: {
                ...updateData,
                updatedAt: new Date()
            },
            include: { employee: { include: { user: { select: { name: true, avatar: true } } } } }
        });

        // Map employee to manager
        const projectWithManager = { ...project, manager: project.employee };
        delete projectWithManager.employee;

        res.status(200).json({ status: 'success', data: { project: projectWithManager } });
    } catch (error) {
        next(error);
    }
};

export const deleteProject = async (req, res, next) => {
    try {
        const { id } = req.params;

        // Verify project belongs to company before deletion
        const project = await prisma.project.findFirst({
            where: {
                id,
                companyId: req.user.companyId
            }
        });

        if (!project) {
            return res.status(404).json({ status: 'error', message: 'Project not found or unauthorized' });
        }

        await prisma.project.delete({ where: { id } });
        res.status(204).json({ status: 'success', data: null });
    } catch (error) {
        next(error);
    }
};

export const generateAiRiskAnalysis = async (req, res, next) => {
    try {
        const project = await prisma.project.findUnique({
            where: { id: req.params.id },
            include: { tasks: { include: { employee: { include: { user: true } } } } }
        });

        if (!project) return next(new Error('Project not found'));

        // Prepare data for AI
        const projectData = {
            name: project.name,
            description: project.description,
            status: project.status,
            priority: project.priority,
            deadline: project.deadline,
            budget: project.budget,
            progress: project.progress, // Note: controller doesn't have progress yet, we can calculate it
            tasks: project.tasks.map(t => ({
                title: t.title,
                status: t.status,
                priority: t.priority,
                assignee: t.employee?.user.name
            }))
        };

        const analysis = await aiService.calculateProjectRisk(projectData);

        const updatedProject = await prisma.project.update({
            where: { id: project.id },
            data: {
                riskLevel: analysis.riskLevel,
                aiRecommendation: analysis.analysis, // aiService returns 'analysis' for the string
                updatedAt: new Date()
            }
        });

        res.status(200).json({ status: 'success', data: { analysis, project: updatedProject } });
    } catch (error) {
        next(error);
    }
};
