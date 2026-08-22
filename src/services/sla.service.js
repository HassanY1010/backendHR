import prisma from '../config/db.js';
import logger from '../utils/logger.js';
import { emailService } from './email.service.js';

// ============================================================================
// SLA SERVICE — Checks breaches every 15 minutes, triggers escalation
// ============================================================================

export const slaService = {
    /**
     * Check all active step instances that are overdue
     * Called by cron job every 15 minutes
     */
    checkSLABreaches: async () => {
        try {
            const now = new Date();

            // Find all IN_PROGRESS / PENDING steps that are past their dueAt and not yet marked breached
            const overdueSteps = await prisma.workflowStepInstance.findMany({
                where: {
                    status: { in: ['PENDING', 'IN_PROGRESS'] },
                    dueAt: { lt: now },
                    slaBreach: false
                },
                include: {
                    instance: {
                        include: {
                            jobRequest: {
                                select: {
                                    id: true,
                                    requestId: true,
                                    jobTitle: true,
                                    companyId: true,
                                    createdBy: true
                                }
                            }
                        }
                    },
                    step: true,
                    assignedTo: {
                        select: { id: true, name: true, email: true, companyId: true, role: true }
                    }
                }
            });

            logger.info(`[SLA Checker] Found ${overdueSteps.length} overdue steps`);

            for (const stepInst of overdueSteps) {
                await slaService.handleSLABreach(stepInst);
            }

            // Check for WARNING: steps approaching SLA (within 2 hours)
            const twoHoursFromNow = new Date(now.getTime() + 2 * 60 * 60 * 1000);
            const warnSteps = await prisma.workflowStepInstance.findMany({
                where: {
                    status: { in: ['PENDING', 'IN_PROGRESS'] },
                    dueAt: { gt: now, lt: twoHoursFromNow },
                    slaBreach: false
                },
                include: {
                    instance: { include: { jobRequest: { select: { id: true, requestId: true, jobTitle: true } } } },
                    step: true,
                    assignedTo: { select: { id: true, name: true, email: true } }
                }
            });

            for (const stepInst of warnSteps) {
                await slaService.handleSLAWarning(stepInst);
            }

            return { checked: overdueSteps.length + warnSteps.length };
        } catch (error) {
            logger.error('[SLA Checker] Error:', error.message);
        }
    },

    /**
     * Handle an SLA breach — mark overdue, log, notify, email, escalate (Idempotent)
     */
    handleSLABreach: async (stepInstance) => {
        try {
            // 1. Idempotency Check: Don't re-process if already breached
            const currentRecord = await prisma.workflowStepInstance.findUnique({
                where: { id: stepInstance.id },
                select: { slaBreach: true, status: true }
            });

            if (currentRecord?.slaBreach && currentRecord?.status === 'OVERDUE') {
                return; // Already processed, prevent duplicate alerts
            }

            const now = new Date();
            const hoursOverdue = stepInstance.dueAt
                ? Math.max(1, Math.round((now.getTime() - new Date(stepInstance.dueAt).getTime()) / (1000 * 60 * 60)))
                : 1;

            // 2. Mark step as breached & escalated
            await prisma.workflowStepInstance.update({
                where: { id: stepInstance.id },
                data: {
                    slaBreach: true,
                    status: 'OVERDUE',
                    escalated: true
                }
            });

            // 3. Log SLA_BREACH in audit trail
            await prisma.workflowLog.create({
                data: {
                    instanceId: stepInstance.instanceId,
                    stepOrder: stepInstance.stepOrder,
                    fromStatus: stepInstance.status,
                    toStatus: 'OVERDUE',
                    action: 'SLA_BREACH',
                    comment: `تجاوز SLA للمرحلة: ${stepInstance.step?.nameAr || stepInstance.step?.name}. الوقت المتوقع: ${stepInstance.expectedDuration} ساعة (${hoursOverdue} ساعة تأخير)`,
                    metadata: JSON.stringify({
                        stepName: stepInstance.step?.nameAr,
                        expectedHours: stepInstance.expectedDuration,
                        hoursOverdue,
                        dueAt: stepInstance.dueAt,
                        assignedTo: stepInstance.assignedToName
                    })
                }
            });

            const emailPayload = {
                stepName: stepInstance.step?.nameAr || stepInstance.step?.name || 'مرحلة توظيف',
                jobTitle: stepInstance.instance?.jobRequest?.jobTitle || 'طلب توظيف',
                requestId: stepInstance.instance?.jobRequest?.requestId || stepInstance.instance?.jobRequestId,
                expectedHours: stepInstance.expectedDuration || 24,
                hoursOverdue,
                isEscalation: false
            };

            // 4. In-App Notification & Email to Assignee
            if (stepInstance.assignedToId && stepInstance.assignedTo) {
                await prisma.notification.create({
                    data: {
                        userId: stepInstance.assignedToId,
                        title: `⚠️ تجاوز SLA — ${stepInstance.step?.nameAr}`,
                        message: `تجاوزت مرحلة "${stepInstance.step?.nameAr}" في طلب التوظيف الحد الزمني المحدد (${stepInstance.expectedDuration} ساعة). يرجى اتخاذ الإجراء اللازم فوراً.`,
                        type: 'warning',
                        priority: 'high',
                        metadata: JSON.stringify({
                            type: 'SLA_BREACH',
                            instanceId: stepInstance.instanceId,
                            jobRequestId: stepInstance.instance?.jobRequestId,
                            requestId: stepInstance.instance?.jobRequest?.requestId
                        }),
                        updatedAt: new Date()
                    }
                });

                if (stepInstance.assignedTo.email) {
                    await emailService.sendWorkflowSLABreachEmail(stepInstance.assignedTo, emailPayload);
                }
            }

            // 5. ESCALATION: Notify HR Managers and Company Admins
            const companyId = stepInstance.instance?.companyId || stepInstance.instance?.jobRequest?.companyId;
            if (companyId) {
                const escalationRecipients = await prisma.user.findMany({
                    where: {
                        companyId,
                        role: { in: ['HR_MANAGER', 'SUPER_ADMIN', 'CEO_EXECUTIVE'] },
                        status: 'ACTIVE',
                        id: { not: stepInstance.assignedToId || '' }
                    },
                    select: { id: true, name: true, email: true }
                });

                for (const mgr of escalationRecipients) {
                    // In-App Escalation Notification
                    await prisma.notification.create({
                        data: {
                            userId: mgr.id,
                            title: `🚨 تصعيد إداري: خرق SLA — ${stepInstance.step?.nameAr}`,
                            message: `تم تصعيد مرحلة "${stepInstance.step?.nameAr}" في طلب "${stepInstance.instance?.jobRequest?.jobTitle}" لتجاوزها الـ SLA بمقدار ${hoursOverdue} ساعة.`,
                            type: 'warning',
                            priority: 'urgent',
                            metadata: JSON.stringify({
                                type: 'SLA_ESCALATION',
                                instanceId: stepInstance.instanceId,
                                jobRequestId: stepInstance.instance?.jobRequestId,
                                stepOrder: stepInstance.stepOrder
                            }),
                            updatedAt: new Date()
                        }
                    });

                    // Escalation Email
                    if (mgr.email) {
                        await emailService.sendWorkflowSLABreachEmail(mgr, {
                            ...emailPayload,
                            isEscalation: true
                        });
                    }
                }
            }

            logger.warn(`[SLA Breach & Escalation] Step: ${stepInstance.step?.nameAr} | Instance: ${stepInstance.instanceId}`);
        } catch (error) {
            logger.error('[SLA Breach Handler] Error:', error.message);
        }
    },

    /**
     * Handle SLA warning — notify but don't mark as overdue yet
     */
    handleSLAWarning: async (stepInstance) => {
        try {
            if (stepInstance.assignedToId) {
                // Check if warning already sent
                const existingWarnLog = await prisma.workflowLog.findFirst({
                    where: {
                        instanceId: stepInstance.instanceId,
                        stepOrder: stepInstance.stepOrder,
                        action: 'SLA_WARNING'
                    }
                });

                if (existingWarnLog) return; // Prevent duplicate warnings

                await prisma.workflowLog.create({
                    data: {
                        instanceId: stepInstance.instanceId,
                        stepOrder: stepInstance.stepOrder,
                        fromStatus: stepInstance.status,
                        toStatus: stepInstance.status,
                        action: 'SLA_WARNING',
                        comment: `تحذير: اقتراب انتهاء SLA لمرحلة ${stepInstance.step?.nameAr}`
                    }
                });

                await prisma.notification.create({
                    data: {
                        userId: stepInstance.assignedToId,
                        title: `⏰ تحذير SLA — ${stepInstance.step?.nameAr}`,
                        message: `مرحلة "${stepInstance.step?.nameAr}" تقترب من انتهاء مدة SLA. تبقى أقل من ساعتين للإنجاز.`,
                        type: 'info',
                        priority: 'medium',
                        metadata: JSON.stringify({
                            type: 'SLA_WARNING',
                            instanceId: stepInstance.instanceId,
                            jobRequestId: stepInstance.instance?.jobRequestId
                        }),
                        updatedAt: new Date()
                    }
                });
            }
        } catch (error) {
            logger.error('[SLA Warning] Error:', error.message);
        }
    },

    /**
     * Calculate the actual duration in hours between two dates
     */
    calculateActualDuration: (startedAt, completedAt) => {
        if (!startedAt || !completedAt) return null;
        const ms = new Date(completedAt) - new Date(startedAt);
        return Math.round(ms / (1000 * 60 * 60)); // Convert to hours
    },

    /**
     * Compute overall SLA stats per company for dashboard
     */
    getSLAStats: async (companyId) => {
        const instances = await prisma.workflowInstance.findMany({
            where: { companyId },
            include: { stepInstances: true }
        });

        let total = 0, breaches = 0, onTime = 0;
        const stepStats = {};

        for (const inst of instances) {
            for (const step of inst.stepInstances) {
                total++;
                if (step.slaBreach) breaches++;
                else if (step.status === 'COMPLETED') onTime++;

                if (!stepStats[step.stepOrder]) {
                    stepStats[step.stepOrder] = { count: 0, totalHours: 0, breaches: 0 };
                }
                stepStats[step.stepOrder].count++;
                if (step.actualDuration) stepStats[step.stepOrder].totalHours += step.actualDuration;
                if (step.slaBreach) stepStats[step.stepOrder].breaches++;
            }
        }

        return {
            total,
            breaches,
            onTime,
            breachRate: total > 0 ? Math.round((breaches / total) * 100) : 0,
            stepStats
        };
    }
};

export default slaService;
