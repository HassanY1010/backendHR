import { PrismaClient } from '@prisma/client';
import logger from '../utils/logger.js';
import { createRequire } from 'module';

const prisma = new PrismaClient();

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

            // Find all IN_PROGRESS / PENDING steps that are past their dueAt
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
                                    companyId: true
                                }
                            }
                        }
                    },
                    step: true,
                    assignedTo: {
                        select: { id: true, name: true, email: true, companyId: true }
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
     * Handle an SLA breach — mark overdue, log, notify, escalate
     */
    handleSLABreach: async (stepInstance) => {
        try {
            // Mark step as breached
            await prisma.workflowStepInstance.update({
                where: { id: stepInstance.id },
                data: {
                    slaBreach: true,
                    status: 'OVERDUE'
                }
            });

            // Log SLA_BREACH
            await prisma.workflowLog.create({
                data: {
                    instanceId: stepInstance.instanceId,
                    stepOrder: stepInstance.stepOrder,
                    fromStatus: stepInstance.status,
                    toStatus: 'OVERDUE',
                    action: 'SLA_BREACH',
                    comment: `تجاوز SLA للمرحلة: ${stepInstance.step?.nameAr || stepInstance.step?.name}. الوقت المتوقع: ${stepInstance.expectedDuration} ساعة`,
                    metadata: JSON.stringify({
                        stepName: stepInstance.step?.nameAr,
                        expectedHours: stepInstance.expectedDuration,
                        dueAt: stepInstance.dueAt,
                        assignedTo: stepInstance.assignedToName
                    })
                }
            });

            // Create internal notification
            if (stepInstance.assignedToId) {
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
            }

            logger.warn(`[SLA Breach] Step: ${stepInstance.step?.nameAr} | Instance: ${stepInstance.instanceId}`);
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
