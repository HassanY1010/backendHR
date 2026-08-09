import prisma from '../src/config/db.js';

async function testBackendData() {
    console.log('🧪 Testing DB & API Controller Queries...');

    try {
        const firstComp = await prisma.company.findFirst();
        console.log(`✅ Company ID found: ${firstComp?.id}`);

        // Test Jobs Query
        const jobs = await prisma.recruitmentJob.findMany({
            where: { deletedAt: null },
            include: { _count: { select: { candidates: true } } },
            orderBy: { createdAt: 'desc' }
        });
        console.log(`✅ Recruitment Jobs Count: ${jobs.length}`);

        // Test Interviews Query
        const interviews = await prisma.interview.findMany({
            include: {
                candidate: {
                    include: {
                        recruitmentjob: true,
                        candidateSkills: true
                    }
                }
            },
            orderBy: { createdAt: 'desc' }
        });
        console.log(`✅ Interviews Count: ${interviews.length}`);

        console.log('🎉 DB queries executed cleanly with ZERO errors!');
    } catch (err) {
        console.error('❌ Error during query execution:', err);
    } finally {
        await prisma.$disconnect();
    }
}

testBackendData();
