import crypto from 'crypto';
import prisma from '../config/db.js';

async function generateDemoTokens() {
  const candidate = await prisma.candidate.findFirst({
    include: { recruitmentjob: true }
  });

  if (!candidate) {
    console.log('No candidate found.');
    process.exit(1);
  }

  // 1. Practice Session Token
  const rawPracticeToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(rawPracticeToken).digest('hex');

  // Remove any previous active test session
  await prisma.practiceSession.deleteMany({
    where: { candidateId: candidate.id }
  });

  await prisma.practiceSession.create({
    data: {
      candidateId: candidate.id,
      tokenHash,
      status: 'ACTIVE',
      expiresAt: new Date(Date.now() + 7 * 24 * 3600000) // 7 days
    }
  });

  // 2. Booking Session Token
  const rawBookingToken = crypto.randomBytes(32).toString('hex');
  const bookingTokenHash = crypto.createHash('sha256').update(rawBookingToken).digest('hex');
  
  const company = await prisma.company.findFirst();
  const manager = await prisma.user.findFirst();

  let schedulingSession = await prisma.schedulingSession.findFirst({
    where: { candidateId: candidate.id, status: 'PENDING' }
  });

  if (!schedulingSession && company && manager) {
    schedulingSession = await prisma.schedulingSession.create({
      data: {
        candidateId: candidate.id,
        jobId: candidate.recruitmentJobId,
        companyId: company.id,
        interviewerId: manager.id,
        tokenHash: bookingTokenHash,
        status: 'PENDING',
        expiresAt: new Date(Date.now() + 7 * 24 * 3600000)
      }
    });
  }

  console.log('\n======================================================');
  console.log('🎯 DEMO TESTING LINKS GENERATED FOR CANDIDATE:');
  console.log('Name:', candidate.fullName);
  console.log('Job:', candidate.recruitmentjob?.title || 'عام');
  console.log('======================================================\n');
  console.log('1️⃣ الرابط المباشر لغرفة التدريب (Direct Practice Room):');
  console.log('Local:   http://localhost:5173/practice-interview/' + rawPracticeToken);
  console.log('Render:  https://hr-manager-dashboard.onrender.com/practice-interview/' + rawPracticeToken);
  console.log('======================================================\n');
  process.exit(0);
}

generateDemoTokens().catch(err => {
  console.error(err);
  process.exit(1);
});
