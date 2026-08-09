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

const resolveDepartmentId = async (companyId, departmentIdInput) => {
    if (!companyId) return null;

    if (departmentIdInput && !departmentIdInput.startsWith('dep-')) {
        const existingById = await prisma.department.findFirst({
            where: { id: departmentIdInput, companyId }
        });
        if (existingById) return existingById.id;
    }

    const deptNameMap = {
        'dep-tech': 'تكنولوجيا المعلومات والبرمجيات',
        'dep-hr': 'الموارد البشرية',
        'dep-finance': 'الإدارة المالية',
        'dep-marketing': 'التسويق والمبيعات',
        'dep-operations': 'العمليات والتشغيل'
    };

    const targetName = deptNameMap[departmentIdInput] || departmentIdInput || 'تكنولوجيا المعلومات والبرمجيات';

    const existingByName = await prisma.department.findFirst({
        where: { companyId, name: { equals: targetName, mode: 'insensitive' } }
    });

    if (existingByName) return existingByName.id;

    const createdDep = await prisma.department.create({
        data: { name: targetName, companyId }
    });

    return createdDep.id;
};

const parseRobustDate = (dStr) => {
    if (!dStr) return new Date();
    if (typeof dStr === 'string' && dStr.includes('/')) {
        const parts = dStr.split('/');
        if (parts.length === 3) {
            if (parts[0].length === 4) { // YYYY/MM/DD
                return new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
            } else { // DD/MM/YYYY
                return new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
            }
        }
    }
    const parsed = new Date(dStr);
    return isNaN(parsed.getTime()) ? new Date() : parsed;
};

/**
 * GET /api/hiring-plans
 * Fetch all annual manpower force plans for company
 */
export const getHiringPlans = async (req, res) => {
    try {
        const companyId = await resolveCompanyId(req);
        const { year, departmentId } = req.query;

        const where = {
            ...(companyId ? { companyId } : {}),
            ...(year ? { year: parseInt(year) } : {}),
            ...(departmentId ? { departmentId } : {})
        };

        const plans = await prisma.hiringPlan.findMany({
            where,
            include: {
                department: { select: { id: true, name: true } },
                _count: { select: { jobRequests: true } }
            },
            orderBy: [{ year: 'desc' }, { createdAt: 'desc' }]
        });

        res.json({ success: true, data: plans });
    } catch (error) {
        logger.error('[HiringPlan] getHiringPlans error:', error.message);
        res.status(500).json({ success: false, message: 'فشل في جلب خطط التوظيف السنوية', error: error.message });
    }
};

/**
 * POST /api/hiring-plans
 * Create a new annual manpower force plan item
 */
export const createHiringPlan = async (req, res) => {
    try {
        const companyId = await resolveCompanyId(req);
        const { year, departmentId, position, quantity, expectedDate, budget, notes } = req.body;

        if (!position || !quantity) {
            return res.status(400).json({ success: false, message: 'يرجى تزويد المسمى الوظيفي والعدد المطلوب' });
        }

        const validDeptId = await resolveDepartmentId(companyId, departmentId);

        const plan = await prisma.hiringPlan.create({
            data: {
                companyId,
                year: parseInt(year) || 2027,
                departmentId: validDeptId,
                position,
                quantity: parseInt(quantity) || 1,
                fulfilledCount: 0,
                expectedDate: parseRobustDate(expectedDate),
                budget: parseFloat(budget) || 0,
                notes: notes || null,
                status: 'PLANNED'
            },
            include: {
                department: { select: { id: true, name: true } }
            }
        });

        res.status(201).json({ success: true, data: plan, message: 'تم إضافة البند للخطة السنوية بنجاح ✨' });
    } catch (error) {
        logger.error('[HiringPlan] createHiringPlan error:', error.message);
        res.status(500).json({ success: false, message: 'فشل في إضافة بند خطة التوظيف', error: error.message });
    }
};

/**
 * PUT /api/hiring-plans/:id
 * Update an existing annual manpower plan item
 */
export const updateHiringPlan = async (req, res) => {
    try {
        const companyId = await resolveCompanyId(req);
        const { id } = req.params;
        const { year, departmentId, position, quantity, fulfilledCount, expectedDate, budget, status, notes } = req.body;

        const existing = await prisma.hiringPlan.findFirst({
            where: { id, ...(companyId ? { companyId } : {}) }
        });

        if (!existing) {
            return res.status(404).json({ success: false, message: 'بند الخطة غير موجود' });
        }

        const validDeptId = departmentId ? await resolveDepartmentId(companyId, departmentId) : undefined;

        const updated = await prisma.hiringPlan.update({
            where: { id },
            data: {
                ...(year ? { year: parseInt(year) } : {}),
                ...(validDeptId ? { departmentId: validDeptId } : {}),
                ...(position ? { position } : {}),
                ...(quantity !== undefined ? { quantity: parseInt(quantity) } : {}),
                ...(fulfilledCount !== undefined ? { fulfilledCount: parseInt(fulfilledCount) } : {}),
                ...(expectedDate ? { expectedDate: parseRobustDate(expectedDate) } : {}),
                ...(budget !== undefined ? { budget: parseFloat(budget) } : {}),
                ...(status ? { status } : {}),
                ...(notes !== undefined ? { notes } : {})
            },
            include: {
                department: { select: { id: true, name: true } }
            }
        });

        res.json({ success: true, data: updated, message: 'تم تحديث بند الخطة السنوية بنجاح' });
    } catch (error) {
        logger.error('[HiringPlan] updateHiringPlan error:', error.message);
        res.status(500).json({ success: false, message: 'فشل في تحديث بند الخطة السنوية', error: error.message });
    }
};

/**
 * DELETE /api/hiring-plans/:id
 * Delete a manpower plan item
 */
export const deleteHiringPlan = async (req, res) => {
    try {
        const companyId = await resolveCompanyId(req);
        const { id } = req.params;

        const existing = await prisma.hiringPlan.findFirst({
            where: { id, ...(companyId ? { companyId } : {}) }
        });

        if (!existing) {
            return res.status(404).json({ success: false, message: 'بند الخطة غير موجود' });
        }

        await prisma.hiringPlan.delete({ where: { id } });

        res.json({ success: true, message: 'تم حذف بند الخطة بنجاح' });
    } catch (error) {
        logger.error('[HiringPlan] deleteHiringPlan error:', error.message);
        res.status(500).json({ success: false, message: 'فشل في حذف بند الخطة', error: error.message });
    }
};

/**
 * GET /api/hiring-plans/dashboard
 * Dashboard analytics & KPIs for Manpower Force Plan
 */
export const getManpowerDashboard = async (req, res) => {
    try {
        const companyId = await resolveCompanyId(req);
        const targetYear = parseInt(req.query.year) || new Date().getFullYear() + 1;

        const where = {
            ...(companyId ? { companyId } : {}),
            year: targetYear
        };

        const plans = await prisma.hiringPlan.findMany({
            where,
            include: {
                department: { select: { id: true, name: true } },
                jobRequests: { select: { id: true, status: true, jobTitle: true } }
            }
        });

        // 🔄 RADICAL DYNAMIC SYNC: Recalculate fulfilledCount in real-time from HIRED requests & candidates
        for (const plan of plans) {
            try {
                const [hiredRequestsCount, hiredCandidatesCount] = await Promise.all([
                    prisma.jobRequest.count({
                        where: {
                            companyId: plan.companyId,
                            status: 'HIRED',
                            deletedAt: null,
                            OR: [
                                { hiringPlanId: plan.id },
                                { jobTitle: { contains: plan.position, mode: 'insensitive' } }
                            ]
                        }
                    }),
                    prisma.candidate.count({
                        where: {
                            status: 'HIRED',
                            deletedAt: null,
                            recruitmentjob: {
                                companyId: plan.companyId,
                                title: { contains: plan.position, mode: 'insensitive' }
                            }
                        }
                    })
                ]);

                const realFulfilled = Math.max(plan.fulfilledCount, hiredRequestsCount + hiredCandidatesCount);

                if (realFulfilled !== plan.fulfilledCount) {
                    plan.fulfilledCount = realFulfilled;
                    plan.status = realFulfilled >= plan.quantity ? 'FULFILLED' : 'IN_PROGRESS';

                    await prisma.hiringPlan.update({
                        where: { id: plan.id },
                        data: {
                            fulfilledCount: realFulfilled,
                            status: plan.status
                        }
                    });
                }
            } catch (syncErr) {
                logger.error('[HiringPlan] Realtime sync error for plan:', plan.id, syncErr.message);
            }
        }

        let totalPlannedPositions = 0;
        let totalFulfilledPositions = 0;
        let totalAllocatedBudget = 0;

        const departmentStats = {};

        plans.forEach(plan => {
            totalPlannedPositions += plan.quantity;
            totalFulfilledPositions += plan.fulfilledCount;
            totalAllocatedBudget += plan.budget;

            const deptName = plan.department?.name || 'غير محدد';
            if (!departmentStats[deptName]) {
                departmentStats[deptName] = { name: deptName, planned: 0, fulfilled: 0, budget: 0, itemsCount: 0 };
            }
            departmentStats[deptName].planned += plan.quantity;
            departmentStats[deptName].fulfilled += plan.fulfilledCount;
            departmentStats[deptName].budget += plan.budget;
            departmentStats[deptName].itemsCount += 1;
        });

        const fulfillmentRate = totalPlannedPositions > 0
            ? Math.round((totalFulfilledPositions / totalPlannedPositions) * 100)
            : 0;

        res.json({
            success: true,
            data: {
                year: targetYear,
                kpis: {
                    totalPlannedPositions,
                    totalFulfilledPositions,
                    remainingPositions: Math.max(0, totalPlannedPositions - totalFulfilledPositions),
                    fulfillmentRate,
                    totalAllocatedBudget,
                    totalPlanItems: plans.length
                },
                departmentBreakdown: Object.values(departmentStats),
                plans
            }
        });
    } catch (error) {
        logger.error('[HiringPlan] getManpowerDashboard error:', error.message);
        res.status(500).json({ success: false, message: 'فشل في جلب إحصائيات خطة التوظيف', error: error.message });
    }
};

export default {
    getHiringPlans,
    createHiringPlan,
    updateHiringPlan,
    deleteHiringPlan,
    getManpowerDashboard
};
