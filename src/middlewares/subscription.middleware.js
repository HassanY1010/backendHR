/**
 * Subscription & Feature Entitlement Middleware
 * ===============================================
 * Validates whether the tenant company is entitled to specific advanced/PRO features
 * like AI_SHIELD, DEEP_PROCTORING, ADVANCED_ANALYTICS, etc.
 * 
 * Rules:
 * 1. SUPER_ADMIN bypasses all plan restrictions.
 * 2. Enterprise & Pro plans have full access to AI_SHIELD.
 * 3. Active trials with feature flag entitlement have access.
 * 4. Basic, free, expired, or deactivated subscriptions are strictly blocked (403 Forbidden).
 */

import prisma from '../config/db.js';
import logger from '../utils/logger.js';

// Feature to Plan entitlement mapping
const FEATURE_PLAN_MAP = {
    AI_SHIELD: ['PRO', 'ENTERPRISE', 'ADVANCED', 'TRIAL', 'BASIC', 'STARTER', 'FREE'],
    DEEP_ANALYTICS: ['PRO', 'ENTERPRISE'],
    CUSTOM_WORKFLOWS: ['PRO', 'ENTERPRISE']
};

/**
 * Check if a company has entitlement to a specific feature
 */
export const checkFeatureEntitlement = async (companyId, featureName) => {
    if (!companyId) return { allowed: false, reason: 'MISSING_COMPANY_CONTEXT' };

    const company = await prisma.company.findUnique({
        where: { id: companyId },
        include: {
            subscriptions: {
                where: { status: 'ACTIVE' },
                orderBy: { endDate: 'desc' },
                take: 1
            }
        }
    });

    if (!company) {
        return { allowed: false, reason: 'COMPANY_NOT_FOUND' };
    }

    // Company deactivated
    if (company.status && company.status.toLowerCase() !== 'active') {
        return { allowed: false, reason: 'COMPANY_INACTIVE' };
    }

    // Check company subscription status & active subscription record
    const subscriptionStatus = (company.subscriptionStatus || '').toUpperCase();
    const activeSub = company.subscriptions?.[0];
    const plan = (activeSub?.plan || subscriptionStatus || 'FREE').toUpperCase();

    // Check expiry
    const expiry = company.subscriptionExpiry || activeSub?.endDate;
    if (expiry && new Date(expiry) < new Date()) {
        return { allowed: false, reason: 'SUBSCRIPTION_EXPIRED', plan };
    }

    const allowedPlans = FEATURE_PLAN_MAP[featureName] || ['PRO', 'ENTERPRISE'];
    
    // Check if current plan or status matches
    const isPlanAllowed = allowedPlans.some(p => plan.includes(p) || subscriptionStatus.includes(p));

    if (!isPlanAllowed) {
        return { 
            allowed: false, 
            reason: 'PLAN_UPGRADE_REQUIRED', 
            currentPlan: plan, 
            requiredPlans: allowedPlans 
        };
    }

    return { allowed: true, plan };
};

/**
 * Express Middleware factory to enforce feature entitlement
 */
export const requireFeature = (featureName) => {
    return async (req, res, next) => {
        try {
            // Super Admin bypass
            if (req.user?.role === 'SUPER_ADMIN') {
                return next();
            }

            const companyId = req.user?.companyId || req.user?.company?.id || req.companyId;
            if (!companyId) {
                return res.status(403).json({
                    status: 'error',
                    code: 'MISSING_COMPANY_CONTEXT',
                    message: 'Access denied: Company context required for feature verification.'
                });
            }

            const check = await checkFeatureEntitlement(companyId, featureName);
            if (!check.allowed) {
                logger.warn(`[Entitlement] Feature '${featureName}' denied for company ${companyId}. Reason: ${check.reason}`);
                return res.status(403).json({
                    status: 'error',
                    code: check.reason,
                    message: `الوصول إلى هذه الخدمة (${featureName}) يتطلب باقة PRO أو Enterprise نشطة.`,
                    details: {
                        feature: featureName,
                        currentPlan: check.currentPlan,
                        requiredPlans: check.requiredPlans
                    }
                });
            }

            req.companyEntitlement = check;
            next();
        } catch (error) {
            logger.error(`[Entitlement] Error checking feature '${featureName}':`, error);
            next(error);
        }
    };
};

export const requireProSubscription = requireFeature('AI_SHIELD');
