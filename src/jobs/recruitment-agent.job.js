import { schedule } from 'node-cron';
import prisma from '../config/db.js';
import { recruitmentAgentService } from '../ai/recruitment-agent.service.js';
import logger from '../utils/logger.js';

/**
 * Concurrency Lock to prevent overlapping autonomous sweeps
 */
let isAgentSweepRunning = false;

/**
 * Autonomous sweep runner across all active companies with strict multi-tenant isolation.
 * Can be invoked directly by node-cron or by external cloud schedulers (via /api/cron/trigger).
 */
export const runAutonomousAgentSweep = async (options = {}) => {
    const { requestedTaskType = 'ALL', triggerSource = 'CRON_SCHEDULER', targetCompanyId } = options;

    if (isAgentSweepRunning) {
        logger.warn(`[Agent-Scheduler] Sweep already in progress. Skipping overlapping run triggered by ${triggerSource}.`);
        return {
            status: 'SKIPPED',
            reason: 'CONCURRENT_SWEEP_IN_PROGRESS',
            timestamp: new Date().toISOString()
        };
    }

    isAgentSweepRunning = true;
    const startTime = Date.now();
    logger.info(`[Agent-Scheduler] 🤖 Starting autonomous recruitment agent sweep (Trigger: ${triggerSource}, Task: ${requestedTaskType})...`);

    const summaryReport = {
        triggerSource,
        startedAt: new Date().toISOString(),
        companiesProcessed: 0,
        companyResults: [],
        errors: []
    };

    try {
        // 1. Fetch active companies (or targeted company if specified)
        const whereClause = {
            status: 'active',
            subscriptionStatus: { in: ['ACTIVE', 'TRIAL', 'ENTERPRISE'] }
        };
        if (targetCompanyId) {
            whereClause.id = targetCompanyId;
        }

        const activeCompanies = await prisma.company.findMany({
            where: whereClause,
            select: { id: true, name: true },
            take: targetCompanyId ? 1 : 10
        });

        summaryReport.totalActiveCompanies = activeCompanies.length;

        // 2. Execute agent planner per company (strictly isolated)
        for (const company of activeCompanies) {
            try {
                logger.info(`[Agent-Scheduler] Running autonomous sweep for company: ${company.name} (${company.id})`);
                const sweepResult = await recruitmentAgentService.planSweep({
                    companyId: company.id,
                    requestedTaskType,
                    userId: 'AUTONOMOUS_SYSTEM_AGENT'
                });

                summaryReport.companiesProcessed++;
                summaryReport.companyResults.push({
                    companyId: company.id,
                    companyName: company.name,
                    executedTasks: sweepResult.plannedTasks,
                    results: sweepResult.results?.map(r => ({ taskType: r.taskType, status: r.status }))
                });
            } catch (compErr) {
                logger.error(`[Agent-Scheduler] Error processing company ${company.id}:`, compErr.message);
                summaryReport.errors.push({
                    companyId: company.id,
                    error: compErr.message
                });
            }
        }

        const duration = Date.now() - startTime;
        logger.info(`[Agent-Scheduler] ✅ Autonomous sweep finished in ${duration}ms. Processed: ${summaryReport.companiesProcessed}/${activeCompanies.length} companies.`);
        summaryReport.durationMs = duration;
        summaryReport.completedAt = new Date().toISOString();
        summaryReport.status = 'COMPLETED';

        return summaryReport;
    } catch (globalErr) {
        logger.error('[Agent-Scheduler] Critical error during autonomous sweep:', globalErr.message);
        summaryReport.status = 'FAILED';
        summaryReport.globalError = globalErr.message;
        return summaryReport;
    } finally {
        isAgentSweepRunning = false;
    }
};

/**
 * Start the autonomous Agent Cron Job Scheduler
 * Schedule intervals:
 * 1. Daily Sweep at 08:00 AM (Asia/Riyadh) for:
 *    - STALLED_JOBS (Monitors jobs with 0 applicants or inactivity > 7 days)
 *    - CANDIDATE_FOLLOWUP (Detects candidates stuck > 5 days)
 *    - TOP_CANDIDATES (Ranks top 5 interview-ready candidates)
 * 2. Weekly Hiring Report:
 *    - Every Sunday at 07:00 AM (Asia/Riyadh) (cron: 0 7 * * 0)
 */
export const startRecruitmentAgentJob = () => {
    // 1. Daily Autonomous Sweep at 08:00 AM
    schedule('0 8 * * *', async () => {
        logger.info('[Agent Cron] ⏰ Triggering Daily Autonomous Recruitment Sweep (08:00 AM)...');
        try {
            await runAutonomousAgentSweep({ requestedTaskType: 'ALL', triggerSource: 'DAILY_CRON_08AM' });
        } catch (err) {
            logger.error('[Agent Cron] Daily Sweep execution failed:', err.message);
        }
    }, {
        scheduled: true,
        timezone: 'Asia/Riyadh'
    });

    // 2. Weekly Hiring Report on Sunday morning at 07:00 AM
    schedule('0 7 * * 0', async () => {
        logger.info('[Agent Cron] 📊 Triggering Weekly Hiring Report Generation (Sunday 07:00 AM)...');
        try {
            await runAutonomousAgentSweep({ requestedTaskType: 'WEEKLY_REPORT', triggerSource: 'WEEKLY_SUNDAY_CRON' });
        } catch (err) {
            logger.error('[Agent Cron] Weekly Report generation failed:', err.message);
        }
    }, {
        scheduled: true,
        timezone: 'Asia/Riyadh'
    });

    logger.info('[Agent Cron] Autonomous Recruitment Agent Scheduler initialized:');
    logger.info('  - Daily Sweep (Stalled Jobs, Candidate Follow-ups, Top 5): Every day at 08:00 AM (Asia/Riyadh)');
    logger.info('  - Weekly Hiring Report: Every Sunday at 07:00 AM (Asia/Riyadh)');
};

export default startRecruitmentAgentJob;
