import prisma from '../config/db.js';
import { aiService } from '../ai/ai-service.js';

export const getDashboardStats = async (req, res, next) => {
    try {
        const companyId = req.user.companyId;

        // Parallelize data fetching for performance
        const [
            totalEmployees,
            activeJobs,
            totalApplications,
            employeesInTraining,
            highRiskEmployees,
            activeInterviews,
            hiredCandidates,
            rejectedCandidates,
            completedTraining,
            totalTrainingRecords
        ] = await Promise.all([
            prisma.user.count({ where: { companyId, role: 'EMPLOYEE', deletedAt: null } }),
            prisma.recruitmentJob.count({ where: { companyId, status: 'OPEN' } }),
            prisma.candidate.count({ where: { recruitmentjob: { companyId }, deletedAt: null } }),
            prisma.trainingAssignment.count({
                where: {
                    employee: { user: { companyId }, deletedAt: null },
                    status: 'IN_PROGRESS'
                }
            }),
            prisma.employee.count({
                where: {
                    user: { companyId },
                    deletedAt: null,
                    riskLevel: { gt: 7 }
                }
            }),
            prisma.interview.count({
                where: {
                    candidate: {
                        recruitmentjob: { companyId },
                        deletedAt: null
                    },
                    completed: false
                }
            }),
            prisma.candidate.count({ where: { recruitmentjob: { companyId }, status: 'HIRED', deletedAt: null } }),
            prisma.candidate.count({ where: { recruitmentjob: { companyId }, status: 'REJECTED', deletedAt: null } }),
            prisma.trainingAssignment.count({
                where: {
                    employee: { user: { companyId }, deletedAt: null },
                    status: 'COMPLETED'
                }
            }),
            prisma.trainingAssignment.count({
                where: {
                    employee: { user: { companyId }, deletedAt: null }
                }
            })
        ]);

        // Calculate rates
        const trainingCompletionRate = totalTrainingRecords > 0
            ? Math.round((completedTraining / totalTrainingRecords) * 100)
            : 0;

        res.status(200).json({
            status: 'success',
            data: {
                hr: {
                    totalEmployees,
                    satisfaction: 82, // Still mock until we have enough survey data
                    stressHigh: highRiskEmployees,
                    attritionRisk: Math.round(highRiskEmployees * 0.4) // Estimated logic
                },
                recruitment: {
                    activeJobs,
                    applicants: totalApplications,
                    accepted: hiredCandidates,
                    rejected: rejectedCandidates,
                    interviews: activeInterviews
                },
                training: {
                    needsTraining: Math.round(totalEmployees * 0.2), // Approx 20% need training
                    inProgress: employeesInTraining,
                    completionRate: trainingCompletionRate,
                    impact: 12 // Requires complex pre/post analysis, keep static for now
                }
            }
        });
    } catch (error) {
        next(error);
    }
};

export const getRecruitmentFunnel = async (req, res, next) => {
    try {
        const companyId = req.user.companyId;
        const stats = await prisma.candidate.groupBy({
            by: ['status'],
            where: { recruitmentjob: { companyId } },
            _count: true,
        });

        const funnel = {
            total: stats.reduce((acc, curr) => acc + curr._count, 0),
            byStatus: stats.map(s => ({
                status: s.status,
                count: s._count,
                label: s.status === 'NEW' ? 'جديد' :
                    s.status === 'SCREENING' ? 'مراجعة' :
                        s.status === 'INTERVIEWING' ? 'مقابلات' :
                            s.status === 'HIRED' ? 'توظيف' : s.status
            }))
        };

        res.status(200).json({ status: 'success', data: funnel });
    } catch (error) {
        next(error);
    }
};

export const getEmployeeTrends = async (req, res, next) => {
    try {
        const companyId = req.user.companyId;

        // In real app, this would query a metrics or historical table
        const trends = {
            engagement: [
                { month: 'يناير', value: 78 },
                { month: 'فبراير', value: 82 },
                { month: 'مارس', value: 80 },
                { month: 'أبريل', value: 85 },
                { month: 'مايو', value: 88 },
                { month: 'يونيو', value: 86 }
            ],
            turnover: [
                { month: 'يناير', value: 2 },
                { month: 'فبراير', value: 1.5 },
                { month: 'مارس', value: 3 },
                { month: 'أبريل', value: 1 },
                { month: 'مايو', value: 0.5 },
                { month: 'يونيو', value: 1.2 }
            ]
        };

        res.status(200).json({ status: 'success', data: trends });
    } catch (error) {
        next(error);
    }
};

export const getTrainingAnalytics = async (req, res, next) => {
    try {
        const companyId = req.user.companyId;

        const [totalTrainings, completions, categories] = await Promise.all([
            prisma.trainingCourse.count({
                where: {
                    assignments: {
                        some: {
                            employee: {
                                companyId
                            }
                        }
                    }
                }
            }),
            prisma.trainingAssignment.count({
                where: {
                    employee: { companyId },
                    status: 'COMPLETED'
                }
            }),
            prisma.trainingCourse.groupBy({
                by: ['category'],
                where: {
                    assignments: {
                        some: {
                            employee: { companyId }
                        }
                    }
                },
                _count: true
            })
        ]);

        const formattedCategories = categories.map(c => ({
            name: c.category || 'أخرى',
            value: c._count
        }));

        res.status(200).json({
            status: 'success',
            data: {
                total: totalTrainings,
                completed: completions,
                activeUsers: 45, // Placeholder
                completionRate: totalTrainings > 0 ? (completions / (totalTrainings || 1)) * 100 : 0,
                distribution: formattedCategories
            }
        });
    } catch (error) {
        next(error);
    }
};

export const getAuditLogs = async (req, res, next) => {
    try {
        const companyId = req.user.companyId;
        const logs = await prisma.auditLog.findMany({
            where: { companyId },
            include: {
                user: { select: { name: true } }
            },
            orderBy: { timestamp: 'desc' },
            take: 50
        });

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
            details: log.details
        }));

        res.status(200).json({ status: 'success', data: formattedLogs });
    } catch (error) {
        next(error);
    }
};


export const getSystemHealth = async (req, res, next) => {
    try {
        const start = Date.now();
        const uptime = process.uptime();
        const memoryUsage = process.memoryUsage();

        // 1. CPU Load (Approximate using os.loadavg if available, else process.cpuUsage)
        // Note: In some environments os.loadavg might not work as expected via import, defaulting to standard calculation
        let cpuLoad = 15; // Fallback
        try {
            const os = await import('os');
            const cpus = os.cpus();
            const load = os.loadavg(); // [1min, 5min, 15min]
            cpuLoad = (load[0] / cpus.length) * 100;
        } catch (e) {
            // Fallback for non-node environment or restriction
        }

        // 2. Database Health & Latency
        let dbStatus = 'healthy';
        let dbLatency = 0;
        try {
            const dbStart = Date.now();
            await prisma.$queryRaw`SELECT 1`;
            dbLatency = Date.now() - dbStart;
        } catch (e) {
            dbStatus = 'critical';
            dbLatency = 0;
        }

        // 3. AI Service Health
        const aiHealth = await aiService.checkHealth();

        // 4. Redis/Cache Health (Assuming memoryCache is working if we are here)
        // In a real scenario, ping redis. Here we simulate "Internal Cache"
        const cacheStatus = 'healthy';
        const cacheLatency = 1;

        // 5. Overall System Response Time (Metrics calculation overhead)
        const responseTime = Date.now() - start;

        const metrics = {
            cpu: {
                id: '1',
                name: 'CPU Usage',
                value: Math.min(Math.round(cpuLoad), 100),
                unit: '%',
                status: cpuLoad > 80 ? 'warning' : 'healthy',
                trend: cpuLoad > 50 ? 'up' : 'stable'
            },
            memory: {
                id: '2',
                name: 'RAM Usage',
                value: Math.round((memoryUsage.heapUsed / memoryUsage.heapTotal) * 100),
                unit: '%',
                status: (memoryUsage.heapUsed / memoryUsage.heapTotal) > 0.9 ? 'warning' : 'healthy',
                trend: 'stable'
            },
            storage: {
                id: '3',
                name: 'Disk Space',
                value: 45, // Hard to get without 'fs' stats on root, keeping static safe value or could implement fs.statfs
                unit: '%',
                status: 'healthy',
                trend: 'stable'
            },
            network: {
                id: '4',
                name: 'Network Load',
                value: Math.round(Math.random() * 50 + 20), // Simulated real-ish fluctuation
                unit: 'Mbps',
                status: 'healthy',
                trend: 'stable'
            },
            responseTime: responseTime
        };

        const services = [
            {
                id: '1',
                name: 'API Server',
                status: 'healthy',
                latency: responseTime,
                uptime: `${Math.floor(uptime / 3600)}h ${Math.floor((uptime % 3600) / 60)}m`,
                lastChecked: new Date(),
                category: 'core',
                version: 'v1.0.0'
            },
            {
                id: '2',
                name: 'Database (Prisma)',
                status: dbStatus,
                latency: dbLatency,
                uptime: '99.99%',
                lastChecked: new Date(),
                category: 'database'
            },
            {
                id: '3',
                name: 'Internal Cache',
                status: cacheStatus,
                latency: cacheLatency,
                uptime: '100%',
                lastChecked: new Date(),
                category: 'database'
            },
            {
                id: '4',
                name: 'OpenAI Service',
                status: aiHealth.status,
                latency: aiHealth.latency,
                uptime: '99.9%',
                lastChecked: new Date(),
                category: 'core'
            }
        ];

        // 6. Security Stats (Real from DB)
        const [securityThreats, recentLogs] = await Promise.all([
            prisma.auditLog.count({
                where: {
                    OR: [
                        { action: 'LOGIN_FAILED' },
                        { severity: 'HIGH' },
                        { severity: 'CRITICAL' }
                    ],
                    timestamp: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } // Last 24h
                }
            }),
            prisma.auditLog.findMany({
                take: 5,
                orderBy: { timestamp: 'desc' },
                include: { user: { select: { name: true } } }
            })
        ]);

        const security = {
            score: Math.max(100 - (securityThreats * 5), 0),
            threats: securityThreats,
            activeRules: 12, // Static safe default
            lastScan: new Date(),
            recentLogs: recentLogs.map(l => ({
                user: l.user?.name || 'System',
                action: l.action,
                time: l.timestamp,
                ip: l.ip || 'Internal'
            }))
        };

        // 7. Regions (Honest representation for single server)
        const regions = [
            {
                name: 'Primary Server (Local)',
                id: 'local-1',
                status: 'healthy',
                latency: 0,
                load: Math.round(cpuLoad)
            }
        ];

        // 8. Backups (Simulated "Daily" Backup status effectively constant for this app context)
        // Ideally we check a 'BackupLog' table if it existed.
        const backups = {
            lastBackup: new Date(Date.now() - 3600000 * 4), // 4 hours ago
            status: 'healthy',
            size: '1.4GB',
            retention: '30 Days'
        };

        res.status(200).json({
            status: 'success',
            data: {
                services,
                metrics,
                regions,
                backups,
                security,
                lastUpdated: new Date()
            }
        });
    } catch (error) {
        next(error);
    }
};

export const getSystemStats = async (req, res, next) => {
    try {
        const [companies, users, logs] = await Promise.all([
            prisma.company.count(),
            prisma.user.count(),
            prisma.auditLog.count()
        ]);

        res.status(200).json({
            status: 'success',
            data: {
                activeCompanies: companies,
                totalUsers: users,
                totalLogs: logs,
                aiUsage: logs,
                systemHealth: 98
            }
        });
    } catch (error) {
        next(error);
    }
};

export const get30x3Insights = async (req, res, next) => {
    try {
        const companyId = req.user.companyId;
        const timeframe = req.query.timeframe || 'monthly';
        const daysToSubtract = timeframe === 'weekly' ? 7 : 30;

        const startDate = new Date();
        startDate.setDate(startDate.getDate() - daysToSubtract);

        // Fetch completed assessments within timeframe for the company's employees
        const assessments = await prisma.checkInAssessment.findMany({
            where: {
                employee: { companyId },
                status: 'COMPLETED',
                updatedAt: { gte: startDate }
            },
            include: {
                employee: true,
                checkinentries: { orderBy: { order: 'asc' } }
            },
            orderBy: { updatedAt: 'asc' }
        });

        const totalAssessments = assessments.length;
        let totalScore = 0;
        let stressCount = 0;
        const trendMap = new Map();

        assessments.forEach(assessment => {
            totalScore += assessment.score || 0;

            if (assessment.riskLevel === 'TIRED' || assessment.riskLevel === 'RISK_OF_BURNOUT') {
                stressCount++;
            }

            const date = assessment.updatedAt.toISOString().split('T')[0];
            if (!trendMap.has(date)) {
                trendMap.set(date, { count: 0, sum: 0 });
            }
            const current = trendMap.get(date);
            current.count++;
            current.sum += assessment.score || 0;
        });

        const satisfaction = totalAssessments > 0 ? Math.round(totalScore / totalAssessments) : 0;
        const stressLevel = totalAssessments > 0 ? Math.round((stressCount / totalAssessments) * 100) : 0;

        const moodTrend = Array.from(trendMap.entries()).map(([date, val]) => ({
            date,
            value: Math.round(val.sum / val.count)
        }));

        // Use new data structure for AI analysis
        const aiAnalysis = await aiService.analyze30x3Data(assessments);

        const insights = {
            satisfaction,
            stress: stressLevel,
            moodGrowth: 4.2, // Placeholder or calculated comparison
            moodTrend,
            totalParticipation: totalAssessments,
            insights: aiAnalysis.insights,
            alerts: aiAnalysis.alerts
        };

        res.status(200).json({ status: 'success', data: insights });
    } catch (error) {
        next(error);
    }
};

export const getAIUsageAnalytics = async (req, res, next) => {
    try {
        const companyId = req.user.companyId;
        const timeframe = req.query.timeframe || 'monthly';
        const days = timeframe === 'weekly' ? 7 : 30;
        const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

        const logs = await prisma.aIUsageLog.findMany({
            where: {
                companyId,
                timestamp: { gte: startDate }
            },
            orderBy: { timestamp: 'desc' }
        });

        // Aggregation
        const stats = {
            totalCost: logs.reduce((sum, log) => sum + log.cost, 0),
            totalTokens: logs.reduce((sum, log) => sum + log.tokens, 0),
            byService: {},
            byModel: {},
            history: [] // Daily cost data
        };

        const dailyMap = new Map();

        logs.forEach(log => {
            // By Service
            stats.byService[log.service] = (stats.byService[log.service] || 0) + log.cost;
            // By Model
            stats.byModel[log.model] = (stats.byModel[log.model] || 0) + log.cost;

            // Daily Trend
            const day = log.timestamp.toISOString().split('T')[0];
            if (!dailyMap.has(day)) dailyMap.set(day, { date: day, cost: 0, tokens: 0 });
            dailyMap.get(day).cost += log.cost;
            dailyMap.get(day).tokens += log.tokens;
        });

        stats.history = Array.from(dailyMap.values()).sort((a, b) => a.date.localeCompare(b.date));

        res.status(200).json({
            status: 'success',
            data: stats
        });
    } catch (error) {
        next(error);
    }
};

export const getEmployeePerformanceAnalytics = async (req, res, next) => {
    try {
        const { id } = req.params;
        const employee = await prisma.employee.findUnique({
            where: { userId: id },
            include: { user: true }
        });

        if (!employee) {
            return res.status(404).json({ status: 'error', message: 'Employee not found' });
        }

        res.status(200).json({
            status: 'success',
            data: {
                performance: employee.performanceRating || 85,
                risk: employee.riskLevel || 0,
                attendance: 98,
                tasksCompleted: 42
            }
        });
    } catch (error) {
        next(error);
    }
};

export const analyzeSystemPerformance = async (req, res, next) => {
    try {
        const { metrics } = req.body;
        const analysis = await aiService.analyzeSystemPerformance(metrics);
        res.status(200).json({
            status: 'success',
            data: analysis
        });
    } catch (error) {
        next(error);
    }
};

export const getProductMetrics = async (req, res, next) => {
    try {
        const now = new Date();
        const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        const last48h = new Date(now.getTime() - 48 * 60 * 60 * 1000);

        const [
            totalUsers,
            activeUsers24h,
            prevActiveUsers24h,
            sessions24h,
            prevSessions24h,
            usageHistory,
            jobsWithApplications,
            usersInTraining,
            totalCompanies
        ] = await Promise.all([
            prisma.user.count(),
            prisma.user.count({ where: { lastLogin: { gte: last24h } } }),
            prisma.user.count({ where: { lastLogin: { gte: last48h, lt: last24h } } }),
            prisma.auditLog.count({ where: { action: 'LOGIN', timestamp: { gte: last24h } } }),
            prisma.auditLog.count({ where: { action: 'LOGIN', timestamp: { gte: last48h, lt: last24h } } }),
            prisma.productUsage.findMany({ orderBy: { date: 'desc' }, take: 30 }),
            prisma.recruitmentJob.count({
                where: { candidates: { some: {} } }
            }),
            prisma.employee.count({
                where: { assignments: { some: {} } }
            }),
            prisma.company.count()
        ]);

        const calcChange = (current, prev) => {
            if (!prev || prev === 0) return current > 0 ? 100 : 0;
            return parseFloat(((current - prev) / prev * 100).toFixed(1));
        };

        // Real adoption rates
        const recruitmentAdoptionRate = totalCompanies > 0 ? Math.round((jobsWithApplications / totalCompanies) * 100) : 0;
        const trainingAdoptionRate = totalUsers > 0 ? Math.round((usersInTraining / totalUsers) * 100) : 0;
        const engagementRate = totalUsers > 0 ? Math.round((activeUsers24h / totalUsers) * 100) : 0;
        const prevEngagementRate = totalUsers > 0 ? Math.round((prevActiveUsers24h / totalUsers) * 100) : 0;

        // Current Session Avg vs Previous (from usage history)
        const currentAvgSession = usageHistory.length > 0 ? usageHistory[0].avgSessionDuration : 18;
        const prevAvgSession = usageHistory.length > 1 ? usageHistory[1].avgSessionDuration : currentAvgSession;

        const metricsData = [
            { id: 'active_users', name: 'المستخدمون النشطون', category: 'USAGE', value: activeUsers24h, unit: 'users', change: calcChange(activeUsers24h, prevActiveUsers24h), trend: activeUsers24h >= prevActiveUsers24h ? 'up' : 'down' },
            { id: 'engagement_rate', name: 'معدل التفاعل', category: 'ENGAGEMENT', value: engagementRate, unit: '%', change: calcChange(engagementRate, prevEngagementRate), trend: engagementRate >= prevEngagementRate ? 'up' : 'down' },
            { id: 'daily_sessions', name: 'إجمالي الجلسات', category: 'USAGE', value: sessions24h, unit: 'sessions', change: calcChange(sessions24h, prevSessions24h), trend: sessions24h >= prevSessions24h ? 'up' : 'down' },
            { id: 'avg_session', name: 'متوسط وقت الجلسة', category: 'ENGAGEMENT', value: currentAvgSession, unit: 'min', change: calcChange(currentAvgSession, prevAvgSession), trend: currentAvgSession >= prevAvgSession ? 'up' : 'down' },
            { id: 'recruitment_adoption', name: 'التوظيف الذكي', category: 'ADOPTION', value: recruitmentAdoptionRate, unit: '%', metadata: JSON.stringify({ activeUsers: jobsWithApplications, totalUsers: totalCompanies }) },
            { id: 'training_adoption', name: 'التدريب والتطوير', category: 'ADOPTION', value: trainingAdoptionRate, unit: '%', metadata: JSON.stringify({ activeUsers: usersInTraining, totalUsers: totalUsers }) }
        ];

        // Sync with ProductMetric table for AI/History
        await Promise.all(metricsData.map(m =>
            prisma.productMetric.upsert({
                where: { id: m.id },
                update: {
                    value: parseFloat(m.value) || 0,
                    unit: m.unit,
                    change: m.change,
                    trend: m.trend,
                    metadata: m.metadata,
                    timestamp: new Date()
                },
                create: {
                    id: m.id,
                    name: m.name,
                    category: m.category,
                    value: parseFloat(m.value) || 0,
                    unit: m.unit,
                    change: m.change,
                    trend: m.trend,
                    metadata: m.metadata
                }
            })
        ));

        // Format metadata back for response
        const metrics = metricsData.map(m => ({
            ...m,
            metadata: m.metadata ? JSON.parse(m.metadata) : undefined
        }));

        res.status(200).json({
            status: 'success',
            data: { metrics, history: usageHistory.reverse() }
        });

    } catch (error) {
        next(error);
    }
};

export const analyzeProductMetrics = async (req, res, next) => {
    try {
        const metrics = await prisma.productMetric.findMany({
            orderBy: { timestamp: 'desc' },
            take: 20 // Get latest metrics for analysis
        });
        const analysis = await aiService.analyzeProductMetrics(metrics);
        res.status(200).json({ status: 'success', data: analysis });
    } catch (error) {
        next(error);
    }
};

export const getFinanceStats = async (req, res, next) => {
    try {
        const [transactions, metrics] = await Promise.all([
            prisma.financialTransaction.findMany({
                orderBy: { date: 'desc' },
                take: 100
            }),
            prisma.financeMetric.findMany()
        ]);

        const totalRevenue = transactions
            .filter(t => t.type === 'INCOME')
            .reduce((sum, t) => sum + t.amount, 0);

        const totalExpenses = transactions
            .filter(t => t.type === 'EXPENSE')
            .reduce((sum, t) => sum + t.amount, 0);

        const categories = await prisma.financialTransaction.groupBy({
            by: ['category'],
            where: { type: 'EXPENSE' },
            _sum: { amount: true }
        });

        res.status(200).json({
            status: 'success',
            data: {
                summary: {
                    totalRevenue,
                    totalExpenses,
                    netProfit: totalRevenue - totalExpenses,
                    profitMargin: totalRevenue > 0 ? Math.round(((totalRevenue - totalExpenses) / totalRevenue) * 100) : 0,
                    revenueGrowth: 15.4 // Mocked trend
                },
                transactions,
                metrics,
                categories: categories.map(c => ({
                    category: c.category,
                    amount: c._sum.amount,
                    percentage: totalExpenses > 0 ? Math.round((c._sum.amount / totalExpenses) * 100) : 0
                }))
            }
        });
    } catch (error) {
        next(error);
    }
};

export const analyzeFinance = async (req, res, next) => {
    try {
        const transactions = await prisma.financialTransaction.findMany();
        const totalRevenue = transactions.filter(t => t.type === 'INCOME').reduce((sum, t) => sum + t.amount, 0);
        const totalExpenses = transactions.filter(t => t.type === 'EXPENSE').reduce((sum, t) => sum + t.amount, 0);

        const analysis = await aiService.analyzeFinance({ totalRevenue, totalExpenses });
        res.status(200).json({ status: 'success', data: analysis });
    } catch (error) {
        next(error);
    }
};

export const generateStrategicReport = async (req, res, next) => {
    try {
        const companyId = req.user.companyId;

        // Fetch data for the report
        const [totalEmployees, openJobs, trainingStats, highRiskCount] = await Promise.all([
            prisma.user.count({ where: { companyId, role: 'EMPLOYEE' } }),
            prisma.recruitmentJob.count({ where: { companyId, status: 'OPEN' } }),
            prisma.trainingAssignment.findMany({
                where: { employee: { companyId } },
                select: { status: true }
            }),
            prisma.employee.count({
                where: { companyId, riskLevel: { gt: 7 } }
            })
        ]);

        const trainingCompletionRate = trainingStats.length > 0
            ? (trainingStats.filter(t => t.status === 'COMPLETED').length / trainingStats.length) * 100
            : 0;

        const reportData = {
            totalEmployees,
            satisfaction: 82, // Placeholder
            activeJobs: openJobs,
            trainingCompletionRate,
            highRiskCount
        };

        const report = await aiService.generateFullStrategicReport(reportData);

        res.status(200).json({ status: 'success', data: report });
    } catch (error) {
        next(error);
    }
};

export const getCompetitionStats = async (req, res, next) => {
    try {
        const competitors = await prisma.competitor.findMany({
            orderBy: { marketShare: 'desc' }
        });

        const ourStats = {
            id: 'us',
            name: 'AI HR',
            marketShare: 18,
            growthRate: 15.4,
            strengths: ['AI Integration', 'Localization', 'User Experience'],
            weaknesses: ['Brand Awareness'],
            color: '#4F46E5', // Indigo
            isUs: true
        };

        const marketMetrics = await prisma.marketMetric.findMany();

        res.status(200).json({
            status: 'success',
            data: {
                competitors: [ourStats, ...competitors],
                marketMetrics
            }
        });
    } catch (error) {
        next(error);
    }
};

export const getGrowthStats = async (req, res, next) => {
    try {
        const now = new Date();
        const startOfYear = new Date(now.getFullYear(), 0, 1);
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

        // 1. User Growth
        const totalUsers = await prisma.user.count();
        const usersThisMonth = await prisma.user.count({ where: { createdAt: { gte: startOfMonth } } });
        const usersThisYear = await prisma.user.count({ where: { createdAt: { gte: startOfYear } } });

        // 2. Revenue Growth (from Transactions)
        const revenueTx = await prisma.financialTransaction.findMany({
            where: { type: 'INCOME' },
            select: { amount: true, date: true }
        });

        const totalRevenue = revenueTx.reduce((sum, tx) => sum + tx.amount, 0);
        const revenueThisMonth = revenueTx.filter(tx => tx.date >= startOfMonth).reduce((sum, tx) => sum + tx.amount, 0);

        // 3. Employee Efficiency (Tasks Completed)
        const tasksCompleted = await prisma.task.count({ where: { status: 'completed' } });
        const tasksThisMonth = await prisma.task.count({ where: { status: 'completed', updatedAt: { gte: startOfMonth } } });

        res.status(200).json({
            status: 'success',
            data: {
                users: {
                    total: totalUsers,
                    monthlyGrowth: usersThisMonth,
                    annualGrowth: usersThisYear
                },
                revenue: {
                    total: totalRevenue,
                    monthlyGrowth: revenueThisMonth
                },
                efficiency: {
                    tasksCompleted: tasksCompleted,
                    monthly: tasksThisMonth
                }
            }
        });
    } catch (error) {
        next(error);
    }
};

export const getUserGrowthHistory = async (req, res, next) => {
    try {
        const months = 6; // Last 6 months
        const now = new Date();
        const history = [];

        for (let i = months - 1; i >= 0; i--) {
            const monthStart = new Date(now.getFullYear(), now.getMonth() - i, 1);
            const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0, 23, 59, 59);

            // Total users up to this month
            const totalUsers = await prisma.user.count({
                where: { createdAt: { lte: monthEnd } }
            });

            // New users in this month
            const newUsers = await prisma.user.count({
                where: {
                    createdAt: {
                        gte: monthStart,
                        lte: monthEnd
                    }
                }
            });
            const newTrainingCourses = await prisma.trainingCourse.count({
                where: {
                    createdAt: {
                        gte: monthStart,
                        lte: monthEnd
                    }
                }
            });

            // Active users (logged in during this month)
            const activeUsers = await prisma.user.count({
                where: {
                    lastLogin: {
                        gte: monthStart,
                        lte: monthEnd
                    }
                }
            });

            const monthNames = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];

            history.push({
                month: monthNames[monthStart.getMonth()],
                totalUsers,
                newUsers,
                activeUsers: activeUsers > 0 ? activeUsers : Math.floor(totalUsers * 0.7) // Fallback if no lastLogin data
            });
        }

        res.status(200).json({ status: 'success', data: history });
    } catch (error) {
        next(error);
    }
};

