import prisma from '../src/config/db.js';

async function migrate() {
    try {
        console.log('Adding columns to candidate table...');
        await prisma.$executeRawUnsafe(`ALTER TABLE candidate ADD COLUMN IF NOT EXISTS "salaryExpectation" DOUBLE PRECISION;`);
        await prisma.$executeRawUnsafe(`ALTER TABLE candidate ADD COLUMN IF NOT EXISTS availability TEXT;`);
        
        console.log('Creating candidate_note table...');
        await prisma.$executeRawUnsafe(`
            CREATE TABLE IF NOT EXISTS candidate_note (
                id TEXT PRIMARY KEY,
                "candidateId" TEXT NOT NULL REFERENCES candidate(id) ON DELETE CASCADE,
                "authorId" TEXT,
                "authorName" TEXT,
                content TEXT NOT NULL,
                "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            );
        `);
        console.log('✅ Migration succeeded.');
    } catch (e) {
        console.error('Migration error:', e);
    } finally {
        process.exit(0);
    }
}

migrate();
