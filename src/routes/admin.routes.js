// apps/api/src/routes/admin.routes.js
import express from 'express';
import { protect, authorize } from '../middlewares/auth.middleware.js';
import {
    getAllCompanies,
    getPortfolioAnalytics,
    analyzeCompany,
    updateCompanyStatus,
    getAIUsage,
    getAuditLogs,
    toggleFeature,
    platformKillSwitch,
    getSecurityStats,
    clearSystemCache,
    analyzeSecurityRisk,
    getFeatureFlags,
    assessFeatureImpact,
    analyzeLogs
} from '../controllers/admin.controller.js';





const router = express.Router();

// All routes require Super Admin role
router.use(protect);
router.use(authorize('SUPER_ADMIN'));

// Company Management
router.get('/companies', getAllCompanies);
router.get('/companies/portfolio-analytics', getPortfolioAnalytics);
router.post('/companies/:id/analyze', analyzeCompany);
router.patch('/companies/:id/status', updateCompanyStatus);

// Governance & Monitoring
router.get('/ai-usage', getAIUsage);
router.get('/audit-logs', getAuditLogs);
router.post('/feature-toggle', toggleFeature);
router.post('/kill-switch', platformKillSwitch);
router.get('/security-stats', getSecurityStats);
router.post('/security-stats/analyze', analyzeSecurityRisk);
router.get('/feature-flags', getFeatureFlags);
router.get('/feature-flags/:id/assess', assessFeatureImpact);
router.post('/audit-logs/analyze', analyzeLogs);
router.post('/clear-cache', clearSystemCache);





export default router;
