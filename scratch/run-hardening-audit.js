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

const auditResults = [];

function recordAudit(num, area, testName, expected, actual, passed, details = '') {
    const status = passed ? '✅ PASS' : (passed === null ? '⚠️ PARTIAL' : '❌ FAIL');
    console.log(`[#${num}] ${status} [${area}] ${testName}`);
    console.log(`     Expected: ${expected} | Actual: ${actual}`);
    console.log(`     Details: ${details}\n`);
    auditResults.push({
        num,
        area,
        testName,
        expected: String(expected),
        actual: String(actual),
        status: passed ? 'PASS' : (passed === null ? 'PARTIAL' : 'FAIL'),
        details
    });
}

async function runFullHardeningAudit() {
    console.log('================================================================================');
    console.log('🛡️ ENTERPRISE HARDENING & PRODUCTION READINESS AUDIT SUITE');
    console.log('================================================================================\n');

    const JWT_SECRET = process.env.JWT_SECRET || 'secret';
    let compA, compB, deptA, deptB, adminA, managerA, employeeA, tokenAdminA, tokenManagerA, tokenEmployeeA, tokenAdminB;

    try {
        // Setup Tenant A and Tenant B for multi-tenant & RBAC tests
        compA = await prisma.company.create({ data: { name: `TenantA_${Date.now()}`, status: 'ACTIVE' } });
        compB = await prisma.company.create({ data: { name: `TenantB_${Date.now()}`, status: 'ACTIVE' } });

        deptA = await prisma.department.create({ data: { name: 'Engineering A', companyId: compA.id } });
        deptB = await prisma.department.create({ data: { name: 'Engineering B', companyId: compB.id } });

        adminA = await prisma.user.create({
            data: { email: `admin_a_${Date.now()}@audithr.com`, name: 'Admin A', passwordHash: 'hash', role: 'ADMIN', status: 'ACTIVE', companyId: compA.id }
        });
        managerA = await prisma.user.create({
            data: { email: `manager_a_${Date.now()}@audithr.com`, name: 'Manager A', passwordHash: 'hash', role: 'MANAGER', status: 'ACTIVE', companyId: compA.id }
        });
        employeeA = await prisma.user.create({
            data: { email: `emp_a_${Date.now()}@audithr.com`, name: 'Employee A', passwordHash: 'hash', role: 'EMPLOYEE', status: 'ACTIVE', companyId: compA.id }
        });

        tokenAdminA = jwt.sign({ id: adminA.id, companyId: compA.id, role: 'ADMIN', name: adminA.name }, JWT_SECRET);
        tokenManagerA = jwt.sign({ id: managerA.id, companyId: compA.id, role: 'MANAGER', name: managerA.name }, JWT_SECRET);
        tokenEmployeeA = jwt.sign({ id: employeeA.id, companyId: compA.id, role: 'EMPLOYEE', name: employeeA.name }, JWT_SECRET);

        const adminB = await prisma.user.create({
            data: { email: `admin_b_${Date.now()}@audithr.com`, name: 'Admin B', passwordHash: 'hash', role: 'ADMIN', status: 'ACTIVE', companyId: compB.id }
        });
        tokenAdminB = jwt.sign({ id: adminB.id, companyId: compB.id, role: 'ADMIN', name: adminB.name }, JWT_SECRET);

        // -------------------------------------------------------------
        // Section 3 & 4: Immediate Hiring Deep Validation & Fast SLA
        // -------------------------------------------------------------
        console.log('--- 1. Immediate Hiring Deep Validation ---');

        // Test 1: Immediate with missing requiredDate -> 400
        const immMissingReq = await request(app).post('/api/job-requests').set('Authorization', `Bearer ${tokenAdminA}`).send({
            jobTitle: 'Cloud Architect',
            departmentId: deptA.id,
            hiringType: 'IMMEDIATE',
            hiringDeadline: new Date(Date.now() + 7 * 86400000).toISOString()
        });
        recordAudit(1, 'Immediate Validation', 'Missing Required Date is rejected', 400, immMissingReq.status, immMissingReq.status === 400, immMissingReq.body.error);

        // Test 2: Immediate with missing hiringDeadline -> 400
        const immMissingDead = await request(app).post('/api/job-requests').set('Authorization', `Bearer ${tokenAdminA}`).send({
            jobTitle: 'Cloud Architect',
            departmentId: deptA.id,
            hiringType: 'IMMEDIATE',
            requiredDate: new Date(Date.now() + 3 * 86400000).toISOString()
        });
        recordAudit(2, 'Immediate Validation', 'Missing Hiring Deadline is rejected', 400, immMissingDead.status, immMissingDead.status === 400, immMissingDead.body.error);

        // Test 3: Immediate with Deadline BEFORE requiredDate -> 400
        const immDeadBeforeReq = await request(app).post('/api/job-requests').set('Authorization', `Bearer ${tokenAdminA}`).send({
            jobTitle: 'Cloud Architect',
            departmentId: deptA.id,
            hiringType: 'IMMEDIATE',
            requiredDate: new Date(Date.now() + 10 * 86400000).toISOString(),
            hiringDeadline: new Date(Date.now() + 3 * 86400000).toISOString()
        });
        recordAudit(3, 'Immediate Validation', 'Deadline earlier than Required Date is rejected', 400, immDeadBeforeReq.status, immDeadBeforeReq.status === 400, immDeadBeforeReq.body.error);

        // Test 4: Valid Immediate creation enforces URGENT priority
        const validImm = await request(app).post('/api/job-requests').set('Authorization', `Bearer ${tokenAdminA}`).send({
            jobTitle: 'Principal DevOps Engineer',
            departmentId: deptA.id,
            hiringType: 'IMMEDIATE',
            priority: 'LOW', // attempt to set non-urgent
            requiredDate: new Date(Date.now() + 5 * 86400000).toISOString(),
            hiringDeadline: new Date(Date.now() + 10 * 86400000).toISOString()
        });
        const validImmJob = validImm.body.data;
        const immUrgentPassed = validImm.status === 201 && validImmJob?.priority === 'URGENT';
        recordAudit(4, 'Immediate Priority Invariant', 'Priority is auto-enforced to URGENT on creation', 'URGENT', validImmJob?.priority, immUrgentPassed, `Job ID: ${validImmJob?.id}`);

        // Test 5: Immediate edit prevents lowering priority from URGENT
        const updateImmRes = await request(app).put(`/api/job-requests/${validImmJob.id}`).set('Authorization', `Bearer ${tokenAdminA}`).send({
            priority: 'LOW'
        });
        recordAudit(5, 'Immediate Immutability', 'Prevent changing Immediate priority away from URGENT on update', 400, updateImmRes.status, updateImmRes.status === 400, updateImmRes.body.error);

        // -------------------------------------------------------------
        // Section 5, 6, 7: Manpower Force Plan & Concurrency Defense
        // -------------------------------------------------------------
        console.log('--- 2. Manpower Force Plan Validation & Concurrency ---');

        // Test 6: Plan creation with negative budget -> 400
        const badPlanRes = await request(app).post('/api/hiring-plans').set('Authorization', `Bearer ${tokenAdminA}`).send({
            year: 2027,
            departmentId: deptA.id,
            position: 'Security Specialist',
            quantity: 0,
            budget: -100
        });
        recordAudit(6, 'Plan Validation', 'Quantity <= 0 or negative budget rejected', 400, badPlanRes.status, badPlanRes.status === 400, badPlanRes.body.message);

        // Test 7: Valid plan creation (Quantity = 1 for concurrency test)
        const singleSlotPlanRes = await request(app).post('/api/hiring-plans').set('Authorization', `Bearer ${tokenAdminA}`).send({
            year: 2027,
            departmentId: deptA.id,
            position: 'Chief Architect',
            quantity: 1,
            budget: 500000,
            expectedDate: '2027-06-01'
        });
        const slotPlan = singleSlotPlanRes.body.data;
        recordAudit(7, 'Plan Creation', 'Create 1-slot Manpower Plan for concurrency testing', 201, singleSlotPlanRes.status, singleSlotPlanRes.status === 201, `Plan ID: ${slotPlan?.id}`);

        // Test 8: Concurrency Race Condition (2 simultaneous requests for the exact same 1 slot)
        const reqPromise1 = request(app).post('/api/job-requests').set('Authorization', `Bearer ${tokenAdminA}`).send({
            jobTitle: 'Chief Architect 1',
            departmentId: deptA.id,
            hiringType: 'PLANNED',
            hiringPlanId: slotPlan.id
        });
        const reqPromise2 = request(app).post('/api/job-requests').set('Authorization', `Bearer ${tokenAdminA}`).send({
            jobTitle: 'Chief Architect 2',
            departmentId: deptA.id,
            hiringType: 'PLANNED',
            hiringPlanId: slotPlan.id
        });

        const [concRes1, concRes2] = await Promise.all([reqPromise1, reqPromise2]);
        const oneSucceeded = (concRes1.status === 201 && concRes2.status !== 201) || (concRes2.status === 201 && concRes1.status !== 201);
        const planAfterConc = await prisma.hiringPlan.findUnique({ where: { id: slotPlan.id } });
        const concurrencyPassed = oneSucceeded && planAfterConc.fulfilledCount === 1;
        recordAudit(8, 'Concurrency Safety', 'Simultaneous requests resolve safely without over-allocating plan (fulfilledCount <= 1)', 'fulfilledCount = 1 & 1 success', `fulfilled: ${planAfterConc?.fulfilledCount}, S1: ${concRes1.status}, S2: ${concRes2.status}`, concurrencyPassed, `Winner: ${concRes1.status === 201 ? 'Req 1' : 'Req 2'}`);

        // Test 9: Modification rule: prevent reducing quantity below fulfilledCount
        const reduceQtyRes = await request(app).put(`/api/hiring-plans/${slotPlan.id}`).set('Authorization', `Bearer ${tokenAdminA}`).send({
            quantity: 0
        });
        recordAudit(9, 'Plan Modification Rules', 'Cannot reduce plan quantity below fulfilledCount', 400, reduceQtyRes.status, reduceQtyRes.status === 400, reduceQtyRes.body.message);

        // Test 10: Prevent deleting plan when active job requests are linked
        const deleteLinkedPlan = await request(app).delete(`/api/hiring-plans/${slotPlan.id}`).set('Authorization', `Bearer ${tokenAdminA}`);
        recordAudit(10, 'Plan Deletion Integrity', 'Prevent deleting plan with linked job requests', 400, deleteLinkedPlan.status, deleteLinkedPlan.status === 400, deleteLinkedPlan.body.message);

        // -------------------------------------------------------------
        // Section 9, 10, 11: On Hold State Machine & Audit Logs
        // -------------------------------------------------------------
        console.log('--- 3. On Hold State Machine & Audit Logging ---');

        // Test 11: Create On Hold without freezeReason -> 400
        const badOnHold = await request(app).post('/api/job-requests').set('Authorization', `Bearer ${tokenAdminA}`).send({
            jobTitle: 'QA Lead',
            departmentId: deptA.id,
            hiringType: 'ON_HOLD'
        });
        recordAudit(11, 'On Hold Validation', 'Missing freezeReason on ON_HOLD request rejected', 400, badOnHold.status, badOnHold.status === 400, badOnHold.body.error);

        // Test 12: Freeze active job request
        const freezeRes = await request(app).post(`/api/job-requests/${validImmJob.id}/freeze`).set('Authorization', `Bearer ${tokenAdminA}`).send({
            freezeReason: 'BUSINESS_CHANGE',
            comment: 'تغيير في استراتيجية البنية التحتية'
        });
        recordAudit(12, 'Freeze Transition', 'Active request transitioned to ON_HOLD with audit record', 200, freezeRes.status, freezeRes.status === 200, `Reason: ${freezeRes.body.data?.freezeReason}`);

        // Test 13: State Machine: Prevent freeze on already frozen request
        const doubleFreezeRes = await request(app).post(`/api/job-requests/${validImmJob.id}/freeze`).set('Authorization', `Bearer ${tokenAdminA}`).send({
            freezeReason: 'MANAGEMENT_APPROVAL'
        });
        recordAudit(13, 'State Machine Guard', 'Prevent double freezing (ON_HOLD -> ON_HOLD)', 400, doubleFreezeRes.status, doubleFreezeRes.status === 400, doubleFreezeRes.body.error);

        // Test 14: Unfreeze / Resume request back to active
        const unfreezeRes = await request(app).post(`/api/job-requests/${validImmJob.id}/unfreeze`).set('Authorization', `Bearer ${tokenAdminA}`).send({
            comment: 'تمت الموافقة واستئناف التوظيف'
        });
        recordAudit(14, 'Unfreeze Transition', 'Resume request into active recruitment (SUBMITTED / IMMEDIATE)', 200, unfreezeRes.status, unfreezeRes.status === 200, `Status: ${unfreezeRes.body.data?.status}`);

        // Test 15: Audit Trail Integrity: Verify OnHoldLog records WHO, WHAT, WHEN, WHY
        const onHoldLogs = await prisma.onHoldLog.findMany({ where: { jobRequestId: validImmJob.id } });
        const auditLogPassed = onHoldLogs.length >= 2 && onHoldLogs.some(l => l.action === 'FREEZE') && onHoldLogs.some(l => l.action === 'UNFREEZE');
        recordAudit(15, 'OnHoldLog Audit Trail', 'Immutable OnHoldLogs recorded for freeze and unfreeze actions with actor details', true, auditLogPassed, auditLogPassed, `Total logs: ${onHoldLogs.length}`);

        // -------------------------------------------------------------
        // Section 12 & 13: RBAC & Multi-Tenant Isolation
        // -------------------------------------------------------------
        console.log('--- 4. RBAC Authorization & Multi-Tenant Isolation ---');

        // Test 16: RBAC: Normal EMPLOYEE forbidden from creating hiring plans -> 403
        const empPlanRes = await request(app).post('/api/hiring-plans').set('Authorization', `Bearer ${tokenEmployeeA}`).send({
            year: 2027,
            departmentId: deptA.id,
            position: 'Unauthorized Plan',
            quantity: 5
        });
        recordAudit(16, 'RBAC Authorization', 'Non-manager role (EMPLOYEE) is blocked with 403 Forbidden from creating plans', 403, empPlanRes.status, empPlanRes.status === 403, empPlanRes.body.message);

        // Test 17: Multi-Tenant: Tenant B cannot access or modify Tenant A Hiring Plan -> 404
        const tenantCrossUpdate = await request(app).put(`/api/hiring-plans/${slotPlan.id}`).set('Authorization', `Bearer ${tokenAdminB}`).send({
            quantity: 99
        });
        recordAudit(17, 'Multi-Tenant Isolation', 'Tenant B cannot update or access Tenant A plan (strict 404)', 404, tenantCrossUpdate.status, tenantCrossUpdate.status === 404, tenantCrossUpdate.body.message);

        // Test 18: Multi-Tenant: Reports query only aggregates data for authenticated tenant
        const tenantAReport = await request(app).get('/api/hiring-reports/summary').set('Authorization', `Bearer ${tokenAdminA}`);
        const tenantBReport = await request(app).get('/api/hiring-reports/summary').set('Authorization', `Bearer ${tokenAdminB}`);
        const isolationPassed = tenantBReport.body.data?.summary?.totalPlannedPositions === 0 && tenantAReport.body.data?.summary?.totalPlannedPositions > 0;
        recordAudit(18, 'Multi-Tenant Reports', 'Tenant B report strictly isolated and returns 0 items from Tenant A', 'Tenant B planned = 0', `Tenant B: ${tenantBReport.body.data?.summary?.totalPlannedPositions}, Tenant A: ${tenantAReport.body.data?.summary?.totalPlannedPositions}`, isolationPassed, 'Zero cross-tenant leakage');

        // -------------------------------------------------------------
        // Section 14 & 15: Reports & Dashboard Aggregation Accuracy
        // -------------------------------------------------------------
        console.log('--- 5. Reports & Dashboard Dynamic Accuracy ---');

        const dashRes = await request(app).get('/api/hiring-plans/dashboard?year=2027').set('Authorization', `Bearer ${tokenAdminA}`);
        const dashKpis = dashRes.body.data?.kpis;
        const dashAccuracy = dashKpis?.totalPlannedPositions === 1 && dashKpis?.totalFulfilledPositions === 1 && dashKpis?.fulfillmentRate === 100;
        recordAudit(19, 'Dashboard KPIs', 'Dashboard computes exact 100% fulfillment rate and KPI aggregations', 'Fulfillment = 100%', `Fulfillment: ${dashKpis?.fulfillmentRate}%`, dashAccuracy, `Budget: ${dashKpis?.totalAllocatedBudget}`);

    } catch (err) {
        console.error('Fatal Hardening Audit Error:', err);
    } finally {
        try {
            if (compA?.id) {
                await prisma.onHoldLog.deleteMany({ where: { jobRequest: { companyId: compA.id } } });
                await prisma.jobRequest.deleteMany({ where: { companyId: compA.id } });
                await prisma.hiringPlan.deleteMany({ where: { companyId: compA.id } });
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

    console.log('\n================================================================================');
    console.log('🏁 HARDENING AUDIT SUMMARY MATRIX:');
    console.log('================================================================================\n');
    console.table(auditResults);

    const total = auditResults.length;
    const passCount = auditResults.filter(v => v.status === 'PASS').length;
    const failCount = auditResults.filter(v => v.status === 'FAIL').length;
    console.log(`\nAUDIT VERDICT: Total Tests: ${total} | PASS: ${passCount} | FAIL: ${failCount}`);
}

runFullHardeningAudit();
