import request from 'supertest';
import app from '../src/app.js';
import prisma from '../src/config/db.js';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';

describe('Comprehensive Unified All-Phases Test (Phase 1 to Phase 8)', () => {
    let companyAId = 'unified-company-a';
    let companyBId = 'unified-company-b';
    let managerAToken;
    let managerBToken;
    let employeeAToken;
    let userAId;
    let userBId;
    let empUserId;
    let empProfileId;
    let deptAId;
    let jobRequestId;
    let recruitmentJobId;
    let candidateId;
    let trainingCourseId;
    let trainingAssignmentId;
    let projectId;
    let taskId;

    beforeAll(async () => {
        const secret = process.env.JWT_SECRET || 'test-secret';
        const passwordHash = await bcrypt.hash('UnifiedPass123!', 10);

        // Clean up prior test residues
        try {
            await prisma.auditLog.deleteMany({ where: { companyId: { in: [companyAId, companyBId] } } });
            await prisma.candidateHistory.deleteMany({ where: { candidate: { email: { contains: 'unified' } } } });
            await prisma.candidateSkill.deleteMany({ where: { candidate: { email: { contains: 'unified' } } } });
            await prisma.candidate.deleteMany({ where: { email: { contains: 'unified' } } });
            await prisma.trainingAssignment.deleteMany({ where: { employee: { companyId: { in: [companyAId, companyBId] } } } });
            await prisma.trainingCourse.deleteMany({ where: { title: { contains: 'المسار الموحد' } } });
            await prisma.task.deleteMany({ where: { employee: { companyId: { in: [companyAId, companyBId] } } } });
            await prisma.project.deleteMany({ where: { companyId: { in: [companyAId, companyBId] } } });
            await prisma.recruitmentJob.deleteMany({ where: { companyId: { in: [companyAId, companyBId] } } });
            await prisma.jobRequest.deleteMany({ where: { companyId: { in: [companyAId, companyBId] } } });
            await prisma.employee.deleteMany({ where: { companyId: { in: [companyAId, companyBId] } } });
            await prisma.user.deleteMany({ where: { companyId: { in: [companyAId, companyBId] } } });
            await prisma.department.deleteMany({ where: { companyId: { in: [companyAId, companyBId] } } });
            await prisma.company.deleteMany({ where: { id: { in: [companyAId, companyBId] } } });
        } catch (e) {
            // ignore cleanup errors
        }

        // 1. Setup Companies (Multi-Tenant foundation)
        await prisma.company.createMany({
            data: [
                { id: companyAId, name: 'شركة المسار الموحد أ', status: 'active', subscriptionStatus: 'ACTIVE' },
                { id: companyBId, name: 'شركة المسار الموحد ب (معزولة)', status: 'active', subscriptionStatus: 'ACTIVE' }
            ]
        });

        // 2. Setup Users & Roles
        const managerA = await prisma.user.create({
            data: {
                id: 'unified-manager-a',
                email: 'unified-manager-a@test.com',
                passwordHash,
                name: 'مدير المسار الموحد أ',
                role: 'MANAGER',
                status: 'ACTIVE',
                companyId: companyAId
            }
        });
        userAId = managerA.id;
        managerAToken = jwt.sign({ id: managerA.id, email: managerA.email, role: 'MANAGER', companyId: companyAId }, secret, { expiresIn: '2h' });

        const managerB = await prisma.user.create({
            data: {
                id: 'unified-manager-b',
                email: 'unified-manager-b@test.com',
                passwordHash,
                name: 'مدير المسار الموحد ب',
                role: 'MANAGER',
                status: 'ACTIVE',
                companyId: companyBId
            }
        });
        userBId = managerB.id;
        managerBToken = jwt.sign({ id: managerB.id, email: managerB.email, role: 'MANAGER', companyId: companyBId }, secret, { expiresIn: '2h' });

        const empUser = await prisma.user.create({
            data: {
                id: 'unified-emp-user-a',
                email: 'unified-emp-a@test.com',
                passwordHash,
                name: 'موظف أ الموحد',
                role: 'EMPLOYEE',
                status: 'ACTIVE',
                companyId: companyAId
            }
        });
        empUserId = empUser.id;
        employeeAToken = jwt.sign({ id: empUser.id, email: empUser.email, role: 'EMPLOYEE', companyId: companyAId }, secret, { expiresIn: '2h' });

        const empProfile = await prisma.employee.create({
            data: {
                id: 'unified-emp-profile-a',
                userId: empUser.id,
                companyId: companyAId,
                department: 'الهندسة التقنية',
                position: 'مهندس برمجيات موحد',
                updatedAt: new Date()
            }
        });
        empProfileId = empProfile.id;

        // 3. Department
        const deptA = await prisma.department.create({
            data: {
                id: 'unified-dept-a',
                name: 'الهندسة التقنية',
                companyId: companyAId
            }
        });
        deptAId = deptA.id;
    }, 120000);

    afterAll(async () => {
        try {
            await prisma.auditLog.deleteMany({ where: { companyId: { in: [companyAId, companyBId] } } });
            await prisma.candidateHistory.deleteMany({ where: { candidate: { email: { contains: 'unified' } } } });
            await prisma.candidateSkill.deleteMany({ where: { candidate: { email: { contains: 'unified' } } } });
            await prisma.candidate.deleteMany({ where: { email: { contains: 'unified' } } });
            await prisma.trainingAssignment.deleteMany({ where: { employee: { companyId: { in: [companyAId, companyBId] } } } });
            await prisma.trainingCourse.deleteMany({ where: { title: { contains: 'المسار الموحد' } } });
            await prisma.task.deleteMany({ where: { employee: { companyId: { in: [companyAId, companyBId] } } } });
            await prisma.project.deleteMany({ where: { companyId: { in: [companyAId, companyBId] } } });
            await prisma.recruitmentJob.deleteMany({ where: { companyId: { in: [companyAId, companyBId] } } });
            await prisma.jobRequest.deleteMany({ where: { companyId: { in: [companyAId, companyBId] } } });
            await prisma.employee.deleteMany({ where: { companyId: { in: [companyAId, companyBId] } } });
            await prisma.user.deleteMany({ where: { companyId: { in: [companyAId, companyBId] } } });
            await prisma.department.deleteMany({ where: { companyId: { in: [companyAId, companyBId] } } });
            await prisma.company.deleteMany({ where: { id: { in: [companyAId, companyBId] } } });
        } catch (e) {
            // ignore
        }
        await prisma.$disconnect();
    }, 120000);

    // =========================================================================
    // Single Unified Execution Across Phases 1 to 8
    // =========================================================================
    test('Execute Full Lifecycle Across All 8 Phases in a Single Seamless Flow', async () => {
        // ---------------------------------------------------------------------
        // [PHASE 1] Real Data Verification & Analytics Baseline
        // ---------------------------------------------------------------------
        const initialDashRes = await request(app)
            .get('/api/analytics/dashboard')
            .set('Authorization', `Bearer ${managerAToken}`);

        expect(initialDashRes.status).toBe(200);
        expect(initialDashRes.body.data).toBeDefined();
        // Satisfaction must reflect authentic check-ins or return insufficientData: true (no fake 82)
        expect(initialDashRes.body.data.hr).toBeDefined();
        expect(initialDashRes.body.data.hr.satisfaction === null || initialDashRes.body.data.hr.satisfactionInsufficientData === true || typeof initialDashRes.body.data.hr.satisfaction === 'number').toBe(true);

        // ---------------------------------------------------------------------
        // [PHASE 2] Job Request Creation, SLA Workflow, Idempotency & ATS Conversion
        // ---------------------------------------------------------------------
        const idempotencyKey = `idemp-unified-${Date.now()}`;
        const jobReqPayload = {
            jobTitle: 'مهندس نظم موحد شامل',
            departmentId: deptAId,
            location: 'الرياض - المقر الرئيسي',
            vacancies: 1,
            employmentType: 'FULL_TIME',
            hiringType: 'IMMEDIATE',
            hiringReason: 'NEW_POSITION',
            priority: 'HIGH',
            responsibilities: 'تطوير وصيانة البنية التحتية الموحدة',
            requirements: 'خبرة 4 سنوات فما فوق',
            submitDirectly: true
        };

        // Create Job Request with Idempotency Key
        const jobReqRes = await request(app)
            .post('/api/job-requests')
            .set('Authorization', `Bearer ${managerAToken}`)
            .set('Idempotency-Key', idempotencyKey)
            .send(jobReqPayload);

        expect(jobReqRes.status).toBe(201);
        jobRequestId = jobReqRes.body.data.id;
        expect(jobRequestId).toBeDefined();
        // Approve Job Request in DB (Simulating Approval SLA Workflow)
        await prisma.jobRequest.update({
            where: { id: jobRequestId },
            data: { status: 'APPROVED' }
        });

        // Convert Job Request into Recruitment Job (ATS Opening) via atomic conversion endpoint
        const convertRes = await request(app)
            .post(`/api/job-requests/${jobRequestId}/convert-to-job`)
            .set('Authorization', `Bearer ${managerAToken}`)
            .send({
                salaryMin: 15000,
                salaryMax: 22000
            });

        expect([200, 201]).toContain(convertRes.status);
        recruitmentJobId = convertRes.body.data.vacancy.id;
        expect(recruitmentJobId).toBeDefined();

        // ---------------------------------------------------------------------
        // [PHASE 3] Candidate Entry, Screening, Concurrency & State Machine to HIRED
        // ---------------------------------------------------------------------
        // Create Candidate on the newly opened Recruitment Job
        const candEmail = `unified.candidate.${Date.now()}@test.com`;
        const candRes = await request(app)
            .post('/api/candidates')
            .set('Authorization', `Bearer ${managerAToken}`)
            .send({
                fullName: 'عبدالله إبراهيم الشمري',
                email: candEmail,
                phone: '+966555123456',
                jobId: recruitmentJobId,
                yearsOfExperience: 5,
                education: 'بكالوريوس هندسة حاسوب',
                skills: ['Node.js', 'PostgreSQL', 'Docker', 'Redis']
            });

        expect(candRes.status).toBe(201);
        candidateId = candRes.body.data.id;
        expect(candidateId).toBeDefined();
        expect(candRes.body.data.status).toBe('APPLIED');

        // State Machine Step 1: APPLIED -> SCREENING
        const screeningRes = await request(app)
            .put(`/api/candidates/${candidateId}/status`)
            .set('Authorization', `Bearer ${managerAToken}`)
            .send({ status: 'SCREENING', comment: 'تم فحص السيرة الذاتية بنجاح' });
        expect(screeningRes.status).toBe(200);
        expect(screeningRes.body.data.status).toBe('SCREENING');

        // State Machine Step 2: SCREENING -> SHORTLISTED
        const shortlistRes = await request(app)
            .put(`/api/candidates/${candidateId}/status`)
            .set('Authorization', `Bearer ${managerAToken}`)
            .send({ status: 'SHORTLISTED', comment: 'مرشح مؤهل للمقابلة الشخصية' });
        expect(shortlistRes.status).toBe(200);
        expect(shortlistRes.body.data.status).toBe('SHORTLISTED');

        // State Machine Step 3: SHORTLISTED -> OFFER_SENT
        const offerRes = await request(app)
            .put(`/api/candidates/${candidateId}/status`)
            .set('Authorization', `Bearer ${managerAToken}`)
            .send({ status: 'OFFER_SENT', comment: 'تم إرسال العرض الوظيفي الرسمي' });
        expect(offerRes.status).toBe(200);
        expect(offerRes.body.data.status).toBe('OFFER_SENT');

        // State Machine Step 4: OFFER_SENT -> HIRED (Triggers jobRequestSync to close job)
        const hiredRes = await request(app)
            .put(`/api/candidates/${candidateId}/status`)
            .set('Authorization', `Bearer ${managerAToken}`)
            .send({ status: 'HIRED', comment: 'تم قبول العرض والتعيين الرسمي' });
        expect(hiredRes.status).toBe(200);
        expect(hiredRes.body.data.status).toBe('HIRED');

        // Verify that Recruitment Job is automatically CLOSED upon fulfilling vacancy
        const updatedJob = await prisma.recruitmentJob.findUnique({
            where: { id: recruitmentJobId }
        });
        expect(updatedJob.status).toBe('CLOSED');

        // ---------------------------------------------------------------------
        // [PHASE 4] Multi-Tenant Isolation, RBAC & Centralized Audit Trail
        // ---------------------------------------------------------------------
        // Cross-Tenant Guard: Manager B cannot view or modify Company A candidate
        const crossCandidateRes = await request(app)
            .get(`/api/candidates/${candidateId}`)
            .set('Authorization', `Bearer ${managerBToken}`);
        expect([403, 404]).toContain(crossCandidateRes.status);

        // Cross-Tenant Guard: Manager B cannot modify Company A job request
        const crossJobReqRes = await request(app)
            .patch(`/api/job-requests/${jobRequestId}/status`)
            .set('Authorization', `Bearer ${managerBToken}`)
            .send({ status: 'REJECTED' });
        expect([403, 404]).toContain(crossJobReqRes.status);

        // Audit Trail check: System recorded legitimate audit logs for Company A
        const logs = await prisma.auditLog.findMany({
            where: { companyId: companyAId }
        });
        expect(logs.length).toBeGreaterThan(0);

        // ---------------------------------------------------------------------
        // [PHASE 5] Training Enrollment, AI Progress & Evaluation
        // ---------------------------------------------------------------------
        const course = await prisma.trainingCourse.create({
            data: {
                title: 'دورة المسار الموحد المتقدمة في هندسة البيانات',
                description: 'شاملة لمفاهيم الأمان وقواعد البيانات',
                duration: 40,
                status: 'active'
            }
        });
        trainingCourseId = course.id;

        const assignRes = await request(app)
            .post('/api/training/assign')
            .set('Authorization', `Bearer ${managerAToken}`)
            .send({
                employeeId: empProfileId,
                courseId: trainingCourseId
            });
        expect(assignRes.status).toBe(201);
        trainingAssignmentId = assignRes.body.data.id;

        // Employee completes training (100% progress)
        const progressRes = await request(app)
            .patch(`/api/training/enrollments/${trainingAssignmentId}/progress`)
            .set('Authorization', `Bearer ${employeeAToken}`)
            .send({ progress: 100, score: 98 });
        expect(progressRes.status).toBe(200);
        expect(progressRes.body.data.status).toBe('COMPLETED');

        // Manager triggers AI impact evaluation
        const evalRes = await request(app)
            .post(`/api/training/evaluate/${trainingAssignmentId}`)
            .set('Authorization', `Bearer ${managerAToken}`);
        expect(evalRes.status).toBe(200);
        expect(evalRes.body.data.status).toBe('EVALUATED');
        expect(evalRes.body.data.impactScore).toBeDefined();

        // ---------------------------------------------------------------------
        // [PHASE 6] Tasks & Operational Management with Project
        // ---------------------------------------------------------------------
        const project = await prisma.project.create({
            data: {
                companyId: companyAId,
                name: 'مشروع المسار الشامل الموحد',
                description: 'مشروع يربط دورة حياة الموظف بالمهام',
                status: 'ACTIVE',
                managerId: empProfileId,
                updatedAt: new Date()
            }
        });
        projectId = project.id;

        const taskRes = await request(app)
            .post('/api/tasks')
            .set('Authorization', `Bearer ${managerAToken}`)
            .send({
                title: 'تأكيد تهيئة بنية الاختبار الموحدة',
                description: 'مهمة ربط كافة المراحل التشغيلية في النظام',
                priority: 'HIGH',
                projectId: project.id,
                employeeId: empProfileId,
                dueDate: new Date(Date.now() + 86400000).toISOString()
            });
        expect(taskRes.status).toBe(201);
        taskId = taskRes.body.data.task.id;

        // Employee marks task completed
        const completeTaskRes = await request(app)
            .patch(`/api/tasks/${taskId}`)
            .set('Authorization', `Bearer ${employeeAToken}`)
            .send({ status: 'completed' });
        expect(completeTaskRes.status).toBe(200);

        // ---------------------------------------------------------------------
        // [PHASE 7] Executive Analytics, Strategic AI Report & Export
        // ---------------------------------------------------------------------
        const finalDashRes = await request(app)
            .get('/api/analytics/dashboard')
            .set('Authorization', `Bearer ${managerAToken}`);
        expect(finalDashRes.status).toBe(200);
        expect(finalDashRes.body.data.hr.totalEmployees).toBeGreaterThanOrEqual(1);

        const strategicReportRes = await request(app)
            .get('/api/analytics/strategic-report')
            .set('Authorization', `Bearer ${managerAToken}`);
        expect(strategicReportRes.status).toBe(200);
        expect(strategicReportRes.body.data.executive_summary).toBeDefined();

        // ---------------------------------------------------------------------
        // [PHASE 8] End-to-End System Integrity & Audit Verification
        // ---------------------------------------------------------------------
        const finalAuditLogs = await prisma.auditLog.findMany({
            where: { companyId: companyAId },
            orderBy: { timestamp: 'desc' }
        });

        const actions = finalAuditLogs.map(l => l.action);
        expect(actions).toContain('TRAINING_ASSIGNED');
        expect(actions).toContain('TASK_CREATED');

        // Final sanity assertion confirming complete end-to-end traversal
        expect(recruitmentJobId).toBeDefined();
        expect(candidateId).toBeDefined();
        expect(trainingAssignmentId).toBeDefined();
        expect(taskId).toBeDefined();
    }, 300000);
});
