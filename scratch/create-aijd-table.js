import prisma from '../src/config/db.js';

async function createTable() {
    console.log('Creating aijobdescription table...');
    try {
        await prisma.$executeRawUnsafe(`
            CREATE TABLE IF NOT EXISTS public.aijobdescription (
                id TEXT PRIMARY KEY,
                "companyId" TEXT NOT NULL,
                "jobRequestId" TEXT,
                "jobTitle" TEXT NOT NULL,
                "generatedContent" JSONB NOT NULL,
                "marketAnalysis" JSONB,
                version INTEGER NOT NULL DEFAULT 1,
                "createdBy" TEXT NOT NULL,
                "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
                "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
            );
        `);
        console.log('✅ TABLE public.aijobdescription CREATED');

        await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "aijobdescription_companyId_idx" ON public.aijobdescription("companyId");`);
        await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "aijobdescription_jobRequestId_idx" ON public.aijobdescription("jobRequestId");`);
        await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "aijobdescription_createdBy_idx" ON public.aijobdescription("createdBy");`);
        console.log('✅ INDEXES CREATED');
    } catch (err) {

        console.error('Error creating table:', err);
    } finally {
        await prisma.$disconnect();
    }
}

createTable();
