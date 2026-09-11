import request from 'supertest';
import app from '../src/app.js';
import prisma from '../src/config/db.js';
import jwt from 'jsonwebtoken';
import { copilotAiService, sanitizePromptInput } from '../src/ai/copilot-ai.service.js';

const generateToken = (payload) => {
    return jwt.sign(payload, process.env.JWT_SECRET || 'secretKey', { expiresIn: '1h' });
};

describe('Recruitment Copilot Final Gap Verification Suite', () => {
    let companyA, companyB;


    let managerA, managerB, employeeA;
    let tokenManagerA, tokenManagerB, tokenEmployeeA;
    let sessionA;

    beforeAll(async () => {
        // 1. Create Test Multi-Tenant Companies
        companyA = await prisma.company.create({
            data: { name: `Copilot Comp A ${Date.now()}`, subscriptionStatus: 'ACTIVE' }
        });
        companyB = await prisma.company.create({
            data: { name: `Copilot Comp B ${Date.now()}`, subscriptionStatus: 'ACTIVE' }
        });

        // 2. Create Users with Different Roles
        managerA = await prisma.user.create({
            data: {
                name: 'Manager A',
                email: `mgr-a-${Date.now()}@compa.com`,
                passwordHash: 'hashedpass',
                role: 'MANAGER',
                companyId: companyA.id,
                status: 'ACTIVE'
            }
        });

        managerB = await prisma.user.create({
            data: {
                name: 'Manager B',
                email: `mgr-b-${Date.now()}@compb.com`,
                passwordHash: 'hashedpass',
                role: 'MANAGER',
                companyId: companyB.id,
                status: 'ACTIVE'
            }
        });

        employeeA = await prisma.user.create({
            data: {
                name: 'Employee A',
                email: `emp-a-${Date.now()}@compa.com`,
                passwordHash: 'hashedpass',
                role: 'EMPLOYEE',
                companyId: companyA.id,
                status: 'ACTIVE'
            }
        });

        tokenManagerA = generateToken({ id: managerA.id, email: managerA.email, role: managerA.role, companyId: companyA.id });
        tokenManagerB = generateToken({ id: managerB.id, email: managerB.email, role: managerB.role, companyId: companyB.id });
        tokenEmployeeA = generateToken({ id: employeeA.id, email: employeeA.email, role: employeeA.role, companyId: companyA.id });

        // 3. Create a Session in Company A
        sessionA = await prisma.copilotSession.create({
            data: {
                companyId: companyA.id,
                userId: managerA.id,
                title: 'Sales Director Requirements',
                conversation: [{ role: 'user', content: 'أحتاج مدير مبيعات' }],
                extractedData: { jobTitle: 'مدير مبيعات', location: 'الرياض', requiredSkills: ['Sales'] }
            }
        });

        // Create Job in Company A
        const jobA = await prisma.recruitmentJob.create({
            data: {
                title: 'مدير مبيعات إقليمي',
                description: 'وصف وظيفي كامل ومفصل لمدير المبيعات',
                companyId: companyA.id,
                status: 'OPEN'
            }
        });


        // Create a Candidate linked to Job A
        const candidateA = await prisma.candidate.create({
            data: {
                fullName: 'مرشح شركة أ',
                email: `canda-${Date.now()}@test.com`,
                location: 'الرياض',
                jobId: jobA.id
            }
        });

        await prisma.aIRecommendation.create({
            data: {
                id: `rec_${Date.now()}`,
                companyId: companyA.id,
                candidateId: candidateA.id,
                sessionId: sessionA.id,
                matchScore: 92,
                recommendation: 'STRONG_HIRE',
                reason: 'مرشح مثالي'
            }
        });
    });


    afterAll(async () => {
        // Cleanup fixtures
        try {
            await prisma.aIRecommendation.deleteMany({ where: { companyId: { in: [companyA.id, companyB.id] } } });
            await prisma.copilotSession.deleteMany({ where: { companyId: { in: [companyA.id, companyB.id] } } });
            await prisma.jobRequest.deleteMany({ where: { companyId: { in: [companyA.id, companyB.id] } } });
            await prisma.user.deleteMany({ where: { id: { in: [managerA.id, managerB.id, employeeA.id] } } });
            await prisma.company.deleteMany({ where: { id: { in: [companyA.id, companyB.id] } } });
        } catch (e) {
            // Ignore cleanup error
        }
    });

    // -------------------------------------------------------------
    // GAP 1: Multi-Tenant & Cross-Tenant Isolation
    // -------------------------------------------------------------
    describe('1. Cross-Tenant Security & Isolation', () => {
        it('1.1 User from Company B CANNOT access Copilot Session of Company A (Returns 404/Isolated)', async () => {
            const res = await request(app)
                .get(`/api/copilot/sessions/${sessionA.id}`)
                .set('Authorization', `Bearer ${tokenManagerB}`);

            expect(res.status).toBe(404);
            expect(res.body.message).toContain('غير موجودة');
        });

        it('1.2 User from Company B CANNOT view AIRecommendations of Company A', async () => {
            const res = await request(app)
                .get('/api/copilot/recommendations')
                .set('Authorization', `Bearer ${tokenManagerB}`);

            expect(res.status).toBe(200);
            expect(res.body.data.recommendations).toHaveLength(0);
        });

        it('1.3 Attacker attempting to spoof companyId in body payload has it completely ignored', async () => {
            const res = await request(app)
                .post('/api/copilot/create-job')
                .set('Authorization', `Bearer ${tokenManagerA}`)
                .send({
                    companyId: companyB.id, // Spoof attempt
                    jobData: { jobTitle: 'مدير تنفيذي مستهدف' }
                });

            expect(res.status).toBe(201);
            expect(res.body.data.jobRequest.companyId).toBe(companyA.id);
            expect(res.body.data.jobRequest.companyId).not.toBe(companyB.id);
        });
    });

    // -------------------------------------------------------------
    // GAP 2: Role-Based Authorization
    // -------------------------------------------------------------
    describe('2. Role-Based Authorization (RBAC)', () => {
        it('2.1 Unauthorized Role (EMPLOYEE) is rejected from /api/copilot/chat with 403', async () => {
            const res = await request(app)
                .post('/api/copilot/chat')
                .set('Authorization', `Bearer ${tokenEmployeeA}`)
                .send({ message: 'طلب غير مصرح' });

            expect(res.status).toBe(403);
        });

        it('2.2 Unauthorized Role (EMPLOYEE) is rejected from /api/copilot/create-job with 403', async () => {
            const res = await request(app)
                .post('/api/copilot/create-job')
                .set('Authorization', `Bearer ${tokenEmployeeA}`)
                .send({ jobData: { jobTitle: 'محاولة' } });

            expect(res.status).toBe(403);
        });

        it('2.3 Unauthorized Role (EMPLOYEE) is rejected from /api/copilot/recommendations with 403', async () => {
            const res = await request(app)
                .get('/api/copilot/recommendations')
                .set('Authorization', `Bearer ${tokenEmployeeA}`);

            expect(res.status).toBe(403);
        });
    });

    // -------------------------------------------------------------
    // GAP 3: Job Creation Confirmation & Idempotency
    // -------------------------------------------------------------
    describe('3. Job Creation Confirmation & Idempotency', () => {
        it('3.1 Missing required jobTitle rejected with 400', async () => {
            const res = await request(app)
                .post('/api/copilot/create-job')
                .set('Authorization', `Bearer ${tokenManagerA}`)
                .send({ jobData: {} });

            expect(res.status).toBe(400);
            expect(res.body.message).toContain('المسمى الوظيفي مطلوب');
        });

        it('3.2 Valid confirmation creates job request with generated requestId and skills', async () => {
            const res = await request(app)
                .post('/api/copilot/create-job')
                .set('Authorization', `Bearer ${tokenManagerA}`)
                .send({
                    sessionId: sessionA.id,
                    jobData: {
                        jobTitle: 'مهندس جودة برمجيات',
                        location: 'الرياض',
                        vacancies: 2,
                        requiredSkills: ['Jest', 'Automation', 'QA']
                    }
                });


            expect(res.status).toBe(201);
            expect(res.body.data.jobRequest.requestId).toMatch(/^REQ-/);
            expect(res.body.data.jobRequest.jobTitle).toBe('مهندس جودة برمجيات');
            expect(res.body.data.jobRequest.skills.length).toBe(3);
        });

        it('3.3 Repeated retry with same data returns existing job request (Idempotent)', async () => {
            const res = await request(app)
                .post('/api/copilot/create-job')
                .set('Authorization', `Bearer ${tokenManagerA}`)
                .send({
                    sessionId: sessionA.id,
                    jobData: {
                        jobTitle: 'مهندس جودة برمجيات',
                        location: 'الرياض',
                        vacancies: 2,
                        requiredSkills: ['Jest', 'Automation', 'QA']
                    }
                });

            expect(res.status).toBe(200);
            expect(res.body.data.isDuplicateRetried).toBe(true);
        });
    });

    // -------------------------------------------------------------
    // GAP 4: Input Validation & Boundary Testing
    // -------------------------------------------------------------
    describe('4. Input Validation & Boundaries', () => {
        it('4.1 Rejects empty message with 400', async () => {
            const res = await request(app)
                .post('/api/copilot/chat')
                .set('Authorization', `Bearer ${tokenManagerA}`)
                .send({ message: '' });

            expect(res.status).toBe(400);
        });

        it('4.2 Rejects oversized message (> 3000 chars) with 400', async () => {
            const oversized = 'أ'.repeat(3050);
            const res = await request(app)
                .post('/api/copilot/chat')
                .set('Authorization', `Bearer ${tokenManagerA}`)
                .send({ message: oversized });

            expect(res.status).toBe(400);
            expect(res.body.message).toContain('3000 حرف');
        });
    });

    // -------------------------------------------------------------
    // GAP 5: Deterministic Match Score & Explainability
    // -------------------------------------------------------------
    describe('5. Deterministic Match Score & Consistency', () => {
        it('5.1 Produces identical score and breakdown across multiple evaluations', () => {
            const cand = {
                id: 'cand-det-1',
                fullName: 'فهد المطيري',
                currentTitle: 'أخصائي توظيف أول',
                location: 'الرياض',
                yearsOfExperience: 5,
                candidateSkills: [{ skillName: 'Recruitment' }, { skillName: 'ATS' }]
            };

            const spec = {
                jobTitle: 'أخصائي توظيف',
                location: 'الرياض',
                experienceYears: 4,
                requiredSkills: ['Recruitment', 'ATS']
            };

            const run1 = copilotAiService.evaluateCandidateMatch({ candidate: cand, jobSpec: spec });
            const run2 = copilotAiService.evaluateCandidateMatch({ candidate: cand, jobSpec: spec });

            expect(run1.matchScore).toEqual(run2.matchScore);
            expect(run1.scoringBreakdown).toEqual(run2.scoringBreakdown);
            expect(run1.recommendation).toBe('STRONG_HIRE');
        });
    });

    // -------------------------------------------------------------
    // GAP 6: Audit Logging Verification
    // -------------------------------------------------------------
    describe('6. Audit Logging Verification', () => {
        it('6.1 Verifies that COPILOT_CREATE_JOB_REQUEST audit logs are stored in DB', async () => {
            const logs = await prisma.auditLog.findMany({
                where: {
                    companyId: companyA.id,
                    action: 'COPILOT_CREATE_JOB_REQUEST'
                }
            });

            expect(logs.length).toBeGreaterThan(0);
            expect(logs[0].actionType).toBe('AI_COPILOT');
            expect(logs[0].userId).toBe(managerA.id);
        });
    });
});
