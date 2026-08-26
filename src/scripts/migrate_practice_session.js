import prisma from '../config/db.js';

async function main() {
  try {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS practicesession (
        "id" TEXT NOT NULL,
        "candidateId" TEXT NOT NULL,
        "schedulingSessionId" TEXT,
        "tokenHash" TEXT NOT NULL,
        "duration" INTEGER,
        "overallScore" DOUBLE PRECISION,
        "communicationScore" DOUBLE PRECISION,
        "answerScore" DOUBLE PRECISION,
        "voiceScore" DOUBLE PRECISION,
        "visualScore" DOUBLE PRECISION,
        "confidenceIndicators" JSONB,
        "feedback" JSONB,
        "answersData" JSONB,
        "status" TEXT NOT NULL DEFAULT 'ACTIVE',
        "expiresAt" TIMESTAMP(3) NOT NULL,
        "startedAt" TIMESTAMP(3),
        "completedAt" TIMESTAMP(3),
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

        CONSTRAINT "practicesession_pkey" PRIMARY KEY ("id"),
        CONSTRAINT "practicesession_tokenHash_key" UNIQUE ("tokenHash"),
        CONSTRAINT "practicesession_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "candidate"("id") ON DELETE CASCADE ON UPDATE CASCADE,
        CONSTRAINT "practicesession_schedulingSessionId_fkey" FOREIGN KEY ("schedulingSessionId") REFERENCES "schedulingsession"("id") ON DELETE SET NULL ON UPDATE CASCADE
      );
    `);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "practicesession_candidateId_idx" ON "practicesession"("candidateId");`);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "practicesession_tokenHash_idx" ON "practicesession"("tokenHash");`);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "practicesession_status_idx" ON "practicesession"("status");`);
    console.log('✅ Table practicesession created and indexes verified successfully.');
  } catch (err) {
    console.error('Error creating table:', err);
  } finally {
    await prisma.$disconnect();
  }
}

main();
