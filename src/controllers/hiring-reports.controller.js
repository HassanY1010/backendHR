import prisma from '../config/db.js';
import logger from '../utils/logger.js';

const resolveCompanyId = async (req) => {
    let companyId = req.user?.companyId || req.user?.company?.id;
    if (!companyId) {
        const firstComp = await prisma.company.findFirst();
        companyId = firstComp?.id || null;
    }
    return companyId;
};

/**
 * GET /api/hiring-reports/summary
 * Returns comprehensive reports for the 3 Hiring Types:
 * - Immediate urgent jobs count & Fast SLA stats
 * - Annual Force Plans stats
 * - On Hold / Frozen jobs count & Freeze reason distribution
 */
export const getHiringTypesReport = async (req, res) => {
    try {
        const companyId = await resolveCompanyId(req);
        const where = companyId ? { companyId } : {};

        // 1. Immediate Jobs stats
        const immediateJobs = await prisma.jobRequest.findMany({
            where: {
                ...where,
                hiringType: 'IMMEDIATE'
            },
            select: {
                id: true,
                requestId: true,
                jobTitle: true,
                priority: true,
                requiredDate: true,
                hiringDeadline: true,
                status: true,
                createdAt: true
            }
        });

        const urgentImmediateJobsCount = immediateJobs.filter(j => j.priority === 'URGENT').length;

        // 2. Annual Force Plans stats
        const plans = await prisma.hiringPlan.findMany({
            where,
            include: { department: { select: { id: true, name: true } } }
        });

        let totalPlannedPositions = 0;
        let totalFulfilledPositions = 0;
        plans.forEach(p => {
            totalPlannedPositions += p.quantity;
            totalFulfilledPositions += p.fulfilledCount;
        });

        // 3. On Hold / Frozen Jobs stats & Freeze Reasons
        const onHoldJobs = await prisma.jobRequest.findMany({
            where: {
                ...where,
                OR: [
                    { hiringType: 'ON_HOLD' },
                    { status: 'ON_HOLD' }
                ]
            },
            include: {
                department: { select: { id: true, name: true } },
                onHoldLogs: { orderBy: { createdAt: 'desc' }, take: 1 }
            }
        });

        const freezeReasonCounts = {
            BUDGET_PENDING: 0,
            MANAGEMENT_APPROVAL: 0,
            BUSINESS_CHANGE: 0,
            OTHER: 0
        };

        const freezeReasonLabels = {
            BUDGET_PENDING: 'الميزانية قيد الانتظار (Budget Pending)',
            MANAGEMENT_APPROVAL: 'موافقة الإدارة العليا (Management Approval)',
            BUSINESS_CHANGE: 'تغيير في أهداف العمل (Business Change)',
            OTHER: 'أسباب أخرى (Other)'
        };

        onHoldJobs.forEach(job => {
            const reason = job.freezeReason || 'OTHER';
            if (freezeReasonCounts[reason] !== undefined) {
                freezeReasonCounts[reason] += 1;
            } else {
                freezeReasonCounts.OTHER += 1;
            }
        });

        const freezeReasonDistribution = Object.entries(freezeReasonCounts).map(([key, count]) => ({
            reason: key,
            labelName: freezeReasonLabels[key] || key,
            count,
            percentage: onHoldJobs.length > 0 ? Math.round((count / onHoldJobs.length) * 100) : 0
        }));

        res.json({
            success: true,
            data: {
                summary: {
                    immediateJobsCount: immediateJobs.length,
                    urgentImmediateJobsCount,
                    totalPlannedPositions,
                    totalFulfilledPositions,
                    plannedFulfillmentRate: totalPlannedPositions > 0 ? Math.round((totalFulfilledPositions / totalPlannedPositions) * 100) : 0,
                    onHoldJobsCount: onHoldJobs.length
                },
                immediateJobs: immediateJobs.slice(0, 10),
                freezeReasonDistribution,
                onHoldJobs: onHoldJobs.map(j => ({
                    id: j.id,
                    requestId: j.requestId,
                    jobTitle: j.jobTitle,
                    departmentName: j.department?.name,
                    freezeReason: j.freezeReason,
                    frozenDate: j.frozenDate || j.updatedAt,
                    resumeDate: j.resumeDate,
                    ownerName: j.ownerName
                }))
            }
        });
    } catch (error) {
        logger.error('[HiringReports] getHiringTypesReport error:', error.message);
        res.status(500).json({ success: false, message: 'فشل في تقرير أنواع التوظيف', error: error.message });
    }
};

export default {
    getHiringTypesReport
};
