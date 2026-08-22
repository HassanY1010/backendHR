import dotenv from 'dotenv';
dotenv.config();
import prisma from '../src/config/db.js';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import app from '../src/app.js';

const JWT_SECRET = process.env.JWT_SECRET || 'secret';
const testResults = [];

function recordTest(category, testName, expected, actual, pass, evidence = '') {
    testResults.push({ category, testName, expected, actual, status: pass ? 'PASS' : 'FAIL', evidence });
    console.log(`[${pass ? 'PASS' : 'FAIL'}] [${category}] ${testName} ${evidence ? `-> ${evidence}` : ''}`);
}

async function runJobRequestAudit() {
    console.log('\n======================================================');
    console.log('🏛️ RUNNING JOB REQUEST MANAGEMENT SYSTEM 100% AUDIT');
    console.log('======================================================\n');

    let connected = false;
    for (let retry = 1; retry <= 5; retry++) {
        try {
            await prisma.$queryRaw`SELECT 1`;
            connected = true;
            break;
        } catch (e) {
            await new Promise(r => setTimeout(r, 2000));
        }
    }
    if (!connected) throw new Error('Database connection failed.');

    const uniqueSuffix = Date.now();
    let comp, dep, hrUser, hiringManagerUser, recruiterUser, financeUser, ceoUser, empUser;
    let hrToken, hmToken, recToken, finToken, ceoToken, empToken;
    let createdJobRequest;

    try {
        // 1. Setup Company & Department
        comp = await prisma.company.create({
            data: { name: `JobRequest Test Corp ${uniqueSuffix}`, status: 'ACTIVE', updatedAt: new Date() }
        });
        dep = await prisma.department.create({
            data: { name: 'هندسة البرمجيات', companyId: comp.id }
        });

        // 2. Setup RBAC Roles
        const makeUser = async (name, emailRole, role) => {
            return await prisma.user.create({
                data: {
                    name,
                    email: `${emailRole}_${uniqueSuffix}@company.com`,
                    passwordHash: '$2b$10$ep/C/mE7b9h8H9JbH/rVDezB7fE2zK2U1qY0wO6E1Z.l8b6R5N0G2',
                    role,
                    companyId: comp.id
                }
            });
        };

        hrUser = await makeUser('HR Director', 'hr', 'HR_MANAGER');
        hiringManagerUser = await makeUser('Hiring Manager', 'hm', 'MANAGER');
        recruiterUser = await makeUser('Talent Recruiter', 'rec', 'RECRUITER');
        financeUser = await makeUser('Finance Lead', 'fin', 'FINANCE_MANAGER');
        ceoUser = await makeUser('Chief Executive', 'ceo', 'CEO_EXECUTIVE');
        empUser = await makeUser('Normal Employee', 'emp', 'EMPLOYEE');

        hrToken = jwt.sign({ id: hrUser.id, email: hrUser.email, role: hrUser.role, companyId: comp.id }, JWT_SECRET);
        hmToken = jwt.sign({ id: hiringManagerUser.id, email: hiringManagerUser.email, role: hiringManagerUser.role, companyId: comp.id }, JWT_SECRET);
        recToken = jwt.sign({ id: recruiterUser.id, email: recruiterUser.email, role: recruiterUser.role, companyId: comp.id }, JWT_SECRET);
        finToken = jwt.sign({ id: financeUser.id, email: financeUser.email, role: financeUser.role, companyId: comp.id }, JWT_SECRET);
        ceoToken = jwt.sign({ id: ceoUser.id, email: ceoUser.email, role: ceoUser.role, companyId: comp.id }, JWT_SECRET);
        empToken = jwt.sign({ id: empUser.id, email: empUser.email, role: empUser.role, companyId: comp.id }, JWT_SECRET);

        recordTest('RBAC Setup', 'Setup 6 Distinct User Roles (Employee, HM, HR, Recruiter, Finance, CEO)', true, true, true);

        // 3. Validation: Reject create without Job Title
        const rejectNoTitle = await request(app)
            .post('/api/job-requests')
            .set('Authorization', `Bearer ${hmToken}`)
            .send({ departmentId: dep.id, vacancies: 2 });
        recordTest('Validation Rules', 'Reject job request creation without Job Title (400)', 400, rejectNoTitle.status, rejectNoTitle.status === 400);

        // 4. Create Job Request (Full specifications)
        const createRes = await request(app)
            .post('/api/job-requests')
            .set('Authorization', `Bearer ${hmToken}`)
            .send({
                jobTitle: 'Senior Backend Developer (Node.js)',
                departmentId: dep.id,
                location: 'الرياض',
                employmentType: 'FULL_TIME',
                vacancies: 5,
                jobSummary: 'قيادة تصميم وهندسة الخدمات الخلفية وبناء واجهات API عالية الكفاءة',
                requiredSkills: 'Node.js, PostgreSQL, Docker, Redis, Microservices',
                skills: ['Node.js', 'PostgreSQL', 'Docker', 'Redis'],
                requiredExperience: '5+ سنوات في تطوير تطبيقات Enterprise',
                educationLevel: 'بكالوريوس علوم الحاسب',
                certifications: 'AWS Certified Solutions Architect',
                languages: 'العربية، الإنجليزية',
                responsibilities: 'بناء الـ APIs وتصميم قواعد البيانات وضمان استقرار النظام',
                salaryMin: 22000,
                salaryMax: 30000,
                budgetCode: 'BUD-2026-ENG',
                costCenter: 'CC-TECH-01',
                hiringReason: 'EXPANSION',
                priority: 'HIGH',
                requiredDate: new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString()
            });

        createdJobRequest = createRes.body.data;
        const passCreate = createRes.status === 201 && createdJobRequest?.requestId && createdJobRequest?.status === 'DRAFT';
        recordTest('Create Job Request', 'Create full Job Request with auto Request ID (DRAFT)', true, passCreate, passCreate, `Request ID: ${createdJobRequest?.requestId}`);

        // 5. Update Job Request in DRAFT mode
        const updateRes = await request(app)
            .put(`/api/job-requests/${createdJobRequest.id}`)
            .set('Authorization', `Bearer ${hmToken}`)
            .send({ vacancies: 6, priority: 'URGENT' });
        const passUpdate = updateRes.status === 200 && updateRes.body.data.vacancies === 6 && updateRes.body.data.priority === 'URGENT';
        recordTest('Job Request Lifecycle', 'Edit Job Request before submission (DRAFT update)', true, passUpdate, passUpdate);

        // 6. State Machine: Submit Request for Review (DRAFT -> SUBMITTED)
        const submitRes = await request(app)
            .post(`/api/job-requests/${createdJobRequest.id}/submit`)
            .set('Authorization', `Bearer ${hmToken}`)
            .send({ comment: 'تم استكمال تفاصيل الشواغر وتحديد الميزانية للمراجعة والاعتماد' });
        const passSubmit = submitRes.status === 200;
        recordTest('State Machine', 'Submit Job Request (DRAFT -> SUBMITTED)', 200, submitRes.status, passSubmit);

        // 7. Multi-Level Approval Chain: HR Review
        const hrApproveRes = await request(app)
            .post(`/api/job-requests/${createdJobRequest.id}/approve`)
            .set('Authorization', `Bearer ${hrToken}`)
            .send({ comment: 'تمت مراجعة الوصف الوظيفي والموافقة المبدئية من إدارة الموارد البشرية' });
        recordTest('Approval Flow', 'HR Manager approves request', 200, hrApproveRes.status, hrApproveRes.status === 200);

        // 8. Multi-Level Approval Chain: Finance Review
        const finApproveRes = await request(app)
            .post(`/api/job-requests/${createdJobRequest.id}/approve`)
            .set('Authorization', `Bearer ${finToken}`)
            .send({ comment: 'تمت مراجعة التكلفة والاعتماد المالي ضمن ميزانية التوسع' });
        recordTest('Approval Flow', 'Finance Manager approves budget and cost', 200, finApproveRes.status, finApproveRes.status === 200);

        // 9. Multi-Level Approval Chain: CEO Final Approval (APPROVED)
        const ceoApproveRes = await request(app)
            .post(`/api/job-requests/${createdJobRequest.id}/approve`)
            .set('Authorization', `Bearer ${ceoToken}`)
            .send({ comment: 'الموافقة التنفيذية النهائية وبدء عملية التوظيف' });
        const passApproved = ceoApproveRes.status === 200;
        recordTest('Approval Flow', 'CEO provides final approval (Request -> APPROVED)', 200, ceoApproveRes.status, passApproved);


        // 10. ATS Integration: Convert Approved Job Request to Active Recruitment Job (While APPROVED)
        const convertRes = await request(app)
            .post(`/api/job-requests/${createdJobRequest.id}/convert-to-job`)
            .set('Authorization', `Bearer ${hrToken}`);
        const passConvert = convertRes.status === 201 || convertRes.status === 200;
        recordTest('ATS Integration', 'Seamless conversion of Job Request into Active ATS Recruitment Job', true, passConvert, passConvert);

        // 11. State Machine Guard: Cannot jump from DRAFT or Invalid state to Interview Process directly
        const testInvalidJump = await request(app)
            .post(`/api/job-requests/${createdJobRequest.id}/transition`)
            .set('Authorization', `Bearer ${hrToken}`)
            .send({ targetStatus: 'CLOSED' });
        const passGuard = testInvalidJump.status === 400 || testInvalidJump.body.error !== undefined;
        recordTest('State Machine Guard', 'Prevent invalid state jump (Cannot close non-hired request)', true, passGuard, passGuard);

        // 12. State Machine Progression: RECRUITMENT_STARTED -> INTERVIEW_PROCESS -> OFFER_STAGE -> HIRED -> CLOSED
        const step2 = await request(app).post(`/api/job-requests/${createdJobRequest.id}/transition`).set('Authorization', `Bearer ${hrToken}`).send({ targetStatus: 'INTERVIEW_PROCESS' });
        const step3 = await request(app).post(`/api/job-requests/${createdJobRequest.id}/transition`).set('Authorization', `Bearer ${hrToken}`).send({ targetStatus: 'OFFER_STAGE' });
        const step4 = await request(app).post(`/api/job-requests/${createdJobRequest.id}/transition`).set('Authorization', `Bearer ${hrToken}`).send({ targetStatus: 'HIRED' });
        const step5 = await request(app).post(`/api/job-requests/${createdJobRequest.id}/transition`).set('Authorization', `Bearer ${hrToken}`).send({ targetStatus: 'CLOSED' });
        const passLifecycle = step2.status === 200 && step3.status === 200 && step4.status === 200 && step5.status === 200;
        recordTest('State Machine Lifecycle', 'Full Pipeline Progression (RECRUITMENT -> INTERVIEW -> OFFER -> HIRED -> CLOSED)', true, passLifecycle, passLifecycle);

        // 13. Audit Trail & History Verification
        const historyLogs = await prisma.jobRequestHistory.findMany({
            where: { jobRequestId: createdJobRequest.id },
            orderBy: { createdAt: 'asc' }
        });
        const passAudit = historyLogs.length >= 5;
        recordTest('Audit Log & History', 'JobRequestHistory records all state transitions with performer & comments', true, passAudit, passAudit, `Total Audit Steps: ${historyLogs.length}`);

        // 14. Metrics & Dashboard Stats API
        const statsRes = await request(app)
            .get('/api/job-requests/stats')
            .set('Authorization', `Bearer ${hrToken}`);
        const passStats = statsRes.status === 200 && statsRes.body.totalRequests !== undefined;
        recordTest('Reports & Analytics', 'Retrieve Job Requests Analytics & Metrics Dashboard API', 200, statsRes.status, passStats, `Total in Corp: ${statsRes.body.totalRequests}`);


    } catch (err) {
        console.error('Job Request Audit Error:', err);
        recordTest('Audit Suite', 'Execution Error', 'No error', err.message, false);
    } finally {
        try {
            if (comp?.id) {
                await prisma.jobRequestSkill.deleteMany({ where: { jobRequest: { companyId: comp.id } } });
                await prisma.approvalRequest.deleteMany({ where: { jobRequest: { companyId: comp.id } } });
                await prisma.jobRequestHistory.deleteMany({ where: { jobRequest: { companyId: comp.id } } });
                await prisma.onHoldLog.deleteMany({ where: { jobRequest: { companyId: comp.id } } });
                await prisma.jobRequest.deleteMany({ where: { companyId: comp.id } });
                await prisma.recruitmentJob.deleteMany({ where: { companyId: comp.id } });
                await prisma.department.deleteMany({ where: { companyId: comp.id } });
                await prisma.user.deleteMany({ where: { companyId: comp.id } });
                await prisma.company.delete({ where: { id: comp.id } });
            }
        } catch (e) {}

        console.log('\n======================================================');
        console.log('🏁 JOB REQUEST AUDIT RESULTS:');
        console.log('======================================================\n');
        console.table(testResults.map(r => ({ Category: r.category, Test: r.testName, Status: r.status, Evidence: r.evidence })));
    }
}

runJobRequestAudit();
