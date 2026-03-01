import express from 'express';
import {
    getDashboardStats,
    getEmployeePerformanceAnalytics,
    getRecruitmentFunnel,
    getSystemStats,
    getSystemHealth,
    analyzeSystemPerformance,
    getAuditLogs,
    getEmployeeTrends,
    getTrainingAnalytics,
    getProductMetrics,
    analyzeProductMetrics,
    getFinanceStats,
    analyzeFinance,
    generateStrategicReport,
    getCompetitionStats,
    getGrowthStats,
    getUserGrowthHistory,
    getAIUsageAnalytics
} from '../controllers/analytics.controller.js';
import { protect, authorize } from '../middlewares/auth.middleware.js';

const router = express.Router();

router.use(protect);
router.get('/dashboard', authorize('MANAGER', 'SUPER_ADMIN'), getDashboardStats);
router.get('/employee/:id', authorize('MANAGER', 'SUPER_ADMIN'), getEmployeePerformanceAnalytics);
router.get('/recruitment', authorize('MANAGER', 'SUPER_ADMIN'), getRecruitmentFunnel);
router.get('/trends', authorize('MANAGER', 'SUPER_ADMIN'), getEmployeeTrends);
router.get('/training', authorize('MANAGER', 'SUPER_ADMIN'), getTrainingAnalytics);
router.get('/ai-usage', authorize('MANAGER', 'SUPER_ADMIN'), getAIUsageAnalytics);
router.get('/system-stats', authorize('SUPER_ADMIN'), getSystemStats);
router.get('/system-health', authorize('SUPER_ADMIN'), getSystemHealth);
router.post('/system-health/analyze', authorize('SUPER_ADMIN'), analyzeSystemPerformance);
router.get('/audit-logs', authorize('SUPER_ADMIN'), getAuditLogs);
router.get('/product', authorize('SUPER_ADMIN'), getProductMetrics);
router.post('/product/analyze', authorize('SUPER_ADMIN'), analyzeProductMetrics);
router.get('/finance', authorize('SUPER_ADMIN'), getFinanceStats);
router.post('/finance/analyze', authorize('SUPER_ADMIN'), analyzeFinance);
// Owner/Super Admin Routes
router.get('/competition', authorize('SUPER_ADMIN'), getCompetitionStats);
router.get('/growth', authorize('SUPER_ADMIN'), getGrowthStats);
router.get('/user-growth-history', authorize('SUPER_ADMIN'), getUserGrowthHistory);
router.get('/strategic-report', authorize('MANAGER', 'SUPER_ADMIN'), generateStrategicReport);

export default router;
