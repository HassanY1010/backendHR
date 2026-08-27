import crypto from 'crypto';
import prisma from '../config/db.js';

async function testRaceConditionAndOneTime() {
  console.log('=== TEST: Concurrent Session Creation & Atomic Protection ===\n');

  const candidate = await prisma.candidate.findFirst();
  if (!candidate) {
    console.error('No candidate found in DB to test.');
    process.exit(1);
  }

  const rawToken1 = crypto.randomBytes(32).toString('hex');
  const tokenHash1 = crypto.createHash('sha256').update(rawToken1).digest('hex');

  const rawToken2 = crypto.randomBytes(32).toString('hex');
  const tokenHash2 = crypto.createHash('sha256').update(rawToken2).digest('hex');

  // 1. Clean previous test practice sessions for this candidate if any
  await prisma.practiceSession.deleteMany({
    where: { candidateId: candidate.id }
  });

  console.log('1. Attempting 2 concurrent session creations for candidate:', candidate.id);

  // Helper create with check
  async function createPracticeSessionSafe(tokenHash) {
    return await prisma.$transaction(async (tx) => {
      const existing = await tx.practiceSession.findFirst({
        where: { candidateId: candidate.id }
      });
      if (existing) {
        throw new Error('PRACTICE_ALREADY_EXISTS');
      }
      return await tx.practiceSession.create({
        data: {
          candidateId: candidate.id,
          tokenHash,
          status: 'ACTIVE',
          expiresAt: new Date(Date.now() + 3600000)
        }
      });
    });
  }

  const results = await Promise.allSettled([
    createPracticeSessionSafe(tokenHash1),
    createPracticeSessionSafe(tokenHash2)
  ]);

  const fulfilled = results.filter(r => r.status === 'fulfilled');
  const rejected = results.filter(r => r.status === 'rejected');

  console.log('Fulfilled creations:', fulfilled.length);
  console.log('Rejected creations:', rejected.length);

  if (fulfilled.length === 1 && rejected.length === 1) {
    console.log('✅ CONCURRENCY TEST PASSED: Exactly one session succeeded, second blocked atomically.');
  } else {
    console.error('❌ CONCURRENCY TEST FAILED:', results);
  }

  // Cleanup
  await prisma.practiceSession.deleteMany({
    where: { candidateId: candidate.id }
  });

  console.log('Test cleanup complete.\n');
  process.exit(0);
}

testRaceConditionAndOneTime().catch(err => {
  console.error(err);
  process.exit(1);
});
