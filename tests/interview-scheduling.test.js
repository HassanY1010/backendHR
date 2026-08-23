import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';
import app from '../src/app.js';
import pkg from '@prisma/client';
const { PrismaClient } = pkg;
import crypto from 'crypto';
import dotenv from 'dotenv';
dotenv.config();

const prisma = new PrismaClient();

describe('Interview Scheduling System - Comprehensive Test Suite', () => {
    let company;
    let interviewer;
    let job;
    let candidate;
    let rawToken;
    let tokenHash;
    let session;

    beforeAll(async () => {
        // 1. Setup Test Tenant Data
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
                status: 'INTERVIEW'
            }
        });

        // 2. Create Scheduling Session
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
    });

    afterAll(async () => {
        // Cleanup Test Data
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
    });

    describe('1. Public Session Details & Available Slots', () => {
        it('should get session details by token without exposing sensitive internal IDs', async () => {
            const res = await request(app)
                .get(`/api/interviews/session/${rawToken}`)
                .expect(200);

            expect(res.body.status).toBe('success');
            expect(res.body.data.candidateName).toBe('Candidate Ahmed');
            expect(res.body.data.interviewerName).toBe('Eng. Recruiter');
            expect(res.body.data.duration).toBe(45);
        });

        it('should return 404 for invalid booking token', async () => {
            const res = await request(app)
                .get('/api/interviews/session/invalid-token-12345')
                .expect(404);

            expect(res.body.status).toBe('error');
        });

        it('should return available slots strictly within 72-hour window in UTC', async () => {
            const res = await request(app)
                .get(`/api/interviews/available-slots/${rawToken}`)
                .expect(200);

            expect(res.body.status).toBe('success');
            expect(Array.isArray(res.body.data.slots)).toBe(true);
            expect(res.body.data.slots.length).toBeGreaterThan(0);

            const now = new Date().getTime();
            const max72h = now + 72 * 60 * 60 * 1000 + 60000; // 72h + 1min tolerance

            for (const slot of res.body.data.slots) {
                const slotTime = new Date(slot.startTime).getTime();
                expect(slotTime).toBeGreaterThanOrEqual(now);
                expect(slotTime).toBeLessThanOrEqual(max72h);
            }
        });
    });

    describe('2. 72-Hour Boundary Validation', () => {
        it('should reject booking past 72 hours from now with 400 Bad Request', async () => {
            const farFutureTime = new Date(Date.now() + 80 * 60 * 60 * 1000).toISOString();

            const res = await request(app)
                .post('/api/interviews/book')
                .send({
                    token: rawToken,
                    startTime: farFutureTime,
                    timezone: 'Asia/Riyadh'
                })
                .expect(400);

            expect(res.body.status).toBe('error');
            expect(res.body.message).toContain('72 ساعة');
        });

        it('should reject booking in the past with 400 Bad Request', async () => {
            const pastTime = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();

            const res = await request(app)
                .post('/api/interviews/book')
                .send({
                    token: rawToken,
                    startTime: pastTime
                })
                .expect(400);

            expect(res.body.status).toBe('error');
        });
    });

    describe('3. Concurrency Race Condition & Double-Booking Protection', () => {
        it('should allow only ONE candidate to book a slot and reject concurrent booking with 409 CONFLICT', async () => {
            // Create Candidate B with their own session
            const candidateB = await prisma.candidate.create({
                data: {
                    fullName: 'Candidate B',
                    email: `b-${Date.now()}@candidate.com`,
                    jobId: job.id,
                    status: 'INTERVIEW'
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

            // Simulate Candidate A and Candidate B booking the exact same slot simultaneously
            const [responseA, responseB] = await Promise.all([
                request(app).post('/api/interviews/book').send({ token: rawToken, startTime: targetSlotTime }),
                request(app).post('/api/interviews/book').send({ token: rawTokenB, startTime: targetSlotTime })
            ]);

            const statuses = [responseA.status, responseB.status].sort();
            expect(statuses).toEqual([201, 409]);

            // Verify that exactly one interview was created in the database for that time slot
            const createdInterviews = await prisma.interview.findMany({
                where: {
                    companyId: company.id,
                    interviewerId: interviewer.id,
                    startTime: new Date(targetSlotTime)
                }
            });

            expect(createdInterviews.length).toBe(1);

            // Cleanup Candidate B
            await prisma.candidateHistory.deleteMany({ where: { candidateId: candidateB.id } });
            await prisma.schedulingSession.deleteMany({ where: { candidateId: candidateB.id } });
            await prisma.candidate.deleteMany({ where: { id: candidateB.id } });
        });
    });

    describe('4. Token Lifecycle & Single Use Enforcement', () => {
        it('should reject reuse of an already-used booking link with 409 Conflict', async () => {
            const nextSlotTime = new Date(Date.now() + 30 * 60 * 60 * 1000).toISOString();

            const res = await request(app)
                .post('/api/interviews/book')
                .send({
                    token: rawToken,
                    startTime: nextSlotTime
                })
                .expect(409);

            expect(res.body.code).toBe('ALREADY_BOOKED');
        });
    });
});
