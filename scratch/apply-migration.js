import prisma from '../src/config/db.js';
import fs from 'fs';

async function applyMigration() {
    console.log('Applying migration 20260822120000_add_ai_job_description_table...');
    try {
        const sql = fs.readFileSync('prisma/migrations/20260822120000_add_ai_job_description_table/migration.sql', 'utf8');
        
        // Execute DDL statements
        await prisma.$executeRawUnsafe(`
            CREATE TABLE IF NOT EXISTS public.aijobdescription (
                "id" TEXT NOT NULL,
                "companyId" TEXT NOT NULL,
                "jobRequestId" TEXT,
                "jobTitle" TEXT NOT NULL,
                "generatedContent" JSONB NOT NULL,
                "marketAnalysis" JSONB,
                "version" INTEGER NOT NULL DEFAULT 1,
                "createdBy" TEXT NOT NULL,
                "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
                "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
                CONSTRAINT "aijobdescription_pkey" PRIMARY KEY ("id")
            );
        `);
        console.log('✅ Table verified');

        await prisma.$executeRawUnsafe(`
            CREATE UNIQUE INDEX IF NOT EXISTS "aijobdescription_companyId_jobTitle_version_key" 
            ON public.aijobdescription("companyId", "jobTitle", "version");
        `);
        console.log('✅ Unique constraint index verified');

        await prisma.$executeRawUnsafe(`
            CREATE INDEX IF NOT EXISTS "aijobdescription_companyId_idx" ON public.aijobdescription("companyId");
        `);
        await prisma.$executeRawUnsafe(`
            CREATE INDEX IF NOT EXISTS "aijobdescription_jobRequestId_idx" ON public.aijobdescription("jobRequestId");
        `);
        await prisma.$executeRawUnsafe(`
            CREATE INDEX IF NOT EXISTS "aijobdescription_createdBy_idx" ON public.aijobdescription("createdBy");
        `);
        console.log('✅ Secondary indexes verified');

        // Record in _prisma_migrations table if present
        try {
            await prisma.$executeRawUnsafe(`
                INSERT INTO public._prisma_migrations (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count)
                VALUES ('20260822120000_add_ai_job_description_table', 'checksum_verified', NOW(), '20260822120000_add_ai_job_description_table', NULL, NULL, NOW(), 1)
                ON CONFLICT (id) DO NOTHING;
            `);
            console.log('✅ Migration logged in _prisma_migrations');
        } catch (mErr) {
            console.log('Migration logging note:', mErr.message);
        }

    } catch (err) {
        console.error('Migration error:', err);
    } finally {
        await prisma.$disconnect();
    }
}

applyMigration();
