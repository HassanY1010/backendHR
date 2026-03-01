import prisma from '../config/db.js';

export const getAlerts = async (req, res, next) => {
    try {
        const { companyId } = req.query; // Or from req.user
        // Assuming alerts are just employees with high risk for now, 
        // OR we need a dedicated Alert model? 
        // The service expects RiskAlert[] which has id, employeeId, level, status, etc.
        // We can fetch Employees with high risk level.

        // Alternatively, if we need a real Alert system, we should have a model.
        // For now, let's look for employees with risk > 0.7

        const highRiskEmployees = await prisma.employee.findMany({
            where: {
                riskLevel: { gt: 0.5 },
                user: { companyId: companyId || req.user.companyId }
            },
            include: { user: true }
        });

        // Map to RiskAlert shape
        const alerts = highRiskEmployees.map(emp => ({
            id: 'alert-' + emp.id, // Virtual ID
            employeeId: emp.id,
            employeeName: emp.user.name,
            level: emp.riskLevel > 0.8 ? 'HIGH' : 'MEDIUM',
            status: 'OPEN', // No DB persistence for status yet
            message: `High risk detected: ${emp.riskLevel}`,
            createdAt: new Date().toISOString()
        }));

        res.status(200).json({ status: 'success', data: alerts });
    } catch (error) {
        next(error);
    }
};

export const acknowledgeAlert = async (req, res, next) => {
    // Virtual acknowledgement since we don't have Alert model
    res.status(200).json({ status: 'success', data: { status: 'ACKNOWLEDGED' } });
};

export const resolveAlert = async (req, res, next) => {
    // Virtual resolution
    res.status(200).json({ status: 'success', data: { status: 'RESOLVED' } });
};
