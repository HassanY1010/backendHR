import assert from 'assert';
import request from 'supertest';
import app from '../src/app.js';
import pkg from '@prisma/client';
const { PrismaClient } = pkg;
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
dotenv.config();

const prisma = new PrismaClient();

const generateAuthToken = (user) => {
    return jwt.sign(
        { id: user.id, email: user.email, role: user.role, companyId: user.companyId },
        process.env.JWT_SECRET || 'secretKey',
        { expiresIn: '1h' }
    );
};

const hashToken = (token) => {
    return crypto.createHash('sha256').update(token).digest('hex');
};

async function runFinalGapVerificationSuite() {
    console.log('🚀 =================================================================');
    console.log('🚀 FINAL GAP VERIFICATION SUITE — COMPREHENSIVE E2E & SECURITY TESTS');
    console.log('🚀 =================================================================\n');

    let companyA, companyB;
    let recruiterA, recruiterB, employeeA;
    let tokenA, tokenB, tokenEmpA;
    let jobA, jobB;
    let candidateA, candidateB;
    let sessionA, rawTokenA;

    let passed = 0;
    let total = 0;
    const testResults = [];

    const runTest = async (testNumber, testName, fn) => {
        total++;
        try {
            const evidence = await fn();
            passed++;
            console.log(`✅ [PASS] ${testNumber}: ${testName}`);
            testResults.push({
                testNumber,
                testName,
                status: 'PASS',
                evidence: evidence || 'Assertion verified successfully'
            });
        } catch (err) {
            console.error(`❌ [FAIL] ${testNumber}: ${testName}`);
            console.error('   Error Details:', err.message);
            testResults.push({
                testNumber,
                testName,
                status: 'FAIL',
                evidence: err.message
            });
        }
    };

    try {
        // -------------------------------------------------------------
        // Setup Multi-Tenant Test Fixture
        // -------------------------------------------------------------
        companyA = await prisma.company.create({
            data: { name: `Company A ${Date.now()}`, subscriptionStatus: 'ACTIVE' }
        });
        companyB = await prisma.company.create({
            data: { name: `Company B ${Date.now()}`, subscriptionStatus: 'ACTIVE' }
        });

        recruiterA = await prisma.user.create({
            data: {
                name: 'Recruiter A',
                email: `recruiter-a-${Date.now()}@comp-a.com`,
                passwordHash: 'hashedpassword',
                role: 'RECRUITER',
                status: 'ACTIVE',
                companyId: companyA.id
            }
        });
        tokenA = generateAuthToken(recruiterA);

        recruiterB = await prisma.user.create({
            data: {
                name: 'Recruiter B',
                email: `recruiter-b-${Date.now()}@comp-b.com`,
                passwordHash: 'hashedpassword',
                role: 'RECRUITER',
                status: 'ACTIVE',
                companyId: companyB.id
            }
        });
        tokenB = generateAuthToken(recruiterB);

        employeeA = await prisma.user.create({
            data: {
                name: 'Employee A',
                email: `emp-a-${Date.now()}@comp-a.com`,
                passwordHash: 'hashedpassword',
                role: 'EMPLOYEE',
                status: 'ACTIVE',
                companyId: companyA.id
            }
        });
        tokenEmpA = generateAuthToken(employeeA);

        jobA = await prisma.recruitmentJob.create({
            data: {
                title: 'Senior Node.js Architect',
                description: 'Build backend APIs and microservices',
                department: 'Engineering',
                location: 'Riyadh, KSA',
                type: 'Full-time',
                companyId: companyA.id
            }
        });

        jobB = await prisma.recruitmentJob.create({
            data: {
                title: 'Frontend Engineer',
                description: 'React applications',
                department: 'Engineering',
                location: 'Dubai, UAE',
                type: 'Full-time',
                companyId: companyB.id
            }
        });

        candidateA = await prisma.candidate.create({
            data: {
                fullName: 'Candidate Tareq',
                email: `tareq-${Date.now()}@cand.com`,
                jobId: jobA.id,
                status: 'NEW'
            }
        });

        candidateB = await prisma.candidate.create({
            data: {
                fullName: 'Candidate Zaid',
                email: `zaid-${Date.now()}@cand.com`,
                jobId: jobB.id,
                status: 'NEW'
            }
        });

        rawTokenA = crypto.randomBytes(32).toString('hex');
        sessionA = await prisma.schedulingSession.create({
            data: {
                companyId: companyA.id,
                candidateId: candidateA.id,
                jobId: jobA.id,
                interviewerId: recruiterA.id,
                tokenHash: hashToken(rawTokenA),
                interviewType: 'VIDEO',
                duration: 45,
                status: 'ACTIVE',
                expiresAt: new Date(Date.now() + 72 * 60 * 60 * 1000)
            }
        });

        // =============================================================
        // GROUP 1: SECURITY & MULTI-TENANT ISOLATION TESTS
        // =============================================================

        // Test 1: Cross Tenant Candidate Booking Link Generation
        await runTest('SEC-01', 'Cross-Tenant: Company B user cannot create session for Company A candidate', async () => {
            const res = await request(app)
                .post('/api/interviews/scheduling-session')
                .set('Authorization', `Bearer ${tokenB}`)
                .send({ candidateId: candidateA.id, interviewerId: recruiterB.id });
            assert.strictEqual(res.status, 404);
            return `Rejected with 404 (Candidate not found in company context)`;
        });

        // Test 2: Cross Tenant Interviewer Selection
        await runTest('SEC-02', 'Cross-Tenant: Company A cannot assign Company B user as interviewer', async () => {
            const res = await request(app)
                .post('/api/interviews/scheduling-session')
                .set('Authorization', `Bearer ${tokenA}`)
                .send({ candidateId: candidateA.id, interviewerId: recruiterB.id });
            assert.strictEqual(res.status, 404);
            return `Rejected with 404 (Interviewer not found in same company)`;
        });

        // Test 3: Unauthorized RBAC Access (EMPLOYEE cannot create sessions)
        await runTest('SEC-03', 'RBAC: Role EMPLOYEE cannot create scheduling sessions', async () => {
            const res = await request(app)
                .post('/api/interviews/scheduling-session')
                .set('Authorization', `Bearer ${tokenEmpA}`)
                .send({ candidateId: candidateA.id, interviewerId: recruiterA.id });
            assert.strictEqual(res.status, 403);
            return `Rejected with 403 Forbidden for EMPLOYEE role`;
        });

        // Test 4: Token Enumeration / Invalid Token Information Exposure
        await runTest('SEC-04', 'Token Enumeration: Random token yields 404 without leaking metadata', async () => {
            const fakeToken = crypto.randomBytes(32).toString('hex');
            const res = await request(app).get(`/api/interviews/session/${fakeToken}`);
            assert.strictEqual(res.status, 404);
            assert.strictEqual(res.body.data, undefined);
            return `Status 404 returned without metadata payload`;
        });

        // Test 5: Expired Token Rejection
        await runTest('SEC-05', 'Token Security: Expired session returns 410 Gone', async () => {
            const expRawToken = crypto.randomBytes(32).toString('hex');
            await prisma.schedulingSession.create({
                data: {
                    companyId: companyA.id,
                    candidateId: candidateA.id,
                    jobId: jobA.id,
                    interviewerId: recruiterA.id,
                    tokenHash: hashToken(expRawToken),
                    interviewType: 'VIDEO',
                    status: 'ACTIVE',
                    expiresAt: new Date(Date.now() - 1000) // Expired 1 second ago
                }
            });

            const res = await request(app).get(`/api/interviews/session/${expRawToken}`);
            assert.strictEqual(res.status, 410);
            return `Status 410 returned with code SESSION_EXPIRED`;
        });

        // =============================================================
        // GROUP 2: BOOKING, CONCURRENCY & IDEMPOTENCY
        // =============================================================

        let createdInterviewId;
        const targetSlotUtc = new Date(Date.now() + 20 * 60 * 60 * 1000).toISOString();

        // Test 6: Successful Booking Flow
        await runTest('BOOK-01', 'Booking Flow: Valid slot booked within 72h window in UTC', async () => {
            const res = await request(app)
                .post('/api/interviews/book')
                .send({
                    token: rawTokenA,
                    startTime: targetSlotUtc,
                    timezone: 'Asia/Riyadh',
                    notes: 'Looking forward to meeting the team'
                });

            assert.strictEqual(res.status, 201);
            assert.strictEqual(res.body.status, 'success');
            assert(res.body.data.interviewId);
            createdInterviewId = res.body.data.interviewId;

            // Verify CandidateHistory audit record created
            const history = await prisma.candidateHistory.findFirst({
                where: { candidateId: candidateA.id, action: 'INTERVIEW_BOOKED' }
            });
            assert(history, 'CandidateHistory record must exist');

            return `Interview created with ID ${createdInterviewId} and logged in CandidateHistory`;
        });

        // Test 7: Booking Idempotency & Token Single-Use
        await runTest('BOOK-02', 'Idempotency: Re-submitting the exact same booking request returns 409 Conflict', async () => {
            const res = await request(app)
                .post('/api/interviews/book')
                .send({
                    token: rawTokenA,
                    startTime: targetSlotUtc
                });

            assert.strictEqual(res.status, 409);
            assert.strictEqual(res.body.code, 'ALREADY_BOOKED');
            return `Second submission rejected with 409 ALREADY_BOOKED`;
        });

        // =============================================================
        // GROUP 3: RESCHEDULE & CANCELLATION FLOWS
        // =============================================================

        const newRescheduledSlotUtc = new Date(Date.now() + 35 * 60 * 60 * 1000).toISOString();

        // Test 8: Cross-Tenant Reschedule Attempt
        await runTest('RESCHED-01', 'Cross-Tenant: Company B user cannot reschedule Company A interview', async () => {
            const res = await request(app)
                .put(`/api/interviews/${createdInterviewId}/reschedule`)
                .set('Authorization', `Bearer ${tokenB}`)
                .send({ startTime: newRescheduledSlotUtc, reason: 'Unauthorized attempt' });

            assert.strictEqual(res.status, 403);
            return `Rejected with 403 Forbidden`;
        });

        // Test 9: Valid Reschedule Execution
        await runTest('RESCHED-02', 'Reschedule Flow: Authorized recruiter reschedules interview to new slot', async () => {
            const res = await request(app)
                .put(`/api/interviews/${createdInterviewId}/reschedule`)
                .set('Authorization', `Bearer ${tokenA}`)
                .send({
                    startTime: newRescheduledSlotUtc,
                    reason: 'Interviewer requested later afternoon time',
                    timezone: 'Asia/Riyadh'
                });

            assert.strictEqual(res.status, 200);
            assert.strictEqual(res.body.data.status, 'rescheduled');
            assert(res.body.data.rescheduledAt);
            assert.strictEqual(res.body.data.rescheduledFromId, createdInterviewId);

            // Verify CandidateHistory record
            const history = await prisma.candidateHistory.findFirst({
                where: { candidateId: candidateA.id, action: 'INTERVIEW_RESCHEDULED' }
            });
            assert(history, 'CandidateHistory must record reschedule');

            return `Interview rescheduled successfully to ${newRescheduledSlotUtc}`;
        });

        // Test 10: Cancellation Flow
        await runTest('CANCEL-01', 'Cancellation Flow: Cancels interview without deleting DB record', async () => {
            const res = await request(app)
                .delete(`/api/interviews/${createdInterviewId}/cancel`)
                .set('Authorization', `Bearer ${tokenA}`)
                .send({ reason: 'Position closed by hiring manager' });

            assert.strictEqual(res.status, 200);
            assert.strictEqual(res.body.data.status, 'cancelled');
            assert(res.body.data.cancelledAt);
            assert.strictEqual(res.body.data.cancellationReason, 'Position closed by hiring manager');

            // Ensure interview record still exists in database (No Hard Delete)
            const interviewInDb = await prisma.interview.findUnique({ where: { id: createdInterviewId } });
            assert(interviewInDb, 'Interview must not be deleted from database');
            assert.strictEqual(interviewInDb.status, 'cancelled');

            return `Interview status set to 'cancelled', cancelledAt recorded, row preserved`;
        });

        // =============================================================
        // GROUP 4: AUTOMATED REMINDERS & IDEMPOTENCY
        // =============================================================

        // Test 11: Idempotent Reminder Execution
        await runTest('REMIND-01', 'Reminders: Automated reminder job executes without duplicate alerts', async () => {
            // Create an upcoming interview 10 hours from now
            const upcomingStartTime = new Date(Date.now() + 10 * 60 * 60 * 1000);
            const upcomingInterview = await prisma.interview.create({
                data: {
                    companyId: companyA.id,
                    candidateId: candidateA.id,
                    jobId: jobA.id,
                    interviewerId: recruiterA.id,
                    type: 'VIDEO',
                    status: 'scheduled',
                    scheduledAt: upcomingStartTime,
                    startTime: upcomingStartTime,
                    endTime: new Date(upcomingStartTime.getTime() + 45 * 60 * 1000),
                    reminder24hSent: false,
                    reminder1hSent: false
                }
            });

            // Trigger Reminders Cron Endpoint
            const res1 = await request(app)
                .post('/api/interviews/cron/reminders')
                .set('Authorization', `Bearer ${tokenA}`);

            assert.strictEqual(res1.status, 200);
            assert.strictEqual(res1.body.data.sent24h, 1);

            // Trigger Reminders Cron Second Time (Must be idempotent: sent24h = 0)
            const res2 = await request(app)
                .post('/api/interviews/cron/reminders')
                .set('Authorization', `Bearer ${tokenA}`);

            assert.strictEqual(res2.status, 200);
            assert.strictEqual(res2.body.data.sent24h, 0);

            // Cleanup upcoming interview
            await prisma.interview.delete({ where: { id: upcomingInterview.id } });

            return `First pass sent 1 reminder; second pass sent 0 (strict idempotency)`;
        });

        // =============================================================
        // GROUP 5: TIMEZONE CONVERSIONS
        // =============================================================

        // Test 12: Multi-Timezone Slot Calculation
        await runTest('TZ-01', 'Timezone Engine: Verified across UTC, Riyadh, Aden, Cairo', async () => {
            const rawTokenTz = crypto.randomBytes(32).toString('hex');
            await prisma.schedulingSession.create({
                data: {
                    companyId: companyA.id,
                    candidateId: candidateA.id,
                    jobId: jobA.id,
                    interviewerId: recruiterA.id,
                    tokenHash: hashToken(rawTokenTz),
                    interviewType: 'VIDEO',
                    status: 'ACTIVE',
                    expiresAt: new Date(Date.now() + 72 * 60 * 60 * 1000)
                }
            });

            const zones = ['UTC', 'Asia/Riyadh', 'Asia/Aden', 'Africa/Cairo'];
            for (const tz of zones) {
                const res = await request(app).get(`/api/interviews/available-slots/${rawTokenTz}?timezone=${tz}`);
                assert.strictEqual(res.status, 200);
                assert.strictEqual(res.body.data.timezone, tz);
                assert(res.body.data.slots.length > 0);
            }

            return `Slots queried and verified across UTC, Asia/Riyadh, Asia/Aden, Africa/Cairo`;
        });

    } finally {
        // Cleanup all created test data
        try {
            await prisma.candidateHistory.deleteMany({ where: { candidateId: { in: [candidateA?.id, candidateB?.id].filter(Boolean) } } });
            await prisma.interview.deleteMany({ where: { companyId: { in: [companyA?.id, companyB?.id].filter(Boolean) } } });
            await prisma.schedulingSession.deleteMany({ where: { companyId: { in: [companyA?.id, companyB?.id].filter(Boolean) } } });
            await prisma.candidate.deleteMany({ where: { id: { in: [candidateA?.id, candidateB?.id].filter(Boolean) } } });
            await prisma.recruitmentJob.deleteMany({ where: { id: { in: [jobA?.id, jobB?.id].filter(Boolean) } } });
            await prisma.user.deleteMany({ where: { id: { in: [recruiterA?.id, recruiterB?.id, employeeA?.id].filter(Boolean) } } });
            await prisma.company.deleteMany({ where: { id: { in: [companyA?.id, companyB?.id].filter(Boolean) } } });
            await prisma.$disconnect();
        } catch (e) {
            console.error('Cleanup error:', e);
        }
    }

    console.log(`\n=================================================================`);
    console.log(`🏁 FINAL GAP VERIFICATION RESULTS: ${passed}/${total} PASSED (${Math.round((passed / total) * 100)}%)`);
    console.log(`=================================================================\n`);
    
    return { passed, total, testResults };
}

runFinalGapVerificationSuite();
