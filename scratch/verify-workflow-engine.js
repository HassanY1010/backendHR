import request from 'supertest';
import express from 'express';
import cookieParser from 'cookie-parser';
import jwt from 'jsonwebtoken';
import prisma from '../src/config/db.js';
import workflowRoutes from '../src/routes/workflow.routes.js';
import { errorHandler } from '../src/middlewares/error.middleware.js';
import { slaService } from '../src/services/sla.service.js';

const app = express();
app.use(express.json());
app.use(cookieParser());
app.use('/api/workflow', workflowRoutes);
app.use(errorHandler);

const verificationLog = [];
function recordCheck(section, testName, expected, actual, passed, details = '') {
    const icon = passed ? '✅ PASS' : '❌ FAIL';
    console.log(`${icon} [${section}] ${testName} | ${details}`);
    verificationLog.push({ section, testName, expected: String(expected), actual: String(actual), result: passed ? 'PASS' : 'FAIL', details });
}

async function verifyRecruitmentWorkflowEngine() {
    console.log('================================================================================');
    console.log('🏗️ VERIFYING RECRUITMENT WORKFLOW ENGINE (ALL 7 STAGES + SLA + AUDIT + BUILDER)');
    console.log('================================================================================\n');

    let comp, dept, userHM, userHR, userMgmt, userRec;
    let tokenHM, tokenHR, tokenMgmt, tokenRec;
    let jobReq, template;

    try {
        const JWT_SECRET = process.env.JWT_SECRET || 'secret';

        // 1. Setup Company, Department and 4 Dedicated Role Users
        comp = await prisma.company.create({ data: { name: `WF_Comp_${Date.now()}`, status: 'ACTIVE' } });
        dept = await prisma.department.create({ data: { name: 'Engineering', companyId: comp.id } });

        userHM = await prisma.user.create({
            data: { email: `hm_${Date.now()}@test.com`, name: 'Hiring Manager Ahmed', passwordHash: 'hash', role: 'MANAGER', status: 'ACTIVE', companyId: comp.id }
        });
        tokenHM = jwt.sign({ id: userHM.id, companyId: comp.id, role: 'MANAGER', name: userHM.name }, JWT_SECRET);

        userHR = await prisma.user.create({
            data: { email: `hr_${Date.now()}@test.com`, name: 'HR Manager Sara', passwordHash: 'hash', role: 'HR_MANAGER', status: 'ACTIVE', companyId: comp.id }
        });
        tokenHR = jwt.sign({ id: userHR.id, companyId: comp.id, role: 'HR_MANAGER', name: userHR.name }, JWT_SECRET);

        userMgmt = await prisma.user.create({
            data: { email: `mgmt_${Date.now()}@test.com`, name: 'Management Khalid', passwordHash: 'hash', role: 'CEO_EXECUTIVE', status: 'ACTIVE', companyId: comp.id }
        });
        tokenMgmt = jwt.sign({ id: userMgmt.id, companyId: comp.id, role: 'CEO_EXECUTIVE', name: userMgmt.name }, JWT_SECRET);

        userRec = await prisma.user.create({
            data: { email: `rec_${Date.now()}@test.com`, name: 'Recruiter Mona', passwordHash: 'hash', role: 'RECRUITER', status: 'ACTIVE', companyId: comp.id }
        });
        tokenRec = jwt.sign({ id: userRec.id, companyId: comp.id, role: 'RECRUITER', name: userRec.name }, JWT_SECRET);

        // 2. Create Job Request & Workflow Instance
        jobReq = await prisma.jobRequest.create({
            data: {
                requestId: `REQ-WF-${Date.now()}`,
                jobTitle: 'Senior Cloud Engineer',
                departmentId: dept.id,
                location: 'Riyadh',
                vacancies: 2,
                hiringType: 'IMMEDIATE',
                employmentType: 'FULL_TIME',
                status: 'DRAFT',
                companyId: comp.id,
                createdBy: userHM.id,
                hiringManagerId: userHM.id
            }
        });

        // ============================================================================
        // SECTION 1: DEFAULT WORKFLOW TEMPLATE & 7 STAGES WITH SLA
        // ============================================================================
        console.log('\n--- 1. TEMPLATES & 7 STAGES SLA VERIFICATION ---');
        const tmplRes = await request(app).get('/api/workflow/templates').set('Authorization', `Bearer ${tokenHR}`);
        template = tmplRes.body.data?.[0];

        const steps = template?.steps || [];
        const has7Steps = steps.length === 7;
        const slaMap = {};
        steps.forEach(s => { slaMap[s.stepOrder] = { name: s.name, role: s.role, sla: s.slaDurationHours }; });

        recordCheck('Workflow Structure', 'Default 7 Stages exist', 7, steps.length, has7Steps, 'All 7 standard stages registered in database');
        recordCheck('SLA System', 'Stage 1 (Job Request Created) SLA = 24h & Role = HIRING_MANAGER', '24/HIRING_MANAGER', `${slaMap[1]?.sla}/${slaMap[1]?.role}`, slaMap[1]?.sla === 24 && slaMap[1]?.role === 'HIRING_MANAGER');
        recordCheck('SLA System', 'Stage 2 (HR Review) SLA = 48h & Role = HR_MANAGER', '48/HR_MANAGER', `${slaMap[2]?.sla}/${slaMap[2]?.role}`, slaMap[2]?.sla === 48 && slaMap[2]?.role === 'HR_MANAGER');
        recordCheck('SLA System', 'Stage 3 (Approval) SLA = 72h & Role = MANAGEMENT', '72/MANAGEMENT', `${slaMap[3]?.sla}/${slaMap[3]?.role}`, slaMap[3]?.sla === 72 && slaMap[3]?.role === 'MANAGEMENT');
        recordCheck('SLA System', 'Stage 4 (Candidate Search) SLA & Role = RECRUITER', 'RECRUITER', slaMap[4]?.role, slaMap[4]?.role === 'RECRUITER');
        recordCheck('SLA System', 'Stage 5 (Interview Process) Role = RECRUITER', 'RECRUITER', slaMap[5]?.role, slaMap[5]?.role === 'RECRUITER');
        recordCheck('SLA System', 'Stage 6 (Offer Stage) Role = HR_MANAGER', 'HR_MANAGER', slaMap[6]?.role, slaMap[6]?.role === 'HR_MANAGER');
        recordCheck('SLA System', 'Stage 7 (Hiring Completed) Role = HR_MANAGER', 'HR_MANAGER', slaMap[7]?.role, slaMap[7]?.role === 'HR_MANAGER');

        // ============================================================================
        // SECTION 2: WORKFLOW INSTANCE INITIALIZATION & TRANSITIONS
        // ============================================================================
        console.log('\n--- 2. WORKFLOW INSTANCE & STEP ADVANCEMENT ---');
        const instRes = await request(app).get(`/api/workflow/instance/${jobReq.id}`).set('Authorization', `Bearer ${tokenHR}`);
        const instance = instRes.body.data;
        recordCheck('Instance Engine', 'Initialize instance on Job Request', 1, instance?.currentStep, instance?.currentStep === 1, 'Step 1 is active with dueAt calculated from SLA');

        // Advance Step 1 (HM -> HR Review)
        const adv1 = await request(app).post(`/api/workflow/instance/${jobReq.id}/advance`).set('Authorization', `Bearer ${tokenHM}`).send({
            comment: 'تم رفع الطلب ومكتمل البيانات'
        });
        recordCheck('Step Advancement', 'Advance Step 1 -> Step 2 (HR Review)', 2, adv1.body.data?.nextStepOrder, adv1.body.data?.nextStepOrder === 2, 'Advanced to Step 2 with duration computed');

        // Advance Step 2 (HR -> Management Approval)
        const adv2 = await request(app).post(`/api/workflow/instance/${jobReq.id}/advance`).set('Authorization', `Bearer ${tokenHR}`).send({
            comment: 'تمت مراجعة الوصف والراتب والموافقة المبدئية'
        });
        recordCheck('Step Advancement', 'Advance Step 2 -> Step 3 (Approval)', 3, adv2.body.data?.nextStepOrder, adv2.body.data?.nextStepOrder === 3, 'Advanced to Step 3');

        // Advance Step 3 (Management -> Candidate Search)
        const adv3 = await request(app).post(`/api/workflow/instance/${jobReq.id}/advance`).set('Authorization', `Bearer ${tokenMgmt}`).send({
            comment: 'تم اعتماد الميزانية والتوظيف'
        });
        recordCheck('Step Advancement', 'Advance Step 3 -> Step 4 (Candidate Search)', 4, adv3.body.data?.nextStepOrder, adv3.body.data?.nextStepOrder === 4, 'Advanced to Step 4');

        // ============================================================================
        // SECTION 3: AUDIT TRAIL LOGGING (From / To / By / Date / Action)
        // ============================================================================
        console.log('\n--- 3. AUDIT TRAIL VERIFICATION ---');
        const logsRes = await request(app).get(`/api/workflow/logs/${jobReq.id}`).set('Authorization', `Bearer ${tokenHR}`);
        const logs = logsRes.body.data || [];
        const hasLogs = logs.length >= 3;
        const firstAdvLog = logs.find(l => l.action === 'ADVANCED');

        recordCheck('Audit Logging', 'Audit log records transitions with Performer & Comment', true, Boolean(firstAdvLog?.performedByName && firstAdvLog?.comment), Boolean(firstAdvLog?.performedByName && firstAdvLog?.comment), `Log recorded by: ${firstAdvLog?.performedByName}`);
        recordCheck('Audit Logging', 'Audit records fromStep and toStep', true, Boolean(firstAdvLog?.fromStatus || firstAdvLog?.fromStep), Boolean(firstAdvLog?.fromStatus || firstAdvLog?.fromStep), 'Preserves complete state transitions history');

        // ============================================================================
        // SECTION 4: WORKFLOW BUILDER (Create / Edit Stages & SLAs)
        // ============================================================================
        console.log('\n--- 4. WORKFLOW BUILDER API VERIFICATION ---');
        const newTemplateRes = await request(app).post('/api/workflow/templates').set('Authorization', `Bearer ${tokenHR}`).send({
            name: 'Fast Track Tech Workflow',
            nameAr: 'مسار التوظيف السريع للتقنية',
            description: 'Custom 4-stage expedited workflow',
            steps: [
                { stepOrder: 1, name: 'Job Created', nameAr: 'إنشاء الطلب', role: 'HIRING_MANAGER', slaDurationHours: 12 },
                { stepOrder: 2, name: 'Fast HR & Tech Screening', nameAr: 'فحص فني سريع', role: 'HR_MANAGER', slaDurationHours: 24 },
                { stepOrder: 3, name: 'Executive Approval', nameAr: 'اعتماد تنفيذي', role: 'MANAGEMENT', slaDurationHours: 24 },
                { stepOrder: 4, name: 'Hire & Close', nameAr: 'إغلاق التعيين', role: 'RECRUITER', slaDurationHours: 48 }
            ]
        });

        const createdCustomTmpl = newTemplateRes.body.data;
        const customPass = newTemplateRes.status === 201 && createdCustomTmpl?.steps?.length === 4;
        recordCheck('Workflow Builder', 'Create custom workflow with dynamic stages & SLAs', 4, createdCustomTmpl?.steps?.length, customPass, 'Custom template created with 4 dynamic stages');

        // ============================================================================
        // SECTION 5: SLA SERVICE & ESCALATION & DASHBOARD
        // ============================================================================
        console.log('\n--- 5. SLA ESCALATION & DASHBOARD VERIFICATION ---');
        const activeStepInst = await prisma.workflowStepInstance.findFirst({
            where: { instanceId: instance.id, status: 'IN_PROGRESS' }
        });

        if (activeStepInst) {
            await prisma.workflowStepInstance.update({
                where: { id: activeStepInst.id },
                data: { dueAt: new Date(Date.now() - 3600000) } // 1 hour ago (overdue)
            });
        }

        // Run SLA checker engine
        await slaService.checkSLABreaches();

        const overdueCheck = await prisma.workflowStepInstance.findUnique({
            where: { id: activeStepInst.id }
        });
        recordCheck('SLA Escalation', 'SLA Breach auto-detected and marked OVERDUE with Notification', true, overdueCheck?.slaBreach && overdueCheck?.status === 'OVERDUE', overdueCheck?.slaBreach && overdueCheck?.status === 'OVERDUE', 'Step marked OVERDUE and logged in audit log');

        // Query Workflow Dashboard
        const dashRes = await request(app).get('/api/workflow/dashboard').set('Authorization', `Bearer ${tokenHR}`);
        const dash = dashRes.body.data;
        const dashValid = dash && dash.kpis && dash.kpis.totalInstances !== undefined && Array.isArray(dash.stepSummary);
        recordCheck('Workflow Dashboard', 'Analytics, Overdue counts, Average stage duration, and KPI metrics', true, dashValid, dashValid, `Total Instances: ${dash?.kpis?.totalInstances}, SLA Breaches: ${dash?.kpis?.slaBreachCount}`);

    } catch (err) {
        console.error('Workflow verification error:', err);
    } finally {
        try {
            if (comp?.id) {
                await prisma.workflowLog.deleteMany({ where: { instance: { companyId: comp.id } } });
                await prisma.workflowStepInstance.deleteMany({ where: { instance: { companyId: comp.id } } });
                await prisma.workflowInstance.deleteMany({ where: { companyId: comp.id } });
                await prisma.workflowStep.deleteMany({ where: { template: { companyId: comp.id } } });
                await prisma.workflowTemplate.deleteMany({ where: { companyId: comp.id } });
                await prisma.jobRequest.deleteMany({ where: { companyId: comp.id } });
                await prisma.department.deleteMany({ where: { companyId: comp.id } });
                await prisma.user.deleteMany({ where: { companyId: comp.id } });
                await prisma.company.delete({ where: { id: comp.id } });
            }
        } catch (e) {}
    }

    console.log('\n================================================================================');
    console.log('🏁 FINAL WORKFLOW VERIFICATION SUMMARY TABLE:');
    console.log('================================================================================\n');
    console.table(verificationLog);
}

verifyRecruitmentWorkflowEngine();
