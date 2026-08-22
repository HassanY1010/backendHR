import prisma from '../src/config/db.js';

async function migrate() {
    try {
        console.log('Adding jobId column to candidate_application table...');
        await prisma.$executeRawUnsafe(`ALTER TABLE candidate_application ADD COLUMN IF NOT EXISTS "jobId" TEXT REFERENCES recruitmentjob(id) ON DELETE SET NULL;`);
        console.log('✅ CandidateApplication migration succeeded.');
    } catch (e) {
        console.error('Migration error:', e);
    } finally {
        process.exit(0);
    }
}

migrate();
