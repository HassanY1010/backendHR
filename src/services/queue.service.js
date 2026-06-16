import 'dotenv/config';
import { Queue, Worker } from 'bullmq';
import { aiService } from '../ai/ai-service.js';
import { auditService } from './audit.service.js';
import { SearchService } from './search.service.js';
import prisma from '../config/db.js';
import logger from '../utils/logger.js';

// ============================================================================
// In-Memory Queue Fallback (when Redis is unavailable)
// ============================================================================

class InMemoryQueue {
    constructor() {
        this.jobs = [];
        this.processing = false;
    }

    add(name, data, opts = {}) {
        const job = { id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`, name, data, opts };
        this.jobs.push(job);
        logger.info(`📥 [InMemoryQueue] Job queued: ${name}`, { jobId: job.id });
        this._processNext();
        return job;
    }

    async _processNext() {
        if (this.processing || this.jobs.length === 0) return;
        this.processing = true;

        while (this.jobs.length > 0) {
            const job = this.jobs.shift();
            try {
                logger.info(`⚙️ [InMemoryQueue] Processing ${job.name}...`, { jobId: job.id });
                await processJob(job);
                logger.info(`✅ [InMemoryQueue] ${job.name} completed`, { jobId: job.id });
            } catch (err) {
                logger.error(`❌ [InMemoryQueue] ${job.name} failed`, { jobId: job.id, error: err.message });
            }
        }

        this.processing = false;
    }
}

// ============================================================================
// Redis Connection Options
// ============================================================================

const parseRedisUrl = (url) => {
    try {
        const parsed = new URL(url);
        const isTLS = parsed.protocol === 'rediss:';
        return {
            host: parsed.hostname,
            port: parseInt(parsed.port) || 6379,
            password: parsed.password ? decodeURIComponent(parsed.password) : undefined,
            ...(isTLS && { tls: {} }),
            maxRetriesPerRequest: null,
            enableReadyCheck: false,
        };
    } catch {
        return null;
    }
};

const getRedisConnection = () => {
    const url = process.env.REDIS_PUBLIC_URL || process.env.REDIS_URL;

    if (url && url !== 'undefined') {
        const parsed = parseRedisUrl(url);
        if (parsed) {
            logger.info('🔗 Redis: Initializing BullMQ', { host: parsed.host, tls: !!parsed.tls });
            return parsed;
        }
        logger.warn('⚠️ Redis URL invalid — using in-memory queue fallback');
        return null;
    }

    const isCloud = !!process.env.RAILWAY_ENVIRONMENT || !!process.env.RENDER_EXTERNAL_URL || process.env.NODE_ENV === 'production';
    if (isCloud) {
        logger.warn('⚠️ Redis URL missing in cloud environment — using in-memory queue fallback');
        return null;
    }

    const host = process.env.REDISHOST || process.env.REDIS_HOST || 'localhost';
    const port = parseInt(process.env.REDISPORT || process.env.REDIS_PORT || '6379');
    const password = process.env.REDISPASSWORD || process.env.REDIS_PASSWORD;

    logger.info('🔗 Redis: Attempting local connection for development', { host, port });
    return { host, port, password };
};

const QUEUE_NAME = 'background-jobs';

/**
 * Process a job by name
 */
async function processJob(job) {
    switch (job.name) {
        case 'indexDetail':
            await SearchService.indexDocument(job.data);
            break;
        case 'logAudit':
            await auditService.log(job.data);
            break;
        case 'generateTrainingPlan':
            await QueueService.handleTrainingPlan(job.data);
            break;
        default:
            logger.warn(`Unknown job type: ${job.name}`, { jobName: job.name });
    }
}

/**
 * Queue Service
 * Handles all background asynchronous processing
 * Falls back to in-memory queue when Redis is unavailable
 */
export const QueueService = {
    queue: null,
    worker: null,

    init: () => {
        if (QueueService.queue) return;

        const connection = getRedisConnection();

        if (!connection) {
            logger.info('📦 Redis not configured — using in-memory queue fallback');
            QueueService.queue = new InMemoryQueue();
            return;
        }

        logger.info('🚀 Initializing BullMQ Job Queue...', {
            host: connection.host
        });

        try {
            QueueService.queue = new Queue(QUEUE_NAME, { connection });

            QueueService.worker = new Worker(
                QUEUE_NAME,
                async (job) => {
                    logger.info(`[BullMQ Job ${job.id}] Processing ${job.name}...`, { jobId: job.id, jobName: job.name });
                    try {
                        await processJob(job);
                        logger.info(`[BullMQ Job ${job.id}] Completed`, { jobId: job.id });
                    } catch (error) {
                        logger.error(`[BullMQ Job ${job.id}] Failed`, { jobId: job.id, error: error.message });
                        throw error;
                    }
                },
                { connection }
            );

            QueueService.worker.on('failed', (job, err) => {
                logger.error(`[BullMQ Job ${job.id}] Failed completely`, { jobId: job.id, error: err.message });
            });

            QueueService.queue.on('error', (err) => {
                if (err.message?.includes('No ready connection')) return;
                logger.error('❌ BullMQ Queue error — falling back to in-memory queue', { error: err.message });
                QueueService._fallback();
            });

            QueueService.worker.on('error', (err) => {
                if (err.message?.includes('No ready connection')) return;
                logger.error('❌ BullMQ Worker error — falling back to in-memory queue', { error: err.message });
                QueueService._fallback();
            });
        } catch (err) {
            logger.error('❌ BullMQ initialization failed — falling back to in-memory queue', { error: err.message });
            QueueService._fallback();
        }
    },

    _fallback: () => {
        try { QueueService.worker?.close(); } catch {}
        try { QueueService.queue?.close(); } catch {}
        QueueService.worker = null;
        QueueService.queue = new InMemoryQueue();
        logger.info('📦 Switched to in-memory queue after BullMQ failure');
    },

    addJob: async (name, data, opts = {}) => {
        if (!QueueService.queue) QueueService.init();
        return await QueueService.queue.add(name, data, {
            removeOnComplete: true,
            removeOnFail: 5000,
            ...opts
        });
    },

    handleTrainingPlan: async ({ assignmentId, courseId, employeeId }) => {
        const assignment = await prisma.trainingAssignment.findUnique({
            where: { id: assignmentId },
            include: { course: true, employee: { include: { user: true } } }
        });

        if (!assignment) return;

        const [trainingPlan, quiz] = await Promise.all([
            aiService.generateTrainingPlan(assignment.course, {
                name: assignment.employee.user.name,
                position: assignment.employee.position
            }),
            aiService.generateQuiz(assignment.course)
        ]);

        await prisma.trainingAssignment.update({
            where: { id: assignmentId },
            data: {
                trainingPlan: JSON.stringify(trainingPlan),
                quiz: JSON.stringify(quiz)
            }
        });
    }
};