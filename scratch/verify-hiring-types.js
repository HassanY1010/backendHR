import request from 'supertest';
import express from 'express';
import cookieParser from 'cookie-parser';
import jwt from 'jsonwebtoken';
import prisma from '../src/config/db.js';
import hiringPlanRoutes from '../src/routes/hiring-plan.routes.js';
import hiringReportsRoutes from '../src/routes/hiring-reports.routes.js';
import jobRequestRoutes from '../src/routes/jobRequestRoutes.js';
import { errorHandler } from '../src/middlewares/error.middleware.js';

const app = express();
app.use(express.json());
app.use(cookieParser());
app.use('/api/hiring-plans', hiringPlanRoutes);
app.use('/api/hiring-reports', hiringReportsRoutes);
app.use('/api/job-requests', jobRequestRoutes);
app.use(errorHandler);

const verificationLog = [];

function recordCheck(num, category, testName, expected, actual, passed, details = '') {
    const status = passed ? '✅ PASS' : (passed === null ? '⚠️ PARTIAL' : '❌ FAIL');
    console.log(`[#${num}] ${status} [${category}] ${testName}`);
    console.log(`     Expected: ${expected} | Actual: ${actual}`);
    console.log(`     Details: ${details}\n`);
    verificationLog.push({
        num,
        category,
        testName,
        expected: String(expected),
        actual: String(actual),
        status: passed ? 'PASS' : (passed === null ? 'PARTIAL' : 'FAIL'),
        details
    });
}

async function verifyHiringTypesSystem() {
    console.log('================================================================================');
    console.log('🔬 DEEP VERIFICATION: 3 HIRING TYPES SYSTEM (IMMEDIATE, PLANNED, ON-HOLD)');
    console.log('================================================================================\n');

    let comp, dept, userHR, tokenHR;
    const JWT_SECRET = process.env.JWT_SECRET || 'secret';

    try {
        // Setup Company, Dept, User
        comp = await prisma.company.create({ data: { name: `HiringTypesTest_${Date.now()}`, status: 'ACTIVE' } });
        dept = await prisma.department.create({ data: { name: 'Engineering', companyId: comp.id } });
        userHR = await prisma.user.create({
            data: { email: `hr_${Date.now()}@hiringtest.com`, name: 'HR Director Sarah', passwordHash: 'hash', role: 'HR_MANAGER', status: 'ACTIVE', companyId: comp.id }
        });
        tokenHR = jwt.sign({ id: userHR.id, companyId: comp.id, role: 'HR_MANAGER', name: userHR.name }, JWT_SECRET);

        // -------------------------------------------------------------
        // 1. Immediate Hiring Verification
        // -------------------------------------------------------------
        console.log('--- 1. Testing Immediate Hiring ---');
        const reqDate = new Date(Date.now() + 5 * 86400000).toISOString();
        const deadDate = new Date(Date.now() + 10 * 86400000).toISOString();

        const immRes = await request(app).post('/api/job-requests').set('Authorization', `Bearer ${tokenHR}`).send({
            jobTitle: 'Senior Site Reliability Engineer (Immediate)',
            departmentId: dept.id,
            location: 'Riyadh HQ',
            vacancies: 2,
            hiringType: 'IMMEDIATE',
            priority: 'URGENT',
            requiredDate: reqDate,
            hiringDeadline: deadDate,
            employmentType: 'FULL_TIME'
        });

        const createdImmJob = immRes.body.data;
        const immPassed = immRes.status === 201 && createdImmJob?.hiringType === 'IMMEDIATE' && createdImmJob?.priority === 'URGENT' && createdImmJob?.hiringDeadline !== null;
        recordCheck(1, 'Immediate Hiring', 'Creation with Urgent Priority, Required Date & Hiring Deadline', 'IMMEDIATE, URGENT & Deadline present', `${createdImmJob?.hiringType}, ${createdImmJob?.priority}`, immPassed, `Job ID: ${createdImmJob?.id}, Deadline: ${createdImmJob?.hiringDeadline}`);

        // -------------------------------------------------------------
        // 2. Manpower Force Plan (Annual Plan 2027) Verification
        // -------------------------------------------------------------
        console.log('--- 2. Testing Manpower Force Plan (Annual Plan 2027) ---');
        const plan1 = await request(app).post('/api/hiring-plans').set('Authorization', `Bearer ${tokenHR}`).send({
            year: 2027,
            departmentId: dept.id,
            position: 'Backend Developer',
            quantity: 10,
            expectedDate: '2027-06-01',
            budget: 1500000,
            notes: 'Expansion plan for 2027 backend core services'
        });

        const plan2 = await request(app).post('/api/hiring-plans').set('Authorization', `Bearer ${tokenHR}`).send({
            year: 2027,
            departmentId: dept.id,
            position: 'Data Analyst',
            quantity: 5,
            expectedDate: '2027-09-01',
            budget: 600000,
            notes: 'BI and analytics department ramp up'
        });

        const planCreatedPassed = plan1.status === 201 && plan2.status === 201;
        recordCheck(2, 'Manpower Force Plan', 'Create 2027 Plan: Backend Dev x10, Data Analyst x5 with Budgets', '201 Created for both', `P1: ${plan1.status}, P2: ${plan2.status}`, planCreatedPassed, `Plan IDs: ${plan1.body.data?.id}, ${plan2.body.data?.id}`);

        // Test Manpower Dashboard API
        const dashRes = await request(app).get('/api/hiring-plans/dashboard?year=2027').set('Authorization', `Bearer ${tokenHR}`);
        const dashData = dashRes.body.data;
        const dashPassed = dashRes.status === 200 && dashData?.kpis?.totalPlannedPositions === 15 && dashData?.kpis?.totalAllocatedBudget === 2100000;
        recordCheck(3, 'Manpower Dashboard', 'Annual 2027 Dashboard aggregates positions (15) and total budget (2.1M SAR)', 'Total Positions: 15, Budget: 2100000', `Positions: ${dashData?.kpis?.totalPlannedPositions}, Budget: ${dashData?.kpis?.totalAllocatedBudget}`, dashPassed, `Departments: ${dashData?.departmentBreakdown?.length}`);

        // Link a Job Request to Manpower Plan
        const plannedJobRes = await request(app).post('/api/job-requests').set('Authorization', `Bearer ${tokenHR}`).send({
            jobTitle: 'Backend Developer (Plan 2027)',
            departmentId: dept.id,
            location: 'Riyadh HQ',
            hiringType: 'PLANNED',
            hiringPlanId: plan1.body.data.id,
            employmentType: 'FULL_TIME'
        });
        const planLinkPassed = plannedJobRes.status === 201 && plannedJobRes.body.data?.hiringPlanId === plan1.body.data.id;
        recordCheck(4, 'Planned Job Request', 'Job Request successfully linked to Manpower Force Plan', plan1.body.data.id, plannedJobRes.body.data?.hiringPlanId, planLinkPassed, `Linked to Plan ID: ${plan1.body.data.id}`);

        // -------------------------------------------------------------
        // 3. On Hold Hiring Verification
        // -------------------------------------------------------------
        console.log('--- 3. Testing On Hold Hiring & Freeze Workflow ---');
        const onHoldRes = await request(app).post('/api/job-requests').set('Authorization', `Bearer ${tokenHR}`).send({
            jobTitle: 'AI Research Scientist',
            departmentId: dept.id,
            location: 'Riyadh HQ',
            hiringType: 'ON_HOLD',
            freezeReason: 'BUDGET_PENDING',
            frozenDate: new Date().toISOString(),
            resumeDate: new Date(Date.now() + 30 * 86400000).toISOString(),
            ownerName: userHR.name,
            employmentType: 'FULL_TIME'
        });

        const createdOnHoldJob = onHoldRes.body.data;
        const onHoldCreatedPassed = onHoldRes.status === 201 && createdOnHoldJob?.hiringType === 'ON_HOLD' && createdOnHoldJob?.freezeReason === 'BUDGET_PENDING';
        recordCheck(5, 'On Hold Hiring', 'Create Job with freezeReason (BUDGET_PENDING), frozenDate, resumeDate, owner', 'ON_HOLD & BUDGET_PENDING', `${createdOnHoldJob?.hiringType} & ${createdOnHoldJob?.freezeReason}`, onHoldCreatedPassed, `Job ID: ${createdOnHoldJob?.id}`);

        // Freeze an active job request
        const freezeActionRes = await request(app).post(`/api/job-requests/${createdImmJob.id}/freeze`).set('Authorization', `Bearer ${tokenHR}`).send({
            freezeReason: 'MANAGEMENT_APPROVAL',
            resumeDate: new Date(Date.now() + 14 * 86400000).toISOString(),
            comment: 'تجميد مؤقت لحين مراجعة مجلس الإدارة'
        });
        const freezeActionPassed = freezeActionRes.status === 200 && freezeActionRes.body.data?.status === 'ON_HOLD';
        recordCheck(6, 'Freeze Action API', 'Freeze existing Job Request with MANAGEMENT_APPROVAL & audit log', 'Status: ON_HOLD', `Status: ${freezeActionRes.body.data?.status}`, freezeActionPassed, `Updated freezeReason: ${freezeActionRes.body.data?.freezeReason}`);

        // -------------------------------------------------------------
        // 4. Hiring Types Reports & Analytics Verification
        // -------------------------------------------------------------
        console.log('--- 4. Testing Hiring Types Comprehensive Reports ---');
        // Create an active Immediate job to ensure immediateJobsCount is tested alongside frozen jobs
        await request(app).post('/api/job-requests').set('Authorization', `Bearer ${tokenHR}`).send({
            jobTitle: 'Frontend Engineer (Immediate Active)',
            departmentId: dept.id,
            location: 'Riyadh HQ',
            hiringType: 'IMMEDIATE',
            priority: 'URGENT',
            hiringDeadline: new Date(Date.now() + 7 * 86400000).toISOString(),
            employmentType: 'FULL_TIME'
        });

        const reportRes = await request(app).get('/api/hiring-reports/summary').set('Authorization', `Bearer ${tokenHR}`);
        const reportData = reportRes.body.data;

        const hasSummary = reportData?.summary?.immediateJobsCount >= 1 && reportData?.summary?.totalPlannedPositions === 15 && reportData?.summary?.onHoldJobsCount >= 2;
        const hasDistribution = reportData?.freezeReasonDistribution?.some(r => r.reason === 'BUDGET_PENDING') && reportData?.freezeReasonDistribution?.some(r => r.reason === 'MANAGEMENT_APPROVAL');

        recordCheck(7, 'Hiring Reports API', 'Reports aggregate Immediate urgent counts, Future plans & On-hold reasons', 'Summary & Distributions correct', `Immediate: ${reportData?.summary?.immediateJobsCount}, Planned: ${reportData?.summary?.totalPlannedPositions}, OnHold: ${reportData?.summary?.onHoldJobsCount}`, hasSummary && hasDistribution, `Freeze Reasons tracked: ${reportData?.freezeReasonDistribution?.map(r => `${r.reason}:${r.count}`).join(', ')}`);

    } catch (err) {
        console.error('Fatal Verification Error:', err);
    } finally {
        try {
            if (comp?.id) {
                await prisma.onHoldLog.deleteMany({ where: { jobRequest: { companyId: comp.id } } });
                await prisma.jobRequest.deleteMany({ where: { companyId: comp.id } });
                await prisma.hiringPlan.deleteMany({ where: { companyId: comp.id } });
                await prisma.department.deleteMany({ where: { companyId: comp.id } });
                await prisma.user.deleteMany({ where: { companyId: comp.id } });
                await prisma.company.delete({ where: { id: comp.id } });
            }
        } catch (e) {}
    }

    console.log('\n================================================================================');
    console.log('🏁 FINAL HIRING TYPES VERIFICATION RESULTS:');
    console.log('================================================================================\n');
    console.table(verificationLog);

    const total = verificationLog.length;
    const passCount = verificationLog.filter(v => v.status === 'PASS').length;
    const partialCount = verificationLog.filter(v => v.status === 'PARTIAL').length;
    const failCount = verificationLog.filter(v => v.status === 'FAIL').length;

    console.log(`\nSUMMARY: Total Tests: ${total} | PASS: ${passCount} | PARTIAL: ${partialCount} | FAIL: ${failCount}`);
}

verifyHiringTypesSystem();
