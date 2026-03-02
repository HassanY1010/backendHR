import 'dotenv/config';
import { Queue, Worker } from 'bullmq';
import { aiService } from '../ai/ai-service.js';
import { auditService } from './audit.service.js';
import { SearchService } from './search.service.js';
import prisma from '../config/db.js';
import logger from '../utils/logger.js';

// Redis Connection Options
// Redis Connection Options
const getRedisConnection = () => {
    const url = process.env.NODE_ENV === 'production' 
        ? process.env.REDIS_PUBLIC_URL 
        : process.env.REDIS_URL;

    if (url && url !== 'undefined') {
        logger.info('🔗 Redis: Initializing BullMQ with URL');
        return url;
    }

    const host = process.env.REDISHOST || process.env.REDIS_HOST;
    const port = process.env.REDISPORT || process.env.REDIS_PORT;
    const password = process.env.REDISPASSWORD || process.env.REDIS_PASSWORD;

    const isProd = process.env.NODE_ENV === 'production' || !!process.env.RAILWAY_ENVIRONMENT;

    if (isProd && (!host || host === 'localhost' || host === '127.0.0.1')) {
        // بدلاً من محاولة الاتصال بالـ localhost وفشلها، نرسل كائن Dummy لتجنب الرسائل المزعجة
        return { host: 'DUMMY_PRODUCTION_REDIS_FAILURE', port: 6379, password: '' };
    }

    return {
        host: host || 'localhost',
        port: parseInt(port || '6379'),
        password,
    };
};

const QUEUE_NAME = 'background-jobs';

/**
 * Queue Service
 * Handles all background asynchronous processing
 */
export const QueueService = {
    queue: null,
    worker: null,

    init: () => {
        if (QueueService.queue) return;

        const connection = getRedisConnection();
        logger.info('🚀 Initializing Job Queue...', {
            host: typeof connection === 'string' ? 'URL' : connection.host
        });

        // 1. Create Producer Queue
        QueueService.queue = new Queue(QUEUE_NAME, { connection });

        // 2. Create Consumer Worker
        QueueService.worker = new Worker(QUEUE_NAME, async (job) => {
            logger.info(`[Job ${job.id}] Processing ${job.name}...`, { jobId: job.id, jobName: job.name });

            try {
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
                logger.info(`[Job ${job.id}] Completed`, { jobId: job.id });
            } catch (error) {
                logger.error(`[Job ${job.id}] Failed`, { jobId: job.id, error: error.message });
                throw error; // Retry mechanism kicks in
            }

        }, { connection });

        QueueService.worker.on('failed', (job, err) => {
            logger.error(`[Job ${job.id}] Failed completely`, { jobId: job.id, error: err.message });
        });
    },

    /**
     * Add a job to the queue
     * @param {string} name 
     * @param {object} data 
     * @param {object} opts 
     */
    addJob: async (name, data, opts = {}) => {
        if (!QueueService.queue) QueueService.init();
        return await QueueService.queue.add(name, data, {
            removeOnComplete: true,
            removeOnFail: 5000,
            ...opts
        });
    },

    /**
     * Specialized Processor: Training Plan Generation
     */
    handleTrainingPlan: async ({ assignmentId, courseId, employeeId }) => {

        // Fetch fresh data
        const assignment = await prisma.trainingAssignment.findUnique({
            where: { id: assignmentId },
            include: {
                course: true,
                employee: { include: { user: true } }
            }
        });

        if (!assignment) return;

        // Perform potentially slow AI ops
        const [trainingPlan, quiz] = await Promise.all([
            aiService.generateTrainingPlan(assignment.course, {
                name: assignment.employee.user.name,
                position: assignment.employee.position
            }),
            aiService.generateQuiz(assignment.course)
        ]);

        // Update DB
        await prisma.trainingAssignment.update({
            where: { id: assignmentId },
            data: {
                trainingPlan: JSON.stringify(trainingPlan),
                quiz: JSON.stringify(quiz),
                // Mark as ready or notify user here if needed
                // For now, it just enriches the existing record
            }
        });

        // Indexing happens here too if needed, or separately
    }
};
