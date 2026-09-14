import prisma from '../src/config/db.js';

async function initAgentTables() {
    console.log('Ensuring AgentTask and AgentLog tables exist in DB...');
    try {
        await prisma.$executeRawUnsafe(`
            DO $$ BEGIN
                CREATE TYPE agent_task_status AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED');
            EXCEPTION
                WHEN duplicate_object THEN null;
            END $$;
        `);

        await prisma.$executeRawUnsafe(`
            DO $$ BEGIN
                CREATE TYPE agent_action_status AS ENUM ('RECOMMENDED', 'APPROVED', 'EXECUTED', 'REJECTED', 'FAILED');
            EXCEPTION
                WHEN duplicate_object THEN null;
            END $$;
        `);

        await prisma.$executeRawUnsafe(`
            CREATE TABLE IF NOT EXISTS agenttask (
                id TEXT PRIMARY KEY,
                "companyId" TEXT NOT NULL,
                "agentType" TEXT NOT NULL DEFAULT 'RECRUITMENT',
                "taskType" TEXT NOT NULL,
                title TEXT NOT NULL,
                description TEXT,
                status agent_task_status NOT NULL DEFAULT 'PENDING',
                priority TEXT NOT NULL DEFAULT 'MEDIUM',
                result JSONB,
                "errorReason" TEXT,
                "idempotencyKey" TEXT,
                "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
                "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
                "completedAt" TIMESTAMP(3)
            );
        `);

        await prisma.$executeRawUnsafe(`
            CREATE TABLE IF NOT EXISTS agentlog (
                id TEXT PRIMARY KEY,
                "companyId" TEXT NOT NULL,
                "taskId" TEXT,
                action TEXT NOT NULL,
                "actionStatus" agent_action_status NOT NULL DEFAULT 'RECOMMENDED',
                input JSONB,
                output JSONB,
                evidence JSONB,
                "performedBy" TEXT,
                "errorMessage" TEXT,
                timestamp TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
            );
        `);

        await prisma.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "agenttask_companyId_idempotencyKey_key" ON agenttask ("companyId", "idempotencyKey");`);
        await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "agenttask_companyId_idx" ON agenttask ("companyId");`);
        await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "agenttask_status_idx" ON agenttask ("status");`);
        await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "agenttask_taskType_idx" ON agenttask ("taskType");`);
        await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "agenttask_createdAt_idx" ON agenttask ("createdAt");`);

        await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "agentlog_companyId_idx" ON agentlog ("companyId");`);
        await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "agentlog_taskId_idx" ON agentlog ("taskId");`);
        await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "agentlog_action_idx" ON agentlog ("action");`);
        await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "agentlog_actionStatus_idx" ON agentlog ("actionStatus");`);
        await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "agentlog_timestamp_idx" ON agentlog ("timestamp");`);

        console.log('✅ AgentTask and AgentLog tables verified and ready!');
    } catch (err) {
        console.error('❌ Failed creating agent tables:', err.message);
    } finally {
        await prisma.$disconnect();
    }
}

initAgentTables();
