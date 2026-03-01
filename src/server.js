import 'dotenv/config';
import app from './app.js';
import { startDeadlineChecker } from './jobs/deadlineChecker.js';
import { QueueService } from './services/queue.service.js';
import { initClamAV } from './utils/virusScanner.js';
import logger from './utils/logger.js';

const PORT = process.env.PORT || 4000;

// Initialize Background Services
QueueService.init();

// Initialize ClamAV (production only)
initClamAV().catch(err => {
    logger.error('⚠️ ClamAV initialization failed', { error: err.message });
});

app.listen(PORT, () => {
    logger.info(`🚀 Server is running on port ${PORT}`);
    startDeadlineChecker();
    logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
});
