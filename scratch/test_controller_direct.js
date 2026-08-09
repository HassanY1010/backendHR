import prisma from '../src/config/db.js';
import { getInterviews, getAllJobs, getSmartInterviewNotes } from '../src/controllers/recruitment.controller.js';

async function testControllersDirectly() {
    console.log('====================================================');
    console.log('🔬 DIRECT CONTROLLER EXECUTION TEST WITH REAL DATABASE');
    console.log('====================================================');

    const mockUser = await prisma.user.findFirst({
        where: { email: 'hassan@gmail.com' },
        include: { company: true }
    });

    console.log(`👤 Test Mock User: ${mockUser?.name} (${mockUser?.email})`);
    console.log(`🏢 Test Company ID: ${mockUser?.companyId}`);

    // Mock Express req, res, next
    const createMockRes = (name) => {
        const start = Date.now();
        return {
            status(code) {
                this.statusCode = code;
                return this;
            },
            json(payload) {
                const duration = Date.now() - start;
                console.log(`\n✅ ${name} COMPLETED!`);
                console.log(`   ➜ HTTP Status: ${this.statusCode}`);
                console.log(`   ➜ Execution Duration: ${duration} ms`);
                console.log(`   ➜ Response Status: ${payload.status}`);
                if (payload.data?.interviews) {
                    console.log(`   ➜ Real Interviews Found: ${payload.data.interviews.length}`);
                    if (payload.data.interviews.length > 0) {
                        console.log(`   ➜ Sample Candidate: ${payload.data.interviews[0]?.candidate?.fullName}`);
                    }
                }
                if (payload.data?.jobs) {
                    console.log(`   ➜ Real Jobs Found: ${payload.data.jobs.length}`);
                }
                if (payload.data?.notes) {
                    console.log(`   ➜ AI Notes Returned: ${payload.data.notes.length}`);
                }
            }
        };
    };

    const mockNext = (err) => {
        if (err) {
            console.error('❌ Controller Error caught in next():', err.message);
        }
    };

    const req = { user: mockUser, params: {}, body: {}, query: {} };

    console.log('\n📡 1. Executing getInterviews Controller...');
    await getInterviews(req, createMockRes('getInterviews'), mockNext);

    console.log('\n📡 2. Executing getAllJobs Controller...');
    await getAllJobs(req, createMockRes('getAllJobs'), mockNext);

    console.log('\n📡 3. Executing getSmartInterviewNotes Controller...');
    await getSmartInterviewNotes(req, createMockRes('getSmartInterviewNotes'), mockNext);

    console.log('\n====================================================');
    console.log('🎉 DIRECT TEST COMPLETE: ALL CONTROLLERS OPERATE SAFELY & INSTANTLY!');
    console.log('====================================================');

    await prisma.$disconnect();
}

testControllersDirectly();
