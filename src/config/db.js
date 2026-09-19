import pkg from '@prisma/client';
const { PrismaClient } = pkg;
import crypto from 'crypto';
import dotenv from 'dotenv';
dotenv.config();

const globalForPrisma = globalThis;
const prismaClient = globalForPrisma.prisma || new PrismaClient({
    datasources: {
        db: {
            url: process.env.DATABASE_URL
        }
    },
    log: ['error']
});
globalForPrisma.prisma = prismaClient;

/**
 * Executes a database operation with retries for transient pooler connection resets.
 */
const executeWithRetry = async (fn, maxRetries = 4, delayMs = 1000) => {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            return await fn();
        } catch (error) {
            const isTransient = error.message && (
                error.message.includes('Can\'t reach database server') ||
                error.message.includes('ConnectionReset') ||
                error.message.includes('connection was forcibly closed') ||
                error.message.includes('Timed out fetching a new connection')
            );
            if (isTransient && attempt < maxRetries) {
                await new Promise(res => setTimeout(res, delayMs * attempt));
                continue;
            }
            throw error;
        }
    }
};

/**
 * Recursively injects UUIDs into any object lacking an 'id' within a 'create' context.
 */
const injectIds = (obj) => {
    if (!obj || typeof obj !== 'object') return;

    if (Array.isArray(obj)) {
        obj.forEach(injectIds);
        return;
    }

    // List of Prisma reserved keys that indicate a relation wrapper or operation object
    const reservedKeys = ['create', 'connect', 'connectOrCreate', 'createMany', 'upsert', 'update', 'updateMany', 'delete', 'deleteMany', 'set', 'disconnect', 'where', 'select', 'include'];

    const hasReservedKey = Object.keys(obj).some(k => reservedKeys.includes(k));

    // Heuristic: If this object is being created and lacks an ID, inject one.
    if (!obj.id && !hasReservedKey) {
        const keys = Object.keys(obj);
        if (keys.length > 0) {
            obj.id = crypto.randomUUID();
        }
    }

    // Recurse into nested properties
    Object.keys(obj).forEach(key => {
        if (obj[key] && typeof obj[key] === 'object') {
            injectIds(obj[key]);
        }
    });
};

// Models that support soft delete (have deletedAt field)
const SOFT_DELETE_MODELS = [
    'User', 'Employee', 'Candidate', 'RecruitmentJob',
    'Project', 'Task', 'TrainingCourse', 'TrainingAssignment',
    'CheckInAssessment'
];

const isSoftDeleteModel = (model) => SOFT_DELETE_MODELS.includes(model);

const prisma = prismaClient.$extends({
    query: {
        $allModels: {
            // Automatic Soft Delete Filter for READ operations
            async findMany({ model, args, query }) {
                if (isSoftDeleteModel(model)) {
                    args.where = { ...args.where, deletedAt: null };
                }
                return executeWithRetry(() => query(args));
            },
            async findFirst({ model, args, query }) {
                if (isSoftDeleteModel(model)) {
                    args.where = { ...args.where, deletedAt: null };
                }
                return executeWithRetry(() => query(args));
            },
            async count({ model, args, query }) {
                if (isSoftDeleteModel(model)) {
                    args.where = { ...args.where, deletedAt: null };
                }
                return executeWithRetry(() => query(args));
            },
            async findUnique({ model, args, query }) {
                // Prisma findUnique doesn't support complex where clauses (must be ID/Unique fields)
                // We convert it to findFirst to allow filtering by deletedAt: null
                if (isSoftDeleteModel(model)) {
                    args.where = { ...args.where, deletedAt: null };
                    return executeWithRetry(() => prismaClient[model].findFirst(args));
                }
                return executeWithRetry(() => query(args));
            },

            // Convert DELETE to SOFT DELETE (Update)
            async delete({ model, args, query }) {
                if (isSoftDeleteModel(model)) {
                    return executeWithRetry(() => prismaClient[model].update({
                        where: args.where,
                        data: { deletedAt: new Date() }
                    }));
                }
                return executeWithRetry(() => query(args));
            },
            async deleteMany({ model, args, query }) {
                if (isSoftDeleteModel(model)) {
                    return executeWithRetry(() => prismaClient[model].updateMany({
                        where: args.where,
                        data: { deletedAt: new Date() }
                    }));
                }
                return executeWithRetry(() => query(args));
            },

            // ID Injection for CREATE operations
            async create({ args, query }) {
                injectIds(args.data);
                return executeWithRetry(() => query(args));
            },
            async createMany({ args, query }) {
                if (Array.isArray(args.data)) {
                    args.data.forEach(item => {
                        if (!item.id) item.id = crypto.randomUUID();
                    });
                } else if (args.data && typeof args.data === 'object') {
                    if (!args.data.id) args.data.id = crypto.randomUUID();
                }
                return executeWithRetry(() => query(args));
            },
            async upsert({ args, query }) {
                if (args.create) injectIds(args.create);
                return executeWithRetry(() => query(args));
            },
            async update({ args, query }) {
                return executeWithRetry(() => query(args));
            },
            async updateMany({ args, query }) {
                return executeWithRetry(() => query(args));
            }
        }
    }
});

export default prisma;

