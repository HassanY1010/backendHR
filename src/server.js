import 'dotenv/config';
import app from './app.js';
import { startDeadlineChecker } from './jobs/deadlineChecker.js';
import { startSLACheckerJob } from './jobs/sla-checker.job.js';
import { QueueService } from './services/queue.service.js';
import { initClamAV } from './utils/virusScanner.js';
import logger from './utils/logger.js';

// Catch process errors to prevent unexpected container exits
process.on('uncaughtException', (err) => {
    logger.error('💥 UNCAUGHT EXCEPTION! Error:', { error: err?.message || err, stack: err?.stack });
});

process.on('unhandledRejection', (err) => {
    logger.error('💥 UNHANDLED REJECTION! Error:', { error: err?.message || err });
});

const PORT = process.env.PORT || 4000;

// Initialize Background Services
try {
    QueueService.init();
} catch (qErr) {
    logger.error('QueueService initialization error:', qErr.message);
}

// Initialize ClamAV (production only)
initClamAV().catch(err => {
    logger.error('⚠️ ClamAV initialization failed', { error: err.message });
});

app.listen(PORT, () => {
    logger.info(`🚀 Server is running on port ${PORT}`);
    try {
        startDeadlineChecker();
        startSLACheckerJob();
    } catch (jErr) {
        logger.error('Job initialization error:', jErr.message);
    }
    logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
});
