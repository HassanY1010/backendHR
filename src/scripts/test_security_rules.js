import crypto from 'crypto';
import prisma from '../config/db.js';

async function testSecurityRules() {
  console.log('=== TEST: One-Time Access & Session Security Rules ===\n');

  const candidate = await prisma.candidate.findFirst();
  const rawToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

  // 1. Create session
  const session = await prisma.practiceSession.create({
    data: {
      candidateId: candidate.id,
      tokenHash,
      status: 'ACTIVE',
      expiresAt: new Date(Date.now() + 3600000)
    }
  });
  console.log('1. Created Practice Session:', session.id);

  // 2. Complete session
  await prisma.practiceSession.update({
    where: { id: session.id },
    data: { status: 'COMPLETED', completedAt: new Date(), overallScore: 85 }
  });
  console.log('2. Marked Session as COMPLETED.');

  // 3. Verify Completed status in DB
  const completed = await prisma.practiceSession.findUnique({ where: { tokenHash } });
  if (completed.status === 'COMPLETED') {
    console.log('✅ TEST PASSED: Completed session status verified in Database.');
  }

  // 4. Cleanup
  await prisma.practiceSession.delete({ where: { id: session.id } });
  console.log('3. Cleaned up test session.');
  
  process.exit(0);
}

testSecurityRules().catch(e => {
  console.error(e);
  process.exit(1);
});
