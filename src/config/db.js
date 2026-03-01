import pkg from '@prisma/client';
const { PrismaClient } = pkg;
import crypto from 'crypto';

const prismaClient = new PrismaClient();

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
                return query(args);
            },
            async findFirst({ model, args, query }) {
                if (isSoftDeleteModel(model)) {
                    args.where = { ...args.where, deletedAt: null };
                }
                return query(args);
            },
            async count({ model, args, query }) {
                if (isSoftDeleteModel(model)) {
                    args.where = { ...args.where, deletedAt: null };
                }
                return query(args);
            },
            async findUnique({ model, args, query }) {
                // Prisma findUnique doesn't support complex where clauses (must be ID/Unique fields)
                // We convert it to findFirst to allow filtering by deletedAt: null
                if (isSoftDeleteModel(model)) {
                    args.where = { ...args.where, deletedAt: null };
                    return prismaClient[model].findFirst(args);
                }
                return query(args);
            },

            // Convert DELETE to SOFT DELETE (Update)
            async delete({ model, args, query }) {
                if (isSoftDeleteModel(model)) {
                    return prismaClient[model].update({
                        where: args.where,
                        data: { deletedAt: new Date() }
                    });
                }
                return query(args);
            },
            async deleteMany({ model, args, query }) {
                if (isSoftDeleteModel(model)) {
                    return prismaClient[model].updateMany({
                        where: args.where,
                        data: { deletedAt: new Date() }
                    });
                }
                return query(args);
            },

            // ID Injection for CREATE operations
            async create({ args, query }) {
                injectIds(args.data);
                return query(args);
            },
            async createMany({ args, query }) {
                if (Array.isArray(args.data)) {
                    args.data.forEach(item => {
                        if (!item.id) item.id = crypto.randomUUID();
                    });
                } else if (args.data && typeof args.data === 'object') {
                    if (!args.data.id) args.data.id = crypto.randomUUID();
                }
                return query(args);
            },
            async upsert({ args, query }) {
                if (args.create) injectIds(args.create);
                return query(args);
            }
        }
    }
});

export default prisma;

