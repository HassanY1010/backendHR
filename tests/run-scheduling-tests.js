import assert from 'assert';
import request from 'supertest';
import app from '../src/app.js';
import pkg from '@prisma/client';
const { PrismaClient } = pkg;
import crypto from 'crypto';
import dotenv from 'dotenv';
dotenv.config();

const prisma = new PrismaClient();

async function runDirectTests() {
    console.log('🧪 Starting Automated Test Suite for Interview Scheduling System...\n');

    let company;
    let interviewer;
    let job;
    let candidate;
    let rawToken;
    let tokenHash;
    let session;
    let passed = 0;
    let total = 0;

    const test = async (name, fn) => {
        total++;
        try {
            await fn();
            passed++;
            console.log(`✅ PASS: ${name}`);
        } catch (err) {
            console.error(`❌ FAIL: ${name}`);
            console.error('   Error:', err.message);
        }
    };

    try {
        // Setup Tenant Data
        company = await prisma.company.create({
            data: {
                name: `Test Tenant ${Date.now()}`,
                subscriptionStatus: 'ACTIVE'
            }
        });

        interviewer = await prisma.user.create({
            data: {
                name: 'Eng. Recruiter',
                email: `recruiter-${Date.now()}@tenant.com`,
                passwordHash: 'hashedpassword',
                role: 'RECRUITER',
                status: 'ACTIVE',
                companyId: company.id
            }
        });

        job = await prisma.recruitmentJob.create({
            data: {
                title: 'Senior Software Engineer',
                description: 'Full-stack engineering role with Node.js and React.',
                department: 'Engineering',
                location: 'Riyadh, KSA',
                type: 'Full-time',
                companyId: company.id
            }
        });

        candidate = await prisma.candidate.create({
            data: {
                fullName: 'Candidate Ahmed',
                email: `ahmed-${Date.now()}@candidate.com`,
                jobId: job.id,
                status: 'NEW'
            }
        });

        rawToken = crypto.randomBytes(32).toString('hex');
        tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

        session = await prisma.schedulingSession.create({
            data: {
                companyId: company.id,
                candidateId: candidate.id,
                jobId: job.id,
                interviewerId: interviewer.id,
                tokenHash,
                interviewType: 'VIDEO',
                duration: 45,
                status: 'ACTIVE',
                expiresAt: new Date(Date.now() + 72 * 60 * 60 * 1000)
            }
        });

        // 1. Session Details
        await test('Public Session Details by Token (No Internal ID leak)', async () => {
            const res = await request(app).get(`/api/interviews/session/${rawToken}`);
            assert.strictEqual(res.status, 200);
            assert.strictEqual(res.body.status, 'success');
            assert.strictEqual(res.body.data.candidateName, 'Candidate Ahmed');
            assert.strictEqual(res.body.data.interviewerName, 'Eng. Recruiter');
            assert.strictEqual(res.body.data.duration, 45);
        });

        // 2. Invalid Token Handling
        await test('Invalid Token returns 404', async () => {
            const res = await request(app).get('/api/interviews/session/invalid-token-12345');
            assert.strictEqual(res.status, 404);
            assert.strictEqual(res.body.status, 'error');
        });

        // 3. Available Slots within 72h UTC
        await test('Available Slots strictly bounded by 72-hour window in UTC', async () => {
            const res = await request(app).get(`/api/interviews/available-slots/${rawToken}`);
            assert.strictEqual(res.status, 200);
            assert.strictEqual(res.body.status, 'success');
            assert(Array.isArray(res.body.data.slots));
            assert(res.body.data.slots.length > 0);

            const now = Date.now();
            const max72h = now + 72 * 60 * 60 * 1000 + 60000;
            for (const slot of res.body.data.slots) {
                const sTime = new Date(slot.startTime).getTime();
                assert(sTime >= now, 'Slot must be in the future');
                assert(sTime <= max72h, 'Slot must be within 72 hours');
            }
        });

        // 4. 72-Hour Boundary Validation
        await test('Reject booking past 72 hours (400 Bad Request)', async () => {
            const farFutureTime = new Date(Date.now() + 80 * 60 * 60 * 1000).toISOString();
            const res = await request(app)
                .post('/api/interviews/book')
                .send({ token: rawToken, startTime: farFutureTime, timezone: 'Asia/Riyadh' });
            assert.strictEqual(res.status, 400);
            assert.strictEqual(res.body.status, 'error');
            assert(res.body.message.includes('72 ساعة'));
        });

        // 5. Past Date Validation
        await test('Reject booking in the past (400 Bad Request)', async () => {
            const pastTime = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
            const res = await request(app)
                .post('/api/interviews/book')
                .send({ token: rawToken, startTime: pastTime });
            assert.strictEqual(res.status, 400);
            assert.strictEqual(res.body.status, 'error');
        });

        // 6. Concurrency Race Condition & Overlap Protection
        await test('Concurrency Race Condition: 2 Candidates → Same Slot = 1 SUCCESS (201) & 1 CONFLICT (409)', async () => {
            const candidateB = await prisma.candidate.create({
                data: {
                    fullName: 'Candidate B',
                    email: `b-${Date.now()}@candidate.com`,
                    jobId: job.id,
                    status: 'NEW'
                }
            });

            const rawTokenB = crypto.randomBytes(32).toString('hex');
            const tokenHashB = crypto.createHash('sha256').update(rawTokenB).digest('hex');

            await prisma.schedulingSession.create({
                data: {
                    companyId: company.id,
                    candidateId: candidateB.id,
                    jobId: job.id,
                    interviewerId: interviewer.id,
                    tokenHash: tokenHashB,
                    interviewType: 'VIDEO',
                    duration: 45,
                    status: 'ACTIVE',
                    expiresAt: new Date(Date.now() + 72 * 60 * 60 * 1000)
                }
            });

            const targetSlotTime = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

            const [responseA, responseB] = await Promise.all([
                request(app).post('/api/interviews/book').send({ token: rawToken, startTime: targetSlotTime }),
                request(app).post('/api/interviews/book').send({ token: rawTokenB, startTime: targetSlotTime })
            ]);

            const statuses = [responseA.status, responseB.status].sort();
            assert.deepStrictEqual(statuses, [201, 409]);

            const count = await prisma.interview.count({
                where: {
                    companyId: company.id,
                    interviewerId: interviewer.id,
                    startTime: new Date(targetSlotTime)
                }
            });
            assert.strictEqual(count, 1, 'Only 1 interview must exist in database for this slot');

            await prisma.candidateHistory.deleteMany({ where: { candidateId: candidateB.id } });
            await prisma.schedulingSession.deleteMany({ where: { candidateId: candidateB.id } });
            await prisma.candidate.deleteMany({ where: { id: candidateB.id } });
        });

        // 7. Single Use Token Lifecycle Enforcement
        await test('Single-use Token: Reject reuse with 409 Conflict', async () => {
            const nextSlotTime = new Date(Date.now() + 30 * 60 * 60 * 1000).toISOString();
            const res = await request(app)
                .post('/api/interviews/book')
                .send({ token: rawToken, startTime: nextSlotTime });
            assert.strictEqual(res.status, 409);
            assert.strictEqual(res.body.code, 'ALREADY_BOOKED');
        });

        console.log(`\n========================================`);
        console.log(`📊 Test Results: ${passed}/${total} Passed (${Math.round((passed/total)*100)}%)`);
        console.log(`========================================\n`);

    } finally {
        try {
            await prisma.candidateHistory.deleteMany({ where: { candidateId: candidate?.id } });
            await prisma.interview.deleteMany({ where: { companyId: company?.id } });
            await prisma.schedulingSession.deleteMany({ where: { companyId: company?.id } });
            await prisma.candidate.deleteMany({ where: { id: candidate?.id } });
            await prisma.recruitmentJob.deleteMany({ where: { id: job?.id } });
            await prisma.user.deleteMany({ where: { id: interviewer?.id } });
            await prisma.company.deleteMany({ where: { id: company?.id } });
            await prisma.$disconnect();
        } catch (e) {
            console.error('Cleanup error:', e);
        }
    }
}

runDirectTests();
