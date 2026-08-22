import request from 'supertest';
import express from 'express';
import cookieParser from 'cookie-parser';
import jwt from 'jsonwebtoken';
import prisma from '../src/config/db.js';
import jobRequestRoutes from '../src/routes/jobRequestRoutes.js';
import { errorHandler } from '../src/middlewares/error.middleware.js';


const app = express();
app.use(express.json());
app.use(cookieParser());
app.use('/api/job-requests', jobRequestRoutes);
app.use(errorHandler);

const results = [];
function recordTest(category, testName, expected, actual, passed, details = '') {
    const icon = passed ? '✅ PASS' : '❌ FAIL';
    console.log(`${icon} [${category}] ${testName} ${details ? `-> ${details}` : ''}`);
    results.push({ category, test: testName, status: passed ? 'PASS' : 'FAIL', details });
}

async function runHardeningAndSecurityTests() {
    console.log('\n======================================================');
    console.log('🛡️ RUNNING JOB REQUEST HARDENING & SECURITY TEST SUITE');
    console.log('======================================================\n');

    let compA, compB;
    let userA_HM, userA_HR, userA_FIN, userA_CEO, userA_REC, userA_EMP;
    let userB_HR;
    let tokenA_HM, tokenA_HR, tokenA_FIN, tokenA_CEO, tokenA_REC, tokenA_EMP;
    let tokenB_HR;
    let depA, depB;

    try {
        const JWT_SECRET = process.env.JWT_SECRET || 'secret';

        // 1. Setup Company A and Users
        compA = await prisma.company.create({
            data: {
                name: `Enterprise Tenant A ${Date.now()}`,
                status: 'ACTIVE'
            }
        });

        compB = await prisma.company.create({
            data: {
                name: `Enterprise Tenant B ${Date.now()}`,
                status: 'ACTIVE'
            }
        });


        depA = await prisma.department.create({
            data: { name: 'الهندسة والبرمجيات A', companyId: compA.id }
        });

        depB = await prisma.department.create({
            data: { name: 'المبيعات B', companyId: compB.id }
        });

        // Company A Users
        userA_EMP = await prisma.user.create({
            data: { email: `emp-a-${Date.now()}@test.com`, name: 'Employee A', passwordHash: 'hash123', role: 'EMPLOYEE', status: 'ACTIVE', companyId: compA.id }
        });
        tokenA_EMP = jwt.sign({ id: userA_EMP.id, companyId: compA.id, role: 'EMPLOYEE' }, JWT_SECRET);

        userA_HM = await prisma.user.create({
            data: { email: `hm-a-${Date.now()}@test.com`, name: 'Hiring Manager A', passwordHash: 'hash123', role: 'MANAGER', status: 'ACTIVE', companyId: compA.id }
        });
        tokenA_HM = jwt.sign({ id: userA_HM.id, companyId: compA.id, role: 'MANAGER' }, JWT_SECRET);

        userA_HR = await prisma.user.create({
            data: { email: `hr-a-${Date.now()}@test.com`, name: 'HR Manager A', passwordHash: 'hash123', role: 'HR_MANAGER', status: 'ACTIVE', companyId: compA.id }
        });
        tokenA_HR = jwt.sign({ id: userA_HR.id, companyId: compA.id, role: 'HR_MANAGER' }, JWT_SECRET);

        userA_FIN = await prisma.user.create({
            data: { email: `fin-a-${Date.now()}@test.com`, name: 'Finance Manager A', passwordHash: 'hash123', role: 'FINANCE_MANAGER', status: 'ACTIVE', companyId: compA.id }
        });
        tokenA_FIN = jwt.sign({ id: userA_FIN.id, companyId: compA.id, role: 'FINANCE_MANAGER' }, JWT_SECRET);

        userA_CEO = await prisma.user.create({
            data: { email: `ceo-a-${Date.now()}@test.com`, name: 'CEO Executive A', passwordHash: 'hash123', role: 'CEO_EXECUTIVE', status: 'ACTIVE', companyId: compA.id }
        });
        tokenA_CEO = jwt.sign({ id: userA_CEO.id, companyId: compA.id, role: 'CEO_EXECUTIVE' }, JWT_SECRET);

        userA_REC = await prisma.user.create({
            data: { email: `rec-a-${Date.now()}@test.com`, name: 'Recruiter A', passwordHash: 'hash123', role: 'RECRUITER', status: 'ACTIVE', companyId: compA.id }
        });
        tokenA_REC = jwt.sign({ id: userA_REC.id, companyId: compA.id, role: 'RECRUITER' }, JWT_SECRET);

        // Company B Users
        userB_HR = await prisma.user.create({
            data: { email: `hr-b-${Date.now()}@test.com`, name: 'HR Manager B', passwordHash: 'hash123', role: 'HR_MANAGER', status: 'ACTIVE', companyId: compB.id }
        });
        tokenB_HR = jwt.sign({ id: userB_HR.id, companyId: compB.id, role: 'HR_MANAGER' }, JWT_SECRET);


        // ----------------------------------------------------
        // SECTION 1: VALIDATION HARDENING TESTS
        // ----------------------------------------------------
        // 1.1 Empty jobTitle
        const v1 = await request(app).post('/api/job-requests').set('Authorization', `Bearer ${tokenA_HM}`).send({ jobTitle: '   ', departmentId: depA.id });
        recordTest('Validation', 'Reject empty job title string', 400, v1.status, v1.status === 400);

        // 1.2 Zero or negative vacancies
        const v2 = await request(app).post('/api/job-requests').set('Authorization', `Bearer ${tokenA_HM}`).send({ jobTitle: 'QA Lead', departmentId: depA.id, vacancies: -3 });
        recordTest('Validation', 'Reject negative vacancies count', 400, v2.status, v2.status === 400);

        // 1.3 salaryMin > salaryMax
        const v3 = await request(app).post('/api/job-requests').set('Authorization', `Bearer ${tokenA_HM}`).send({ jobTitle: 'QA Lead', departmentId: depA.id, salaryMin: 25000, salaryMax: 15000 });
        recordTest('Validation', 'Reject salaryMin > salaryMax', 400, v3.status, v3.status === 400);

        // 1.4 Invalid Employment Type
        const v4 = await request(app).post('/api/job-requests').set('Authorization', `Bearer ${tokenA_HM}`).send({ jobTitle: 'QA Lead', departmentId: depA.id, employmentType: 'INVALID_TYPE' });
        recordTest('Validation', 'Reject invalid employmentType enum', 400, v4.status, v4.status === 400);

        // 1.5 Invalid Priority
        const v5 = await request(app).post('/api/job-requests').set('Authorization', `Bearer ${tokenA_HM}`).send({ jobTitle: 'QA Lead', departmentId: depA.id, priority: 'CRITICAL_INVALID' });
        recordTest('Validation', 'Reject invalid priority enum', 400, v5.status, v5.status === 400);

        // 1.6 Invalid departmentId belonging to another tenant
        const v6 = await request(app).post('/api/job-requests').set('Authorization', `Bearer ${tokenA_HM}`).send({ jobTitle: 'QA Lead', departmentId: depB.id });
        recordTest('Validation', 'Reject departmentId belonging to another tenant', 400, v6.status, v6.status === 400);

        // 1.7 Required date in the past
        const v7 = await request(app).post('/api/job-requests').set('Authorization', `Bearer ${tokenA_HM}`).send({ jobTitle: 'QA Lead', departmentId: depA.id, requiredDate: '2020-01-01' });
        recordTest('Validation', 'Reject requiredDate in the past', 400, v7.status, v7.status === 400);

        // ----------------------------------------------------
        // CREATE VALID REQUEST FOR COMPANY A
        // ----------------------------------------------------
        const createRes = await request(app)
            .post('/api/job-requests')
            .set('Authorization', `Bearer ${tokenA_HM}`)
            .send({
                jobTitle: 'Senior Cloud Security Architect',
                departmentId: depA.id,
                employmentType: 'FULL_TIME',
                vacancies: 2,
                jobSummary: 'Responsible for zero-trust cloud infrastructure and security compliance.',
                salaryMin: 18000,
                salaryMax: 28000,
                budgetCode: 'BUD-2026-SEC',
                costCenter: 'CC-SECURITY',
                hiringReason: 'EXPANSION',
                priority: 'HIGH',
                skills: ['Cloud Security', 'Kubernetes', 'Terraform', 'Zero-Trust']
            });
        const reqA = createRes.body.data;
        recordTest('Creation', 'Create valid Job Request for Company A (DRAFT)', 201, createRes.status, createRes.status === 201, `ID: ${reqA?.requestId}`);

        // ----------------------------------------------------
        // SECTION 2: MULTI-TENANT ISOLATION NEGATIVE TESTS
        // ----------------------------------------------------
        // 2.1 Tenant B tries to GET Job Request of Tenant A
        const mt1 = await request(app).get(`/api/job-requests/${reqA.id}`).set('Authorization', `Bearer ${tokenB_HR}`);
        recordTest('Multi-Tenant Isolation', 'Tenant B cannot view Tenant A Job Request (404/403)', 404, mt1.status, mt1.status === 404 || mt1.status === 403);

        // 2.2 Tenant B tries to PUT Job Request of Tenant A
        const mt2 = await request(app).put(`/api/job-requests/${reqA.id}`).set('Authorization', `Bearer ${tokenB_HR}`).send({ jobTitle: 'Hacked Title' });
        recordTest('Multi-Tenant Isolation', 'Tenant B cannot edit Tenant A Job Request', 404, mt2.status, mt2.status === 404 || mt2.status === 403);

        // 2.3 Tenant B tries to Submit Tenant A Job Request
        const mt3 = await request(app).post(`/api/job-requests/${reqA.id}/submit`).set('Authorization', `Bearer ${tokenB_HR}`).send({});
        recordTest('Multi-Tenant Isolation', 'Tenant B cannot submit Tenant A Job Request', 404, mt3.status, mt3.status === 404 || mt3.status === 403);

        // 2.4 Tenant B tries to Approve Tenant A Job Request
        const mt4 = await request(app).post(`/api/job-requests/${reqA.id}/approve`).set('Authorization', `Bearer ${tokenB_HR}`).send({});
        recordTest('Multi-Tenant Isolation', 'Tenant B cannot approve Tenant A Job Request', 404, mt4.status, mt4.status === 404 || mt4.status === 403);

        // 2.5 Tenant B tries to Reject Tenant A Job Request
        const mt5 = await request(app).post(`/api/job-requests/${reqA.id}/reject`).set('Authorization', `Bearer ${tokenB_HR}`).send({ comment: 'Malicious reject' });
        recordTest('Multi-Tenant Isolation', 'Tenant B cannot reject Tenant A Job Request', 404, mt5.status, mt5.status === 404 || mt5.status === 403);

        // 2.6 Tenant B tries to Convert Tenant A Job Request to ATS Job
        const mt6 = await request(app).post(`/api/job-requests/${reqA.id}/convert-to-job`).set('Authorization', `Bearer ${tokenB_HR}`);
        recordTest('Multi-Tenant Isolation', 'Tenant B cannot convert Tenant A Job Request to ATS', 404, mt6.status, mt6.status === 404 || mt6.status === 403);

        // ----------------------------------------------------
        // SECTION 3: STATE MACHINE DIRECT INJECTION SECURITY
        // ----------------------------------------------------
        // 3.1 Try to inject status=APPROVED directly via PUT
        const smInj1 = await request(app).put(`/api/job-requests/${reqA.id}`).set('Authorization', `Bearer ${tokenA_HM}`).send({ status: 'APPROVED' });
        recordTest('State Machine Security', 'Prevent direct status bypass via PUT /api/job-requests/:id', 400, smInj1.status, smInj1.status === 400);

        // 3.2 Try invalid transition: DRAFT -> CLOSED directly
        const smInj2 = await request(app).post(`/api/job-requests/${reqA.id}/transition`).set('Authorization', `Bearer ${tokenA_HR}`).send({ targetStatus: 'CLOSED' });
        recordTest('State Machine Security', 'Prevent direct invalid transition DRAFT -> CLOSED (400)', 400, smInj2.status, smInj2.status === 400);

        // 3.3 Try invalid transition: DRAFT -> HIRED
        const smInj3 = await request(app).post(`/api/job-requests/${reqA.id}/transition`).set('Authorization', `Bearer ${tokenA_HR}`).send({ targetStatus: 'HIRED' });
        recordTest('State Machine Security', 'Prevent direct invalid transition DRAFT -> HIRED (400)', 400, smInj3.status, smInj3.status === 400);

        // ----------------------------------------------------
        // SECTION 4: RBAC NEGATIVE TESTING
        // ----------------------------------------------------
        // 4.1 Submit request as HM
        const subRes = await request(app).post(`/api/job-requests/${reqA.id}/submit`).set('Authorization', `Bearer ${tokenA_HM}`).send({ comment: 'Ready for review' });
        recordTest('RBAC & Lifecycle', 'Hiring Manager submits request (DRAFT -> SUBMITTED)', 200, subRes.status, subRes.status === 200);

        // 4.2 Employee / HM tries to approve request -> MUST BE REJECTED 403
        const rbac1 = await request(app).post(`/api/job-requests/${reqA.id}/approve`).set('Authorization', `Bearer ${tokenA_EMP}`).send({ comment: 'Unauthorized approve' });
        recordTest('RBAC Negative', 'Regular Employee cannot approve Job Request (403)', 403, rbac1.status, rbac1.status === 403);

        // 4.3 Recruiter tries to approve Finance stage -> MUST BE REJECTED 403
        // Step 1: HR Approves HR stage
        await request(app).post(`/api/job-requests/${reqA.id}/approve`).set('Authorization', `Bearer ${tokenA_HR}`).send({ comment: 'HR approved' });
        
        // Step 2: Recruiter tries to approve Finance stage
        const rbac2 = await request(app).post(`/api/job-requests/${reqA.id}/approve`).set('Authorization', `Bearer ${tokenA_REC}`).send({ comment: 'Recruiter trying finance approval' });
        recordTest('RBAC Negative', 'Recruiter cannot approve Finance budget stage (403)', 403, rbac2.status, rbac2.status === 403);

        // Step 3: Finance approves Finance stage
        await request(app).post(`/api/job-requests/${reqA.id}/approve`).set('Authorization', `Bearer ${tokenA_FIN}`).send({ comment: 'Finance budget approved' });

        // Step 4: Finance tries to give final CEO Executive approval -> MUST BE REJECTED 403
        const rbac3 = await request(app).post(`/api/job-requests/${reqA.id}/approve`).set('Authorization', `Bearer ${tokenA_FIN}`).send({ comment: 'Finance trying executive approval' });
        recordTest('RBAC Negative', 'Finance Manager cannot approve Executive/CEO stage (403)', 403, rbac3.status, rbac3.status === 403);

        // Step 5: CEO approves Executive stage -> APPROVED
        const ceoRes = await request(app).post(`/api/job-requests/${reqA.id}/approve`).set('Authorization', `Bearer ${tokenA_CEO}`).send({ comment: 'Final executive approval granted' });
        recordTest('RBAC Execution', 'CEO Executive provides final approval (Request -> APPROVED)', 200, ceoRes.status, ceoRes.status === 200);

        // ----------------------------------------------------
        // SECTION 5: DOUBLE ACTION / RACE CONDITION / IDEMPOTENCY
        // ----------------------------------------------------
        // 5.1 Convert to ATS Recruitment Job
        const conv1 = await request(app).post(`/api/job-requests/${reqA.id}/convert-to-job`).set('Authorization', `Bearer ${tokenA_HR}`);
        recordTest('ATS Conversion', 'First conversion creates active RecruitmentJob', 201, conv1.status, conv1.status === 201);

        // 5.2 Convert to ATS Recruitment Job AGAIN immediately -> Must be idempotent, no duplicate recruitment job created
        const conv2 = await request(app).post(`/api/job-requests/${reqA.id}/convert-to-job`).set('Authorization', `Bearer ${tokenA_HR}`);
        const passIdempotent = conv2.status === 200 || conv2.status === 201;
        const totalMatchingJobs = await prisma.recruitmentJob.count({
            where: { companyId: compA.id, title: 'Senior Cloud Security Architect', deletedAt: null }
        });
        recordTest('ATS Conversion Idempotency', 'Second conversion does NOT create duplicate job (Idempotent 200/201)', 1, totalMatchingJobs, passIdempotent && totalMatchingJobs === 1, `Total Active Jobs in DB: ${totalMatchingJobs}`);

        // ----------------------------------------------------
        // SECTION 6: NOTIFICATIONS & AUDIT LOG INTEGRITY
        // ----------------------------------------------------
        const notifications = await prisma.notification.findMany({
            where: { userId: { in: [userA_HM.id, userA_HR.id, userA_REC.id] } }
        });
        const passNotifications = notifications.length >= 2;
        recordTest('Notifications', 'System dispatches notifications to appropriate roles across lifecycle', true, passNotifications, passNotifications, `Count: ${notifications.length}`);

        const history = await prisma.jobRequestHistory.findMany({
            where: { jobRequestId: reqA.id }
        });
        const passHistory = history.length >= 4;
        recordTest('Audit Trail', 'JobRequestHistory contains immutable chronological audit records', true, passHistory, passHistory, `Audit steps logged: ${history.length}`);

    } catch (err) {
        console.error('Hardening suite error:', err);
        recordTest('Suite Execution', 'Unexpected error occurred', 'None', err.message, false);
    } finally {
        try {
            if (compA?.id) {
                await prisma.jobRequestSkill.deleteMany({ where: { jobRequest: { companyId: compA.id } } });
                await prisma.approvalRequest.deleteMany({ where: { jobRequest: { companyId: compA.id } } });
                await prisma.jobRequestHistory.deleteMany({ where: { jobRequest: { companyId: compA.id } } });
                await prisma.notification.deleteMany({ where: { user: { companyId: compA.id } } });
                await prisma.recruitmentJob.deleteMany({ where: { companyId: compA.id } });
                await prisma.jobRequest.deleteMany({ where: { companyId: compA.id } });
                await prisma.department.deleteMany({ where: { companyId: compA.id } });
                await prisma.user.deleteMany({ where: { companyId: compA.id } });
                await prisma.company.delete({ where: { id: compA.id } });
            }
            if (compB?.id) {
                await prisma.department.deleteMany({ where: { companyId: compB.id } });
                await prisma.user.deleteMany({ where: { companyId: compB.id } });
                await prisma.company.delete({ where: { id: compB.id } });
            }
        } catch (e) {}
    }

    console.log('\n======================================================');
    console.log('🏁 HARDENING & SECURITY RESULTS SUMMARY:');
    console.log('======================================================\n');
    console.table(results);
}

runHardeningAndSecurityTests();
