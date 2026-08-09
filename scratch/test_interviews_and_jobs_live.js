import prisma from '../src/config/db.js';

async function testBackendData() {
    console.log('🧪 Testing ultra-fast getInterviews query...');

    const startTime = Date.now();
    try {
        const interviews = await prisma.interview.findMany({
            include: {
                candidate: {
                    include: {
                        recruitmentjob: true,
                        candidateSkills: true
                    }
                }
            },
            orderBy: { createdAt: 'desc' },
            take: 100
        });
        const elapsed = Date.now() - startTime;
        console.log(`⚡ Query completed in ${elapsed} ms!`);
        console.log(`✅ Interviews Count: ${interviews.length}`);
        console.log('Sample candidate:', interviews[0]?.candidate?.fullName);
    } catch (err) {
        console.error('❌ Error during query execution:', err);
    } finally {
        await prisma.$disconnect();
    }
}

testBackendData();
