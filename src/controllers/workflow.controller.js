import { PrismaClient } from '@prisma/client';
import logger from '../utils/logger.js';
import slaService from '../services/sla.service.js';

const prisma = new PrismaClient();

// ============================================================
// DEFAULT WORKFLOW STEPS (7 stages with SLA)
// ============================================================
const DEFAULT_STEPS = [
    { stepOrder: 1, name: 'Job Request Created',   nameAr: 'إنشاء طلب التوظيف',    role: 'HIRING_MANAGER', slaDurationHours: 24 },
    { stepOrder: 2, name: 'HR Review',             nameAr: 'مراجعة HR',             role: 'HR_MANAGER',     slaDurationHours: 48 },
    { stepOrder: 3, name: 'Approval',              nameAr: 'الموافقة الإدارية',       role: 'MANAGEMENT',     slaDurationHours: 72 },
    { stepOrder: 4, name: 'Candidate Search',      nameAr: 'البحث عن المرشحين',      role: 'RECRUITER',      slaDurationHours: 168 },
    { stepOrder: 5, name: 'Interview Process',     nameAr: 'عملية المقابلات',         role: 'RECRUITER',      slaDurationHours: 240 },
    { stepOrder: 6, name: 'Offer Stage',           nameAr: 'مرحلة العرض',            role: 'HR_MANAGER',     slaDurationHours: 72 },
    { stepOrder: 7, name: 'Hiring Completed',      nameAr: 'اكتمال التعيين',          role: 'HR_MANAGER',     slaDurationHours: 24 },
];

// ============================================================
// HELPER: Get or create default template for a company
// ============================================================
const getOrCreateDefaultTemplate = async (companyId) => {
    let template = await prisma.workflowTemplate.findFirst({
        where: { companyId, isDefault: true, isActive: true },
        include: { steps: { orderBy: { stepOrder: 'asc' } } }
    });

    if (!template) {
        template = await prisma.workflowTemplate.create({
            data: {
                name: 'Default Recruitment Workflow',
                nameAr: 'مسار التوظيف الافتراضي',
                description: 'Standard 7-stage recruitment workflow with SLA tracking',
                companyId,
                isDefault: true,
                isActive: true,
                steps: {
                    create: DEFAULT_STEPS
                }
            },
            include: { steps: { orderBy: { stepOrder: 'asc' } } }
        });
        logger.info(`[Workflow] Created default template for company ${companyId}`);
    }

    return template;
};

// ============================================================
// CONTROLLER METHODS
// ============================================================

/**
 * GET /api/workflow/templates
 * List all templates for the company
 */
export const getTemplates = async (req, res) => {
    try {
        const companyId = req.user?.companyId;
        const templates = await prisma.workflowTemplate.findMany({
            where: { companyId, isActive: true },
            include: {
                steps: { orderBy: { stepOrder: 'asc' } },
                _count: { select: { instances: true } }
            },
            orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }]
        });

        // Ensure there's always a default
        if (templates.length === 0) {
            const defaultTemplate = await getOrCreateDefaultTemplate(companyId);
            return res.json({ success: true, data: [defaultTemplate] });
        }

        res.json({ success: true, data: templates });
    } catch (error) {
        logger.error('[Workflow] getTemplates error:', error.message);
        res.status(500).json({ success: false, message: 'فشل في جلب القوالب', error: error.message });
    }
};

/**
 * POST /api/workflow/templates
 * Create a new workflow template
 */
export const createTemplate = async (req, res) => {
    try {
        const companyId = req.user?.companyId;
        const { name, nameAr, description, steps, isDefault } = req.body;

        if (!name || !nameAr || !steps || steps.length === 0) {
            return res.status(400).json({ success: false, message: 'يرجى تقديم الاسم والخطوات' });
        }

        // If setting as default, unset other defaults
        if (isDefault) {
            await prisma.workflowTemplate.updateMany({
                where: { companyId, isDefault: true },
                data: { isDefault: false }
            });
        }

        const template = await prisma.workflowTemplate.create({
            data: {
                name,
                nameAr,
                description,
                companyId,
                isDefault: isDefault || false,
                steps: {
                    create: steps.map((s, idx) => ({
                        stepOrder: s.stepOrder || idx + 1,
                        name: s.name,
                        nameAr: s.nameAr,
                        description: s.description,
                        role: s.role || 'HR_MANAGER',
                        slaDurationHours: s.slaDurationHours || 48,
                        isRequired: s.isRequired !== false,
                        allowSkip: s.allowSkip || false
                    }))
                }
            },
            include: { steps: { orderBy: { stepOrder: 'asc' } } }
        });

        res.status(201).json({ success: true, data: template, message: 'تم إنشاء القالب بنجاح' });
    } catch (error) {
        logger.error('[Workflow] createTemplate error:', error.message);
        res.status(500).json({ success: false, message: 'فشل في إنشاء القالب', error: error.message });
    }
};

/**
 * PUT /api/workflow/templates/:id
 * Update a template and its steps
 */
export const updateTemplate = async (req, res) => {
    try {
        const companyId = req.user?.companyId;
        const { id } = req.params;
        const { name, nameAr, description, steps, isDefault } = req.body;

        const existing = await prisma.workflowTemplate.findFirst({ where: { id, companyId } });
        if (!existing) return res.status(404).json({ success: false, message: 'القالب غير موجود' });

        if (isDefault) {
            await prisma.workflowTemplate.updateMany({
                where: { companyId, isDefault: true, id: { not: id } },
                data: { isDefault: false }
            });
        }

        // Delete old steps and recreate
        await prisma.workflowStep.deleteMany({ where: { templateId: id } });

        const updated = await prisma.workflowTemplate.update({
            where: { id },
            data: {
                name,
                nameAr,
                description,
                isDefault: isDefault || false,
                steps: steps ? {
                    create: steps.map((s, idx) => ({
                        stepOrder: s.stepOrder || idx + 1,
                        name: s.name,
                        nameAr: s.nameAr,
                        description: s.description,
                        role: s.role || 'HR_MANAGER',
                        slaDurationHours: s.slaDurationHours || 48,
                        isRequired: s.isRequired !== false,
                        allowSkip: s.allowSkip || false
                    }))
                } : undefined
            },
            include: { steps: { orderBy: { stepOrder: 'asc' } } }
        });

        res.json({ success: true, data: updated, message: 'تم تحديث القالب بنجاح' });
    } catch (error) {
        logger.error('[Workflow] updateTemplate error:', error.message);
        res.status(500).json({ success: false, message: 'فشل في تحديث القالب', error: error.message });
    }
};

/**
 * POST /api/workflow/instance/init/:jobRequestId
 * Initialize a workflow instance for a job request (called on job request creation)
 */
export const initWorkflowInstance = async (companyId, jobRequestId, performedBy, performerName) => {
    try {
        // Check if instance already exists
        const existing = await prisma.workflowInstance.findUnique({ where: { jobRequestId } });
        if (existing) return existing;

        const template = await getOrCreateDefaultTemplate(companyId);
        const now = new Date();

        // Create instance and all step instances
        const instance = await prisma.workflowInstance.create({
            data: {
                templateId: template.id,
                jobRequestId,
                companyId,
                currentStep: 1,
                status: 'ACTIVE',
                stepInstances: {
                    create: template.steps.map((step) => {
                        const stepStart = step.stepOrder === 1 ? now : null;
                        const stepDue = step.stepOrder === 1
                            ? new Date(now.getTime() + step.slaDurationHours * 60 * 60 * 1000)
                            : null;
                        return {
                            stepId: step.id,
                            stepOrder: step.stepOrder,
                            status: step.stepOrder === 1 ? 'IN_PROGRESS' : 'PENDING',
                            expectedDuration: step.slaDurationHours,
                            startedAt: stepStart,
                            dueAt: stepDue
                        };
                    })
                }
            },
            include: { stepInstances: { orderBy: { stepOrder: 'asc' } } }
        });

        // Log creation
        await prisma.workflowLog.create({
            data: {
                instanceId: instance.id,
                stepOrder: 1,
                toStep: template.steps[0]?.nameAr || 'المرحلة الأولى',
                toStatus: 'IN_PROGRESS',
                performedBy,
                performedByName: performerName,
                action: 'CREATED',
                comment: 'تم إنشاء مسار التوظيف تلقائياً'
            }
        });

        logger.info(`[Workflow] Instance created for JobRequest ${jobRequestId}`);
        return instance;
    } catch (error) {
        logger.error('[Workflow] initWorkflowInstance error:', error.message);
        // Don't throw — workflow creation failure shouldn't block job request creation
        return null;
    }
};

/**
 * GET /api/workflow/instance/:jobRequestId
 * Get the workflow instance for a job request
 */
export const getWorkflowInstance = async (req, res) => {
    try {
        const companyId = req.user?.companyId;
        const { jobRequestId } = req.params;

        const instance = await prisma.workflowInstance.findUnique({
            where: { jobRequestId },
            include: {
                template: { include: { steps: { orderBy: { stepOrder: 'asc' } } } },
                stepInstances: {
                    include: { assignedTo: { select: { id: true, name: true, email: true, avatar: true } } },
                    orderBy: { stepOrder: 'asc' }
                },
                logs: {
                    include: { performer: { select: { id: true, name: true, avatar: true } } },
                    orderBy: { createdAt: 'desc' },
                    take: 50
                },
                jobRequest: {
                    select: { id: true, requestId: true, jobTitle: true, status: true, priority: true, createdAt: true }
                }
            }
        });

        if (!instance) {
            // Auto-create if doesn't exist
            const jobRequest = await prisma.jobRequest.findFirst({ where: { id: jobRequestId, companyId } });
            if (!jobRequest) return res.status(404).json({ success: false, message: 'طلب التوظيف غير موجود' });

            const newInstance = await initWorkflowInstance(companyId, jobRequestId, req.user?.id, req.user?.name);
            return res.json({ success: true, data: newInstance });
        }

        // Compute progress percentage
        const totalSteps = instance.stepInstances.length;
        const completedSteps = instance.stepInstances.filter(s => s.status === 'COMPLETED').length;
        const progressPercent = totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0;

        res.json({
            success: true,
            data: {
                ...instance,
                progressPercent,
                totalSteps,
                completedSteps
            }
        });
    } catch (error) {
        logger.error('[Workflow] getWorkflowInstance error:', error.message);
        res.status(500).json({ success: false, message: 'فشل في جلب مسار التوظيف', error: error.message });
    }
};

/**
 * POST /api/workflow/instance/:jobRequestId/advance
 * Advance to the next step
 */
export const advanceStep = async (req, res) => {
    try {
        const companyId = req.user?.companyId;
        const { jobRequestId } = req.params;
        const { comment, notes, assignedToId } = req.body;

        const instance = await prisma.workflowInstance.findUnique({
            where: { jobRequestId },
            include: {
                template: { include: { steps: { orderBy: { stepOrder: 'asc' } } } },
                stepInstances: { orderBy: { stepOrder: 'asc' } }
            }
        });

        if (!instance) return res.status(404).json({ success: false, message: 'مسار التوظيف غير موجود' });
        if (instance.status !== 'ACTIVE') return res.status(400).json({ success: false, message: 'المسار غير نشط' });

        const currentStepInst = instance.stepInstances.find(s => s.stepOrder === instance.currentStep);
        if (!currentStepInst) return res.status(400).json({ success: false, message: 'المرحلة الحالية غير موجودة' });

        const now = new Date();
        const nextStepOrder = instance.currentStep + 1;
        const nextStep = instance.template.steps.find(s => s.stepOrder === nextStepOrder);
        const currentStep = instance.template.steps.find(s => s.stepOrder === instance.currentStep);

        // Complete current step
        const actualDuration = slaService.calculateActualDuration(currentStepInst.startedAt, now);
        await prisma.workflowStepInstance.update({
            where: { id: currentStepInst.id },
            data: {
                status: 'COMPLETED',
                completedAt: now,
                actualDuration,
                notes: notes || currentStepInst.notes
            }
        });

        // Is this the last step?
        const isLastStep = !nextStep;

        if (isLastStep) {
            // Complete the whole instance
            await prisma.workflowInstance.update({
                where: { id: instance.id },
                data: { status: 'COMPLETED', completedAt: now }
            });

            await prisma.workflowLog.create({
                data: {
                    instanceId: instance.id,
                    stepOrder: instance.currentStep,
                    fromStep: currentStep?.nameAr,
                    fromStatus: 'IN_PROGRESS',
                    toStatus: 'COMPLETED',
                    performedBy: req.user?.id,
                    performedByName: req.user?.name,
                    action: 'COMPLETED',
                    comment: comment || 'اكتمل مسار التوظيف بنجاح'
                }
            });

            return res.json({ success: true, message: 'تم إنجاز مسار التوظيف كاملاً 🎉', data: { completed: true } });
        }

        // Activate next step
        const nextStepInst = instance.stepInstances.find(s => s.stepOrder === nextStepOrder);
        const nextDueAt = new Date(now.getTime() + (nextStep.slaDurationHours * 60 * 60 * 1000));

        await prisma.workflowStepInstance.update({
            where: { id: nextStepInst.id },
            data: {
                status: 'IN_PROGRESS',
                startedAt: now,
                dueAt: nextDueAt,
                assignedToId: assignedToId || null
            }
        });

        // Advance instance current step
        await prisma.workflowInstance.update({
            where: { id: instance.id },
            data: { currentStep: nextStepOrder }
        });

        // Log the advance
        await prisma.workflowLog.create({
            data: {
                instanceId: instance.id,
                stepOrder: nextStepOrder,
                fromStep: currentStep?.nameAr,
                toStep: nextStep.nameAr,
                fromStatus: 'IN_PROGRESS',
                toStatus: 'IN_PROGRESS',
                performedBy: req.user?.id,
                performedByName: req.user?.name,
                action: 'ADVANCED',
                comment: comment || `انتقل من "${currentStep?.nameAr}" إلى "${nextStep.nameAr}"`
            }
        });

        // Notify assigned user for next step
        if (assignedToId) {
            await prisma.notification.create({
                data: {
                    userId: assignedToId,
                    title: `📋 مهمة جديدة — ${nextStep.nameAr}`,
                    message: `تم تكليفك بمرحلة "${nextStep.nameAr}" في مسار التوظيف. مدة SLA المحددة: ${nextStep.slaDurationHours} ساعة.`,
                    type: 'info',
                    priority: 'medium',
                    metadata: JSON.stringify({ type: 'WORKFLOW_STEP', instanceId: instance.id, jobRequestId }),
                    updatedAt: new Date()
                }
            });
        }

        res.json({
            success: true,
            message: `تم الانتقال إلى "${nextStep.nameAr}" بنجاح`,
            data: { nextStep: nextStep.nameAr, nextStepOrder, dueAt: nextDueAt }
        });
    } catch (error) {
        logger.error('[Workflow] advanceStep error:', error.message);
        res.status(500).json({ success: false, message: 'فشل في تقديم المرحلة', error: error.message });
    }
};

/**
 * POST /api/workflow/instance/:jobRequestId/reject
 * Reject the current step with a reason
 */
export const rejectStep = async (req, res) => {
    try {
        const { jobRequestId } = req.params;
        const { reason, comment } = req.body;

        const instance = await prisma.workflowInstance.findUnique({
            where: { jobRequestId },
            include: {
                template: { include: { steps: true } },
                stepInstances: { orderBy: { stepOrder: 'asc' } }
            }
        });

        if (!instance) return res.status(404).json({ success: false, message: 'مسار التوظيف غير موجود' });

        const currentStepInst = instance.stepInstances.find(s => s.stepOrder === instance.currentStep);
        const currentStep = instance.template.steps.find(s => s.stepOrder === instance.currentStep);

        await prisma.workflowStepInstance.update({
            where: { id: currentStepInst.id },
            data: {
                status: 'REJECTED',
                completedAt: new Date(),
                delayReason: reason
            }
        });

        await prisma.workflowInstance.update({
            where: { id: instance.id },
            data: { status: 'CANCELLED' }
        });

        await prisma.workflowLog.create({
            data: {
                instanceId: instance.id,
                stepOrder: instance.currentStep,
                fromStep: currentStep?.nameAr,
                fromStatus: 'IN_PROGRESS',
                toStatus: 'REJECTED',
                performedBy: req.user?.id,
                performedByName: req.user?.name,
                action: 'REJECTED',
                comment: comment || reason || 'تم رفض المرحلة'
            }
        });

        res.json({ success: true, message: 'تم رفض المرحلة وإغلاق المسار' });
    } catch (error) {
        logger.error('[Workflow] rejectStep error:', error.message);
        res.status(500).json({ success: false, message: 'فشل في رفض المرحلة', error: error.message });
    }
};

/**
 * POST /api/workflow/instance/:jobRequestId/comment
 * Add a comment to the current step
 */
export const addComment = async (req, res) => {
    try {
        const { jobRequestId } = req.params;
        const { comment } = req.body;

        const instance = await prisma.workflowInstance.findUnique({ where: { jobRequestId } });
        if (!instance) return res.status(404).json({ success: false, message: 'مسار التوظيف غير موجود' });

        await prisma.workflowLog.create({
            data: {
                instanceId: instance.id,
                stepOrder: instance.currentStep,
                performedBy: req.user?.id,
                performedByName: req.user?.name,
                action: 'COMMENT_ADDED',
                comment
            }
        });

        res.json({ success: true, message: 'تم إضافة التعليق' });
    } catch (error) {
        res.status(500).json({ success: false, message: 'فشل في إضافة التعليق', error: error.message });
    }
};

/**
 * GET /api/workflow/dashboard
 * Overall workflow stats for the company
 */
export const getWorkflowDashboard = async (req, res) => {
    try {
        const companyId = req.user?.companyId;

        const [totalInstances, activeInstances, completedInstances, slaBreachInstances, stepInstances] = await Promise.all([
            prisma.workflowInstance.count({ where: { companyId } }),
            prisma.workflowInstance.count({ where: { companyId, status: 'ACTIVE' } }),
            prisma.workflowInstance.count({ where: { companyId, status: 'COMPLETED' } }),
            prisma.workflowStepInstance.count({ where: { instance: { companyId }, slaBreach: true } }),
            prisma.workflowStepInstance.findMany({
                where: { instance: { companyId } },
                include: { step: true }
            })
        ]);

        // Average duration per step
        const stepStats = {};
        for (const si of stepInstances) {
            const key = si.step?.nameAr || `Step ${si.stepOrder}`;
            if (!stepStats[key]) stepStats[key] = { total: 0, sumHours: 0, breaches: 0, completed: 0 };
            stepStats[key].total++;
            if (si.actualDuration) { stepStats[key].sumHours += si.actualDuration; stepStats[key].completed++; }
            if (si.slaBreach) stepStats[key].breaches++;
        }

        const stepSummary = Object.entries(stepStats).map(([name, s]) => ({
            name,
            avgHours: s.completed > 0 ? Math.round(s.sumHours / s.completed) : 0,
            breaches: s.breaches,
            total: s.total
        }));

        // Recent SLA breaches
        const recentBreaches = await prisma.workflowStepInstance.findMany({
            where: { instance: { companyId }, slaBreach: true },
            include: {
                step: true,
                instance: { include: { jobRequest: { select: { requestId: true, jobTitle: true } } } }
            },
            orderBy: { updatedAt: 'desc' },
            take: 10
        });

        // Bottleneck: step with most overdue
        const bottleneck = stepSummary.sort((a, b) => b.breaches - a.breaches)[0];

        res.json({
            success: true,
            data: {
                kpis: {
                    totalInstances,
                    activeInstances,
                    completedInstances,
                    cancelledInstances: totalInstances - activeInstances - completedInstances,
                    slaBreachCount: slaBreachInstances,
                    completionRate: totalInstances > 0 ? Math.round((completedInstances / totalInstances) * 100) : 0
                },
                stepSummary,
                recentBreaches,
                bottleneck
            }
        });
    } catch (error) {
        logger.error('[Workflow] getWorkflowDashboard error:', error.message);
        res.status(500).json({ success: false, message: 'فشل في جلب إحصاءات الـ Workflow', error: error.message });
    }
};

/**
 * GET /api/workflow/sla-breaches
 * All active SLA breaches for the company
 */
export const getSLABreaches = async (req, res) => {
    try {
        const companyId = req.user?.companyId;

        const breaches = await prisma.workflowStepInstance.findMany({
            where: {
                instance: { companyId },
                slaBreach: true
            },
            include: {
                step: true,
                instance: {
                    include: {
                        jobRequest: { select: { id: true, requestId: true, jobTitle: true, priority: true, status: true } }
                    }
                },
                assignedTo: { select: { id: true, name: true, avatar: true } }
            },
            orderBy: { dueAt: 'asc' },
            take: 50
        });

        const formatted = breaches.map(b => ({
            id: b.id,
            stepName: b.step?.nameAr || 'غير معروف',
            stepOrder: b.stepOrder,
            jobTitle: b.instance?.jobRequest?.jobTitle,
            requestId: b.instance?.jobRequest?.requestId,
            jobRequestId: b.instance?.jobRequest?.id,
            priority: b.instance?.jobRequest?.priority,
            assignedTo: b.assignedTo,
            expectedHours: b.expectedDuration,
            dueAt: b.dueAt,
            hoursOverdue: b.dueAt
                ? Math.round((Date.now() - new Date(b.dueAt).getTime()) / (1000 * 60 * 60))
                : null,
            escalated: b.escalated
        }));

        res.json({ success: true, data: formatted, total: formatted.length });
    } catch (error) {
        logger.error('[Workflow] getSLABreaches error:', error.message);
        res.status(500).json({ success: false, message: 'فشل في جلب خروقات SLA', error: error.message });
    }
};

/**
 * GET /api/workflow/logs/:jobRequestId
 * Get audit log for a job request's workflow
 */
export const getWorkflowLogs = async (req, res) => {
    try {
        const { jobRequestId } = req.params;
        const instance = await prisma.workflowInstance.findUnique({
            where: { jobRequestId },
            include: {
                logs: {
                    include: { performer: { select: { id: true, name: true, avatar: true } } },
                    orderBy: { createdAt: 'desc' }
                }
            }
        });

        if (!instance) return res.status(404).json({ success: false, message: 'مسار التوظيف غير موجود' });

        res.json({ success: true, data: instance.logs });
    } catch (error) {
        res.status(500).json({ success: false, message: 'فشل في جلب السجل', error: error.message });
    }
};

export default {
    getTemplates,
    createTemplate,
    updateTemplate,
    initWorkflowInstance,
    getWorkflowInstance,
    advanceStep,
    rejectStep,
    addComment,
    getWorkflowDashboard,
    getSLABreaches,
    getWorkflowLogs
};
