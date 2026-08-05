import { schedule } from 'node-cron';
import { slaService } from '../services/sla.service.js';
import logger from '../utils/logger.js';

/**
 * SLA Checker Cron Job
 * Runs every 15 minutes to detect SLA breaches and send escalations
 */
export const startSLACheckerJob = () => {
    // Every 15 minutes
    schedule('*/15 * * * *', async () => {
        logger.info('[SLA Cron] Starting SLA breach check...');
        try {
            const result = await slaService.checkSLABreaches();
            logger.info(`[SLA Cron] Completed — checked ${result?.checked || 0} steps`);
        } catch (error) {
            logger.error('[SLA Cron] Failed:', error.message);
        }
    }, {
        scheduled: true,
        timezone: 'Asia/Riyadh'
    });

    logger.info('[SLA Cron] SLA Checker job scheduled (every 15 minutes)');
};

export default startSLACheckerJob;
