import crypto from 'crypto';
import prisma from '../config/db.js';

async function main() {
  const candidate = await prisma.candidate.findUnique({
    where: { id: '90550f84-ea3b-4f23-8567-59c541035210' },
    include: { recruitmentjob: true }
  });

  const interviewer = await prisma.user.findUnique({
    where: { id: 'bd24ca8d-8cec-4d06-8cad-e4d958823981' }
  });

  if (!candidate || !interviewer) {
    console.error('Candidate or interviewer not found.');
    process.exit(1);
  }

  const rawToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

  const session = await prisma.schedulingSession.create({
    data: {
      companyId: candidate.recruitmentjob.companyId,
      candidateId: candidate.id,
      jobId: candidate.jobId,
      interviewerId: interviewer.id,
      tokenHash,
      interviewType: 'VIDEO',
      duration: 30,
      status: 'ACTIVE',
      expiresAt
    }
  });

  console.log('\n======================================================');
  console.log('🎉 تم إنشاء جلسة الحجز الذاتي للمرشح بنجاح:');
  console.log('------------------------------------------------------');
  console.log('👤 المرشح:', candidate.fullName);
  console.log('💼 الوظيفة:', candidate.recruitmentjob?.title || 'غير محددة');
  console.log('👔 المقابل (المحاور):', interviewer.name);
  console.log('⏱️ مدة المقابلة:', '30 دقيقة');
  console.log('🔗 رابط الحجز التفاعلي للتجربة المباشرة:');
  console.log(`https://hr-manager-dashboard.onrender.com/book-interview/${rawToken}`);
  console.log('======================================================\n');
  
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
