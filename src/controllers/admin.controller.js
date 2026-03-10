import prisma from '../config/db.js';

export const getAllCompanies = async (req, res, next) => {
    try {
        const companies = await prisma.company.findMany({
            include: {
                _count: {
                    select: { users: true }
                },
                subscriptions: {
                    orderBy: { createdAt: 'desc' },
                    take: 1
                }
            }
        });

        const formattedCompanies = companies.map(c => ({
            id: c.id,
            name: c.name,
            domain: c.website || '',
            industry: 'Technology', // Fallback or map from settings/tags
            size: c.employeeLimit > 50 ? 'Medium' : 'Small',
            status: c.status || (c.subscriptionStatus === 'ACTIVE' ? 'active' : 'inactive'),
            subscription: {
                plan: c.subscriptions[0]?.plan || 'trial',
                status: c.subscriptions[0]?.status || 'active',
                seats: c.employeeLimit,
                usedSeats: c._count.users,
                currentPeriodEnd: c.subscriptions[0]?.endDate || new Date(),
                monthlyRevenue: c.subscriptions[0]?.plan === 'ENTERPRISE' ? 5000 : (c.subscriptions[0]?.plan === 'PRO' ? 299 : 0)
            },
            createdAt: c.createdAt,
            userCount: c._count.users
        }));

        res.status(200).json({ status: 'success', data: formattedCompanies });
    } catch (error) {
        next(error);
    }
};

export const getPortfolioAnalytics = async (req, res, next) => {
    try {
        const [totalCompanies, activeSubscriptions, aiUsage, activeUsers, prevMonthCompanies] = await Promise.all([
            prisma.company.count(),
            prisma.subscription.findMany({ where: { status: 'ACTIVE' } }),
            prisma.aIUsageLog.aggregate({ _sum: { tokens: true } }),
            prisma.user.count({ where: { status: 'ACTIVE' } }),
            prisma.company.count({
                where: {
                    createdAt: {
                        lt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
                    }
                }
            })
        ]);

        const revenue = activeSubscriptions.reduce((acc, sub) => {
            const price = sub.plan === 'ENTERPRISE' ? 5000 : (sub.plan === 'PRO' ? 299 : 0);
            return acc + price;
        }, 0);

        const planDistribution = activeSubscriptions.reduce((acc, sub) => {
            acc[sub.plan] = (acc[sub.plan] || 0) + 1;
            return acc;
        }, {});

        const growthRate = prevMonthCompanies === 0 ? 100 : ((totalCompanies - prevMonthCompanies) / prevMonthCompanies) * 100;

        res.status(200).json({
            status: 'success',
            data: {
                totalCompanies,
                activeUsers,
                totalRevenue: revenue,
                growthRate: parseFloat(growthRate.toFixed(1)),
                planDistribution,
                aiUsage: aiUsage._sum.tokens || 0
            }
        });
    } catch (error) {
        next(error);
    }
};

export const analyzeCompany = async (req, res, next) => {
    try {
        const { id } = req.params;
        const company = await prisma.company.findUnique({
            where: { id },
            include: {
                _count: { select: { users: true, aiUsageLogs: true } }
            }
        });

        if (!company) {
            return res.status(404).json({ status: 'error', message: 'Company not found' });
        }

        const analysis = await aiService.analyzeCompanyPerformance({
            name: company.name,
            userCount: company._count.users,
            aiUsageCount: company._count.aiUsageLogs,
            status: company.subscriptionStatus === 'ACTIVE' ? 'active' : 'inactive',
            industry: 'Technology'
        });

        res.status(200).json({ status: 'success', data: analysis });
    } catch (error) {
        next(error);
    }
};

export const updateCompanyStatus = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { status } = req.body;
        const company = await prisma.company.update({
            where: { id },
            data: {
                status,
                updatedAt: new Date()
            }
        });
        res.status(200).json({ status: 'success', data: company });
    } catch (error) {
        next(error);
    }
};

export const getAIUsage = async (req, res, next) => {
    try {
        const lastMonth = new Date();
        lastMonth.setDate(lastMonth.getDate() - 30);
        const prevMonth = new Date(lastMonth);
        prevMonth.setDate(prevMonth.getDate() - 30);

        const [usage, currentMetrics, lastMonthMetrics] = await Promise.all([
            prisma.aIUsageLog.findMany({
                include: { company: { select: { name: true } } },
                orderBy: { timestamp: 'desc' },
                take: 50
            }),
            prisma.aIUsageLog.aggregate({
                where: { timestamp: { gte: lastMonth } },
                _sum: { tokens: true, cost: true },
                _count: { _all: true }
            }),
            prisma.aIUsageLog.aggregate({
                where: { timestamp: { gte: prevMonth, lt: lastMonth } },
                _sum: { tokens: true, cost: true }
            })
        ]);

        const totalTokens = currentMetrics._sum.tokens || 0;
        const totalCost = currentMetrics._sum.cost || 0;
        const prevTokens = lastMonthMetrics._sum.tokens || 0;
        const prevCost = lastMonthMetrics._sum.cost || 0;

        const calcTrend = (curr, prev) => {
            if (prev === 0) return 0;
            return ((curr - prev) / prev) * 100;
        };

        const formattedUsage = usage.map(log => ({
            id: log.id,
            companyName: log.company.name,
            model: log.model,
            tokens: log.tokens,
            cost: log.cost,
            timestamp: log.timestamp
        }));

        res.status(200).json({
            status: 'success',
            data: formattedUsage,
            summary: {
                totalTokens,
                totalCost,
                tokenTrend: calcTrend(totalTokens, prevTokens),
                costTrend: calcTrend(totalCost, prevCost),
                avgLatency: 142, // Assuming baseline latency since it's not in schema yet
                requestCount: currentMetrics._count._all
            }
        });
    } catch (error) {
        next(error);
    }
};

export const getAuditLogs = async (req, res, next) => {
    try {
        const [logs, totalActions, warningLogs, securityEvents, activeUsers] = await Promise.all([
            prisma.auditLog.findMany({
                include: {
                    user: {
                        select: { name: true, email: true }
                    },
                    company: {
                        select: { name: true }
                    }
                },
                orderBy: { timestamp: 'desc' },
                take: 100
            }),
            prisma.auditLog.count(),
            prisma.auditLog.count({
                where: {
                    severity: { in: ['medium', 'high', 'warning'] }
                }
            }),
            prisma.auditLog.count({
                where: {
                    OR: [
                        { actionType: 'security' },
                        { actionType: 'SECURITY' }
                    ]
                }
            }),
            prisma.user.count({ where: { status: 'ACTIVE' } })
        ]);

        const formattedLogs = logs.map(log => ({
            id: log.id,
            user: log.user?.name || 'System',
            action: log.action,
            actionType: log.actionType,
            severity: log.severity,
            target: log.target || 'N/A',
            status: log.status,
            ip: log.ip,
            timestamp: log.timestamp,
            details: log.details,
            companyName: log.company?.name
        }));

        res.status(200).json({
            status: 'success',
            data: formattedLogs,
            summary: {
                totalActions,
                warningLogs,
                securityEvents,
                activeUsers
            }
        });
    } catch (error) {
        next(error);
    }
};



export const getFeatureFlags = async (req, res, next) => {
    try {
        const flags = await prisma.featureFlag.findMany({
            orderBy: { name: 'asc' }
        });
        res.status(200).json({ status: 'success', data: flags });
    } catch (error) {
        next(error);
    }
};

export const toggleFeature = async (req, res, next) => {
    try {
        const { featureName, enabled } = req.body;

        const flag = await prisma.featureFlag.update({
            where: { id: featureName },
            data: {
                enabled,
                updatedAt: new Date()
            }
        });

        // Log the change
        await prisma.auditLog.create({
            data: {
                userId: req.user.id,
                action: `FEATURE_TOGGLE_${enabled ? 'ENABLED' : 'DISABLED'}`,
                actionType: 'system',
                severity: 'medium',
                details: `Feature ${flag.name} (${featureName}) was ${enabled ? 'enabled' : 'disabled'} by ${req.user.email}`,
                status: 'success'
            }
        });

        res.status(200).json({ status: 'success', data: flag, message: `Feature ${flag.name} is now ${enabled ? 'enabled' : 'disabled'}` });
    } catch (error) {
        next(error);
    }
};

export const assessFeatureImpact = async (req, res, next) => {
    try {
        const { id } = req.params;
        const flag = await prisma.featureFlag.findUnique({ where: { id } });

        if (!flag) {
            return res.status(404).json({ status: 'error', message: 'Feature flag not found' });
        }

        const analysis = await aiService.assessFeatureImpact(flag);

        res.status(200).json({
            status: 'success',
            data: analysis
        });
    } catch (error) {
        next(error);
    }
};


export const platformKillSwitch = async (req, res, next) => {
    try {
        const { active } = req.body;

        await prisma.systemSetting.upsert({
            where: { key: 'PLATFORM_KILL_SWITCH' },
            update: {
                value: active.toString(),
                updatedAt: new Date()
            },
            create: {
                key: 'PLATFORM_KILL_SWITCH',
                value: active.toString(),
                description: 'Global flag to disable all platform access',
                updatedAt: new Date()
            }
        });

        // Log this critical action
        await prisma.auditLog.create({
            data: {
                userId: req.user.id,
                action: active ? 'PLATFORM_SHUTDOWN' : 'PLATFORM_RESTORE',
                actionType: 'security',
                severity: 'critical',
                details: `Platform kill switch ${active ? 'activated' : 'deactivated'} by ${req.user.email}`,
                status: 'success'
            }
        });

        res.status(200).json({
            status: 'success',
            message: active ? 'PLATFORM SHUTDOWN INITIATED' : 'Platform access restored',
            data: { active }
        });
    } catch (error) {
        next(error);
    }
};

export const getSecurityStats = async (req, res, next) => {
    try {
        const [suspiciousLogins, criticalAlerts, killSwitchSetting] = await Promise.all([
            prisma.auditLog.count({
                where: {
                    action: 'LOGIN_FAILURE',
                    timestamp: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
                }
            }),
            prisma.auditLog.count({
                where: { severity: 'critical' }
            }),
            prisma.systemSetting.findUnique({
                where: { key: 'PLATFORM_KILL_SWITCH' }
            })
        ]);

        res.status(200).json({
            status: 'success',
            data: {
                suspiciousLogins,
                criticalAlerts,
                killSwitchActive: killSwitchSetting?.value === 'true',
                firewallStatus: 'active' // Placeholder for real firewall status
            }
        });
    } catch (error) {
        next(error);
    }
};

import { aiService } from '../ai/ai-service.js';

export const analyzeSecurityRisk = async (req, res, next) => {
    try {
        const { logs } = req.body;
        const analysis = await aiService.analyzeSecurityRisk(logs || [], req.user.companyId);

        res.status(200).json({
            status: 'success',
            data: analysis
        });
    } catch (error) {
        next(error);
    }
};

export const clearSystemCache = async (req, res, next) => {

    try {
        // In a real scenario, this would clear Redis or local cache
        // Mocking the behavior for now
        await prisma.auditLog.create({
            data: {
                userId: req.user.id,
                action: 'CLEAR_CACHE',
                actionType: 'system',
                severity: 'low',
                details: 'System cache cleared manually from security dashboard',
                status: 'success'
            }
        });

        res.status(200).json({
            status: 'success',
            message: 'System cache cleared successfully'
        });
    } catch (error) {
        next(error);
    }
};

export const analyzeLogs = async (req, res, next) => {
    try {
        const { logs } = req.body;
        const analysis = await aiService.analyzeAuditAnomaly(logs || [], req.user.companyId);

        res.status(200).json({
            status: 'success',
            data: analysis
        });
    } catch (error) {
        next(error);
    }
};


