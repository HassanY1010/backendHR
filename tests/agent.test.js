import request from 'supertest';
import app from '../src/app.js';
import prisma from '../src/config/db.js';
import jwt from 'jsonwebtoken';
import { recruitmentAgentService } from '../src/ai/recruitment-agent.service.js';

describe('Recruitment AI Agent (Autonomous Hiring Agent) Comprehensive Audit Tests', () => {
    let companyAId;
    let companyBId;
    let userAId;
    let userBId;
    let tokenCompanyA;
    let tokenCompanyB;
    let jobAId;
    let candidateA1Id;
    let candidateA2Id;

    beforeAll(async () => {
        // Ensure test companies exist
        const companyA = await prisma.company.upsert({
            where: { id: 'test-agent-comp-a' },
            update: {},
            create: {
                id: 'test-agent-comp-a',
                name: 'شركة التقنية الذكية A',
                subscriptionStatus: 'ACTIVE',
                status: 'active'
            }
        });
        companyAId = companyA.id;

        const companyB = await prisma.company.upsert({
            where: { id: 'test-agent-comp-b' },
            update: {},
            create: {
                id: 'test-agent-comp-b',
                name: 'شركة الخدمات B',
                subscriptionStatus: 'ACTIVE',
                status: 'active'
            }
        });
        companyBId = companyB.id;

        // Ensure test users exist
        const userA = await prisma.user.upsert({
            where: { email: 'agent-manager-a@test.com' },
            update: {},
            create: {
                id: 'user-agent-mgr-a',
                email: 'agent-manager-a@test.com',
                passwordHash: 'mock-hash',
                name: 'مدير التوظيف A',
                role: 'MANAGER',
                status: 'ACTIVE',
                companyId: companyAId
            }
        });
        userAId = userA.id;

        const userB = await prisma.user.upsert({
            where: { email: 'agent-manager-b@test.com' },
            update: {},
            create: {
                id: 'user-agent-mgr-b',
                email: 'agent-manager-b@test.com',
                passwordHash: 'mock-hash',
                name: 'مدير التوظيف B',
                role: 'MANAGER',
                status: 'ACTIVE',
                companyId: companyBId
            }
        });
        userBId = userB.id;

        tokenCompanyA = jwt.sign({ id: userAId, email: userA.email }, process.env.JWT_SECRET || 'test-secret', { expiresIn: '1h' });
        tokenCompanyB = jwt.sign({ id: userBId, email: userB.email }, process.env.JWT_SECRET || 'test-secret', { expiresIn: '1h' });

        // Clean any previous test data
        await prisma.agentLog.deleteMany({ where: { companyId: { in: [companyAId, companyBId] } } });
        await prisma.agentTask.deleteMany({ where: { companyId: { in: [companyAId, companyBId] } } });

        // Create a Stalled Job in Company A (> 7 days old, 0 candidates)
        const stalledDate = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000);
        const jobA = await prisma.recruitmentJob.create({
            data: {
                companyId: companyAId,
                title: 'مهندس سحابي أول (AWS/GCP)',
                description: 'مطلوب مهندس بنية سحابية متقدمة',
                status: 'OPEN',
                createdAt: stalledDate,
                updatedAt: stalledDate
            }
        });
        jobAId = jobA.id;

        // Create 2 active candidates in Company A for testing follow-ups and top 5
        const stuckDate = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000);
        const cand1 = await prisma.candidate.create({
            data: {
                jobId: jobAId,
                fullName: 'فهد الأحمدي',
                email: 'fahad@test.com',
                status: 'APPLIED',
                yearsOfExperience: 6,
                aiScore: 88,
                createdAt: stuckDate,
                updatedAt: stuckDate
            }
        });
        candidateA1Id = cand1.id;

        await prisma.candidateSkill.createMany({
            data: [
                { candidateId: candidateA1Id, skillName: 'AWS' },
                { candidateId: candidateA1Id, skillName: 'Docker' },
                { candidateId: candidateA1Id, skillName: 'Terraform' }
            ]
        });

        const cand2 = await prisma.candidate.create({
            data: {
                jobId: jobAId,
                fullName: 'مها العصيمي',
                email: 'maha@test.com',
                status: 'SCREENING',
                yearsOfExperience: 4,
                aiScore: 82,
                createdAt: stuckDate,
                updatedAt: stuckDate
            }
        });
        candidateA2Id = cand2.id;
    });

    afterAll(async () => {
        // Cleanup test data
        await prisma.candidateSkill.deleteMany({ where: { candidateId: { in: [candidateA1Id, candidateA2Id] } } });
        await prisma.candidate.deleteMany({ where: { id: { in: [candidateA1Id, candidateA2Id] } } });
        await prisma.recruitmentJob.deleteMany({ where: { id: jobAId } });
        await prisma.agentLog.deleteMany({ where: { companyId: { in: [companyAId, companyBId] } } });
        await prisma.agentTask.deleteMany({ where: { companyId: { in: [companyAId, companyBId] } } });
        await prisma.$disconnect();
    });

    describe('1. Authentication & Security & Multi-Tenant Isolation', () => {
        it('1.1 Should reject unauthenticated requests to /api/agent/run with 401', async () => {
            const res = await request(app).post('/api/agent/run').send({});
            expect(res.status).toBe(401);
        });

        it('1.2 Should reject unauthenticated requests to /api/agent/tasks with 401', async () => {
            const res = await request(app).get('/api/agent/tasks');
            expect(res.status).toBe(401);
        });

        it('1.3 Multi-Tenant Isolation: User from Company B must NOT see Company A tasks or logs', async () => {
            // Company A runs a task
            await request(app)
                .post('/api/agent/run')
                .set('Authorization', `Bearer ${tokenCompanyA}`)
                .send({ taskType: 'STALLED_JOBS' });

            // Company B requests tasks
            const resB = await request(app)
                .get('/api/agent/tasks')
                .set('Authorization', `Bearer ${tokenCompanyB}`);

            expect(resB.status).toBe(200);
            expect(resB.body.data.tasks).toBeDefined();
            // Verify none of the returned tasks belong to Company A
            const leak = resB.body.data.tasks.find(t => t.companyId === companyAId);
            expect(leak).toBeUndefined();
        });
    });

    describe('2. Autonomous Agent Modules & Task Lifecycle', () => {
        it('2.1 Tool 1: Stalled Jobs Detection — detects stalled job and produces explainable recommendations', async () => {
            const sweepResult = await recruitmentAgentService.executeSubTask({
                companyId: companyAId,
                taskType: 'STALLED_JOBS',
                userId: userAId
            });

            expect(sweepResult.status).toBe('COMPLETED');
            expect(sweepResult.result).toBeDefined();
            expect(sweepResult.result.stalledJobsCount).toBeGreaterThanOrEqual(1);

            const stalled = sweepResult.result.stalledJobs.find(j => j.jobId === jobAId);
            expect(stalled).toBeDefined();
            expect(stalled.evidenceReason).toBeDefined();
            expect(stalled.recommendedActions.length).toBeGreaterThanOrEqual(1);
        });

        it('2.2 Tool 2: Candidate Follow-up — flags stuck candidates with verifiable DB evidence', async () => {
            const result = await recruitmentAgentService.executeSubTask({
                companyId: companyAId,
                taskType: 'CANDIDATE_FOLLOWUP',
                userId: userAId
            });

            expect(result.status).toBe('COMPLETED');
            expect(result.result.bottlenecksFoundCount).toBeGreaterThanOrEqual(1);
            const candFollowup = result.result.followups.find(f => f.candidateId === candidateA1Id);
            expect(candFollowup).toBeDefined();
            expect(candFollowup.daysStuck).toBeGreaterThanOrEqual(5);
        });

        it('2.3 Tool 3: Weekly Report Tool — calculates metrics based on real database counts', async () => {
            const reportTask = await recruitmentAgentService.executeSubTask({
                companyId: companyAId,
                taskType: 'WEEKLY_REPORT',
                userId: userAId
            });

            expect(reportTask.status).toBe('COMPLETED');
            expect(reportTask.result.metrics).toBeDefined();
            expect(typeof reportTask.result.metrics.totalApplications).toBe('number');
            expect(typeof reportTask.result.metrics.totalInterviews).toBe('number');
            expect(typeof reportTask.result.metrics.avgTimeToHireDays).toBe('number');
            expect(reportTask.result.strategicSummary).toBeDefined();
        });

        it('2.4 Tool 4: Top 5 Candidates — ranks candidates using deterministic scoring without altering status without approval', async () => {
            const topTask = await recruitmentAgentService.executeSubTask({
                companyId: companyAId,
                taskType: 'TOP_CANDIDATES',
                userId: userAId
            });

            expect(topTask.status).toBe('COMPLETED');
            expect(topTask.result.topCandidates.length).toBeGreaterThanOrEqual(1);

            const top1 = topTask.result.topCandidates[0];
            expect(top1.calculatedScore).toBeGreaterThanOrEqual(50);
            expect(top1.explainableReasons.length).toBeGreaterThan(0);

            // Verify Candidate Status did NOT change automatically
            const dbCand = await prisma.candidate.findUnique({ where: { id: top1.candidateId } });
            expect(['APPLIED', 'SCREENING']).toContain(dbCand.status);
        });
    });

    describe('3. Human-in-the-Loop Action Approval, Permissions & Idempotency', () => {
        let recommendationLogId;

        it('3.1 Should log recommended actions with status RECOMMENDED', async () => {
            const logs = await prisma.agentLog.findMany({
                where: { companyId: companyAId, actionStatus: 'RECOMMENDED' }
            });
            expect(logs.length).toBeGreaterThan(0);
            recommendationLogId = logs[0].id;
        });

        it('3.2 Cross-Tenant Protection: User B cannot execute or alter Company A recommended action', async () => {
            const res = await request(app)
                .post(`/api/agent/actions/${recommendationLogId}/execute`)
                .set('Authorization', `Bearer ${tokenCompanyB}`)
                .send({ decision: 'APPROVE' });

            expect(res.status).toBe(404);
        });

        it('3.3 Authorized Execution: Manager A approves action and state transitions to EXECUTED', async () => {
            const res = await request(app)
                .post(`/api/agent/actions/${recommendationLogId}/execute`)
                .set('Authorization', `Bearer ${tokenCompanyA}`)
                .send({ decision: 'APPROVE' });

            expect(res.status).toBe(200);
            expect(res.body.data.status).toBe('EXECUTED');

            // Verify in DB
            const checkLog = await prisma.agentLog.findUnique({ where: { id: recommendationLogId } });
            expect(checkLog.actionStatus).toBe('EXECUTED');
        });

        it('3.4 Idempotency: Re-executing an already executed action succeeds without re-running', async () => {
            const res = await request(app)
                .post(`/api/agent/actions/${recommendationLogId}/execute`)
                .set('Authorization', `Bearer ${tokenCompanyA}`)
                .send({ decision: 'APPROVE' });

            expect(res.status).toBe(200);
            expect(res.body.data.message).toContain('Idempotent');
        });

        it('3.5 Duplicate Prevention: Re-running the agent on the same day returns cached completed task', async () => {
            const todayDate = new Date().toISOString().slice(0, 10);
            const task1 = await recruitmentAgentService.executeSubTask({
                companyId: companyAId,
                taskType: 'WEEKLY_REPORT',
                userId: userAId
            });

            const task2 = await recruitmentAgentService.executeSubTask({
                companyId: companyAId,
                taskType: 'WEEKLY_REPORT',
                userId: userAId
            });

            expect(task1.id).toBe(task2.id);
        });
    });

    describe('4. Error Handling & Resilient Failure Recovery', () => {
        it('4.1 Should mark task as FAILED and record error in AgentLog on invalid task execution', async () => {
            const failedResult = await recruitmentAgentService.executeSubTask({
                companyId: companyAId,
                taskType: 'INVALID_TASK_TYPE_TEST',
                userId: userAId
            });

            expect(failedResult.status).toBe('FAILED');
            expect(failedResult.errorReason).toBeDefined();

            // Verify AgentLog has FAILED entry
            const errorLog = await prisma.agentLog.findFirst({
                where: {
                    companyId: companyAId,
                    action: 'INVALID_TASK_TYPE_TEST',
                    actionStatus: 'FAILED'
                }
            });
            expect(errorLog).toBeDefined();
            expect(errorLog.errorMessage).toBeDefined();
        });
    });
});
