import prisma from '../src/config/db.js';

async function initCopilotTables() {
    console.log('Connecting to database to ensure Copilot tables exist...');
    try {
        await prisma.$executeRawUnsafe(`
            CREATE TABLE IF NOT EXISTS copilotsession (
                id TEXT PRIMARY KEY,
                "companyId" TEXT NOT NULL,
                "userId" TEXT NOT NULL,
                title TEXT NOT NULL,
                conversation JSONB DEFAULT '[]'::jsonb,
                "extractedData" JSONB,
                "marketInsights" JSONB,
                "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
                "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
            );
        `);

        await prisma.$executeRawUnsafe(`
            CREATE TABLE IF NOT EXISTS airecommendation (
                id TEXT PRIMARY KEY,
                "companyId" TEXT NOT NULL,
                "sessionId" TEXT,
                "candidateId" TEXT NOT NULL,
                "jobId" TEXT,
                "matchScore" DOUBLE PRECISION NOT NULL,
                "interviewScore" DOUBLE PRECISION,
                "salaryFit" TEXT,
                "scoringBreakdown" JSONB,
                strengths JSONB DEFAULT '[]'::jsonb,
                risks JSONB DEFAULT '[]'::jsonb,
                recommendation TEXT NOT NULL DEFAULT 'HIRE',
                reason TEXT,
                "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
            );
        `);

        await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "copilotsession_companyId_idx" ON copilotsession ("companyId");`);
        await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "copilotsession_userId_idx" ON copilotsession ("userId");`);
        await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "airecommendation_companyId_idx" ON airecommendation ("companyId");`);
        await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "airecommendation_sessionId_idx" ON airecommendation ("sessionId");`);

        console.log('✅ Copilot tables verified and created successfully!');
    } catch (err) {
        console.error('❌ Failed creating tables:', err);
    } finally {
        await prisma.$disconnect();
    }
}


initCopilotTables();
