import express from 'express';
import { handleCronTrigger } from '../controllers/cron.controller.js';
import logger from '../utils/logger.js';

const router = express.Router();

export const requireCronSecret = (req, res, next) => {
    const configuredSecret = process.env.CRON_SECRET;
    let providedSecret = null;
    const authHeader = req.headers.authorization;

    if (authHeader && authHeader.startsWith('Bearer ')) {
        providedSecret = authHeader.split(' ')[1];
    } else if (req.headers['x-cron-secret']) {
        providedSecret = req.headers['x-cron-secret'];
    }

    if (!configuredSecret || !providedSecret || providedSecret !== configuredSecret) {
        logger.warn(`[CRON] Unauthorized cron access attempt from IP: ${req.ip}`);
        return res.status(401).json({
            status: 'error',
            message: 'Unauthorized: Invalid or missing cron secret'
        });
    }

    next();
};

// Protected cron execution endpoints
router.post('/trigger', requireCronSecret, handleCronTrigger);
router.get('/trigger', requireCronSecret, handleCronTrigger);

export default router;
