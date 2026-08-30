import { slaService } from '../services/sla.service.js';
import { runDeadlineChecker } from '../jobs/deadlineChecker.js';
import { purgeExpiredRetentionData } from './ai-shield.controller.js';
import logger from '../utils/logger.js';

export const handleCronTrigger = async (req, res) => {
    const startTime = Date.now();
    logger.info('[CRON] Scheduled background job trigger received');

    try {
        // Execute background tasks safely
        const [slaResult, deadlineResult, aiShieldRetentionResult] = await Promise.allSettled([
            slaService.checkSLABreaches(),
            runDeadlineChecker(),
            purgeExpiredRetentionData()
        ]);

        const duration = Date.now() - startTime;
        logger.info(`[CRON] Scheduled jobs completed in ${duration}ms`);

        return res.status(200).json({
            status: 'ok',
            message: 'Cron tasks executed successfully',
            executionTimeMs: duration,
            results: {
                sla: slaResult.status === 'fulfilled' ? slaResult.value : { error: slaResult.reason?.message },
                deadlines: deadlineResult.status === 'fulfilled' ? deadlineResult.value : { error: deadlineResult.reason?.message },
                aiShieldRetention: aiShieldRetentionResult.status === 'fulfilled' ? aiShieldRetentionResult.value : { error: aiShieldRetentionResult.reason?.message }
            },
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        logger.error('[CRON] Unexpected error during cron execution:', { error: error.message });
        return res.status(500).json({
            status: 'error',
            message: 'Internal error during cron execution'
        });
    }
};
