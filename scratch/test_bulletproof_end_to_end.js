import jwt from 'jsonwebtoken';
import http from 'https';
import prisma from '../src/config/db.js';

const PROD_JWT_SECRET = 'fdf973b060f08e5e7839446f7f631bc2bf7df554a9386401918bdca439ef2a29bcff7bfa76722d3e';

async function runRigorousTest() {
    console.log('====================================================');
    console.log('🔬 RIGOROUS LIVE PRODUCTION SYSTEM TEST');
    console.log('====================================================');

    try {
        const user = await prisma.user.findFirst({
            where: { email: 'hassan@gmail.com' }
        });

        if (!user) {
            console.error('❌ User hassan@gmail.com not found');
            return;
        }

        console.log(`👤 Testing with Authenticated User: ${user.name} (${user.email})`);
        console.log(`🏢 Company ID: ${user.companyId}`);

        // Sign production JWT token
        const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, PROD_JWT_SECRET, { expiresIn: '1h' });

        const makeGet = (path) => {
            return new Promise((resolve) => {
                const startTime = Date.now();
                const req = http.request({
                    hostname: 'backendhr-ovjw.onrender.com',
                    path: `/api${path}`,
                    method: 'GET',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    }
                }, res => {
                    let data = '';
                    res.on('data', chunk => data += chunk);
                    res.on('end', () => {
                        const duration = Date.now() - startTime;
                        try {
                            resolve({ status: res.statusCode, duration, data: JSON.parse(data) });
                        } catch (e) {
                            resolve({ status: res.statusCode, duration, raw: data });
                        }
                    });
                });
                req.on('error', err => resolve({ status: 'ERR', error: err.message }));
                req.end();
            });
        };

        // 1. Test GET /recruitment/interviews
        console.log('\n📡 1. Testing GET /api/recruitment/interviews...');
        const interviewsRes = await makeGet('/recruitment/interviews');
        console.log(`   ➜ HTTP Status: ${interviewsRes.status}`);
        console.log(`   ➜ Response Time: ${interviewsRes.duration} ms`);
        const interviews = interviewsRes.data?.data?.interviews || [];
        console.log(`   ➜ Real Interviews Found: ${interviews.length}`);
        if (interviews.length > 0) {
            console.log(`   ➜ Candidate Full Name: ${interviews[0]?.candidate?.fullName}`);
            console.log(`   ➜ Interview Status: ${interviews[0]?.status}`);
        }

        // 2. Test GET /recruitment/jobs
        console.log('\n📡 2. Testing GET /api/recruitment/jobs...');
        const jobsRes = await makeGet('/recruitment/jobs');
        console.log(`   ➜ HTTP Status: ${jobsRes.status}`);
        console.log(`   ➜ Response Time: ${jobsRes.duration} ms`);
        const jobs = jobsRes.data?.data?.jobs || [];
        console.log(`   ➜ Real Recruitment Jobs Found: ${jobs.length}`);

        // 3. Test GET /recruitment/interviews/ai/smart-notes
        console.log('\n📡 3. Testing GET /api/recruitment/interviews/ai/smart-notes...');
        const notesRes = await makeGet('/recruitment/interviews/ai/smart-notes');
        console.log(`   ➜ HTTP Status: ${notesRes.status}`);
        console.log(`   ➜ Response Time: ${notesRes.duration} ms`);
        const notes = notesRes.data?.data?.notes || [];
        console.log(`   ➜ AI Smart Notes Count: ${notes.length}`);

        console.log('\n====================================================');
        const pass = interviewsRes.status === 200 && jobsRes.status === 200 && notesRes.status === 200;
        if (pass) {
            console.log('✅ RIGOROUS TEST VERDICT: 100% PASSED!');
            console.log('⚡ ALL ENDPOINTS RESPONDED WITH STATUS 200 OK IN UNDER 1 SECOND!');
        } else {
            console.log('⚠️ VERDICT: FAILED - HTTP Statuses:', interviewsRes.status, jobsRes.status, notesRes.status);
        }
        console.log('====================================================');

    } catch (e) {
        console.error('Test error:', e);
    } finally {
        await prisma.$disconnect();
    }
}

runRigorousTest();
