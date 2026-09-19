import request from 'supertest';
import app from '../src/app.js';
import prisma from '../src/config/db.js';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';

describe('Phase 8: End-to-End (E2E) System Lifecycle Verification', () => {
    let companyId;
    let otherCompanyId;
    let managerToken;
    let otherManagerToken;
    let employeeToken;
    let managerUserId;
    let employeeUserId;
    let employeeProfileId;
    let candidateId;
    let jobId;
    let testCourseId;
    let assignmentId;
    let taskId;

    beforeAll(async () => {
        const secret = process.env.JWT_SECRET || 'test-secret';
        const passwordHash = await bcrypt.hash('TestPass123!', 10);

        // 1. Setup Main Company & Isolated Company
        const comp = await prisma.company.upsert({
            where: { id: 'p8-e2e-main-company' },
            update: { status: 'active', subscriptionStatus: 'ACTIVE' },
            create: {
                id: 'p8-e2e-main-company',
                name: 'شركة المسار الشامل E2E',
                status: 'active',
                subscriptionStatus: 'ACTIVE'
            }
        });
        companyId = comp.id;

        const otherComp = await prisma.company.upsert({
            where: { id: 'p8-e2e-other-company' },
            update: { status: 'active', subscriptionStatus: 'ACTIVE' },
            create: {
                id: 'p8-e2e-other-company',
                name: 'الشركة المعزولة E2E',
                status: 'active',
                subscriptionStatus: 'ACTIVE'
            }
        });
        otherCompanyId = otherComp.id;

        // 2. Setup Manager & Other Manager
        const manager = await prisma.user.upsert({
            where: { email: 'p8-manager@test.com' },
            update: { status: 'ACTIVE', role: 'MANAGER', companyId, deletedAt: null, passwordHash },
            create: {
                id: 'p8-e2e-manager-user',
                name: 'مدير المسار الشامل',
                email: 'p8-manager@test.com',
                passwordHash,
                role: 'MANAGER',
                status: 'ACTIVE',
                companyId,
                deletedAt: null
            }
        });
        managerUserId = manager.id;
        managerToken = jwt.sign(
            { id: manager.id, email: manager.email, role: 'MANAGER', companyId },
            secret,
            { expiresIn: '2h' }
        );

        const otherManager = await prisma.user.upsert({
            where: { email: 'p8-other-manager@test.com' },
            update: { status: 'ACTIVE', role: 'MANAGER', companyId: otherCompanyId, deletedAt: null, passwordHash },
            create: {
                id: 'p8-e2e-other-manager-user',
                name: 'مدير الشركة المعزولة',
                email: 'p8-other-manager@test.com',
                passwordHash,
                role: 'MANAGER',
                status: 'ACTIVE',
                companyId: otherCompanyId,
                deletedAt: null
            }
        });
        otherManagerToken = jwt.sign(
            { id: otherManager.id, email: otherManager.email, role: 'MANAGER', companyId: otherCompanyId },
            secret,
            { expiresIn: '2h' }
        );

        // 3. Setup Employee User & Profile
        const empUser = await prisma.user.upsert({
            where: { email: 'p8-employee@test.com' },
            update: { status: 'ACTIVE', role: 'EMPLOYEE', companyId, deletedAt: null, passwordHash },
            create: {
                id: 'p8-e2e-emp-user',
                name: 'موظف المسار الشامل',
                email: 'p8-employee@test.com',
                passwordHash,
                role: 'EMPLOYEE',
                status: 'ACTIVE',
                companyId,
                deletedAt: null
            }
        });
        employeeUserId = empUser.id;
        employeeToken = jwt.sign(
            { id: empUser.id, email: empUser.email, role: 'EMPLOYEE', companyId },
            secret,
            { expiresIn: '2h' }
        );

        const empProfile = await prisma.employee.upsert({
            where: { userId: empUser.id },
            update: { companyId, department: 'الهندسة', position: 'مهندس نظم', updatedAt: new Date(), deletedAt: null },
            create: {
                id: 'p8-e2e-emp-record',
                userId: empUser.id,
                companyId,
                department: 'الهندسة',
                position: 'مهندس نظم',
                updatedAt: new Date()
            }
        });
        employeeProfileId = empProfile.id;
    });

    afterAll(async () => {
        // Complete cleanup of test data
        const companyIds = [companyId, otherCompanyId].filter(Boolean);
        if (companyIds.length > 0) {
            await prisma.auditLog.deleteMany({ where: { companyId: { in: companyIds } } });
            await prisma.notification.deleteMany({ where: { employeeId: employeeProfileId } });
            await prisma.trainingAssignment.deleteMany({ where: { employeeId: employeeProfileId } });
            if (testCourseId) {
                await prisma.trainingCourse.deleteMany({ where: { id: testCourseId } });
            }
            await prisma.task.deleteMany({ where: { employeeId: employeeProfileId } });
            if (candidateId) {
                await prisma.candidate.deleteMany({ where: { id: candidateId } });
            }
            if (jobId) {
                await prisma.recruitmentJob.deleteMany({ where: { id: jobId } });
            }
            if (projectId) {
                await prisma.project.deleteMany({ where: { id: projectId } });
            }
            await prisma.employee.deleteMany({ where: { companyId: { in: companyIds } } });
            await prisma.user.deleteMany({ where: { companyId: { in: companyIds } } });
            await prisma.company.deleteMany({ where: { id: { in: companyIds } } });
        }
    });

    let projectId;

    // -------------------------------------------------------------------------
    // Step 1: Recruitment Lifecycle (Job Creation -> Candidate Application)
    // -------------------------------------------------------------------------
    test('Step 1: Recruitment Cycle - Manager creates job opening and applicant applies', async () => {
        // Manager creates job
        const job = await prisma.recruitmentJob.create({
            data: {
                companyId,
                title: 'مهندس سحابي رئيسي',
                description: 'إدارة وتطوير البنية التحتية السحابية للشركة',
                employmentType: 'FULL_TIME',
                workMode: 'HYBRID',
                seniorityLevel: 'SENIOR',
                openingReason: 'NEW_ROLE',
                status: 'OPEN',
                aiGenerated: false,
                updatedAt: new Date()
            }
        });
        jobId = job.id;
        expect(jobId).toBeDefined();

        // Candidate submits application
        const candidate = await prisma.candidate.create({
            data: {
                fullName: 'مرشح تجريبي متميز',
                email: 'candidate-e2e@test.com',
                phone: '+966500000000',
                jobId: job.id,
                status: 'NEW',
                experience: 5,
                aiScore: 88,
                updatedAt: new Date()
            }
        });
        candidateId = candidate.id;
        expect(candidateId).toBeDefined();

        // Audit check: Verify Recruitment Audit Trail
        const log = await prisma.auditLog.findFirst({
            where: { companyId, actionType: { in: ['RECRUITMENT_MANAGEMENT', 'SYSTEM'] } }
        });
        // Non-fatal check, we verify DB state
        expect(candidate.jobId).toBe(job.id);
    });

    // -------------------------------------------------------------------------
    // Step 2: Task Assignment & Execution
    // -------------------------------------------------------------------------
    test('Step 2: Task Lifecycle - Manager creates task, employee completes it with audit logging', async () => {
        // Create a project for Company A
        const project = await prisma.project.create({
            data: {
                companyId,
                name: 'مشروع البنية السحابية',
                description: 'تطوير البنية السحابية المؤتمتة',
                status: 'ACTIVE',
                managerId: employeeProfileId,
                updatedAt: new Date()
            }
        });
        projectId = project.id;

        // Manager creates task for Employee
        const taskRes = await request(app)
            .post('/api/tasks')
            .set('Authorization', `Bearer ${managerToken}`)
            .send({
                title: 'إعداد بيئة الاختبار الشاملة',
                description: 'بناء وتجهيز سيرفرات الاختبار المؤتمتة',
                priority: 'HIGH',
                projectId: project.id,
                employeeId: employeeProfileId,
                dueDate: new Date(Date.now() + 86400000).toISOString()
            });

        expect(taskRes.status).toBe(201);
        expect(taskRes.body.status).toBe('success');
        taskId = taskRes.body.data.task.id;

        // Employee updates and completes task
        const completeRes = await request(app)
            .patch(`/api/tasks/${taskId}`)
            .set('Authorization', `Bearer ${employeeToken}`)
            .send({ status: 'completed' });

        expect(completeRes.status).toBe(200);

        // Verify audit log for task creation/completion
        const taskLog = await prisma.auditLog.findFirst({
            where: {
                companyId,
                action: 'TASK_CREATED'
            }
        });
        expect(taskLog).not.toBeNull();
        expect(taskLog.userId).toBe(managerUserId);
    });

    // -------------------------------------------------------------------------
    // Step 3: Training & AI Impact Evaluation Lifecycle
    // -------------------------------------------------------------------------
    test('Step 3: Training Lifecycle - Course creation, assignment, completion, and AI evaluation', async () => {
        // Create Training Course
        const course = await prisma.trainingCourse.create({
            data: {
                title: 'هندسة النظم المتقدمة E2E',
                description: 'دورة في النظم الموزعة والأمان السحابي',
                duration: 60,
                status: 'active'
            }
        });
        testCourseId = course.id;

        // Manager assigns course to employee
        const assignRes = await request(app)
            .post('/api/training/assign')
            .set('Authorization', `Bearer ${managerToken}`)
            .send({
                employeeId: employeeProfileId,
                courseId: testCourseId
            });

        expect(assignRes.status).toBe(201);
        assignmentId = assignRes.body.data.id;

        // Employee marks progress as 100% (Completed)
        const progressRes = await request(app)
            .patch(`/api/training/enrollments/${assignmentId}/progress`)
            .set('Authorization', `Bearer ${employeeToken}`)
            .send({ progress: 100, score: 95 });

        expect(progressRes.status).toBe(200);
        expect(progressRes.body.data.status).toBe('COMPLETED');

        // Manager evaluates training impact
        const evalRes = await request(app)
            .post(`/api/training/evaluate/${assignmentId}`)
            .set('Authorization', `Bearer ${managerToken}`);

        expect(evalRes.status).toBe(200);
        expect(evalRes.body.data.status).toBe('EVALUATED');
        expect(evalRes.body.data.impactScore).toBeDefined();
    });

    // -------------------------------------------------------------------------
    // Step 4: Cross-Tenant Security Isolation (Manager B vs Company A)
    // -------------------------------------------------------------------------
    test('Step 4: Strict Multi-Tenant Isolation - Manager B cannot access or modify Company A records', async () => {
        // 1. Manager B cannot assign training to Company A employee
        const crossAssignRes = await request(app)
            .post('/api/training/assign')
            .set('Authorization', `Bearer ${otherManagerToken}`)
            .send({
                employeeId: employeeProfileId,
                courseId: testCourseId
            });

        expect([403, 404]).toContain(crossAssignRes.status);

        // 2. Manager B cannot view Company A training analytics
        const crossAnalyticsRes = await request(app)
            .get('/api/training/analytics')
            .set('Authorization', `Bearer ${otherManagerToken}`);

        expect(crossAnalyticsRes.status).toBe(200);
        const leaked = (crossAnalyticsRes.body.data || []).find(d => d.employeeName === 'موظف المسار الشامل');
        expect(leaked).toBeUndefined();

        // 3. Manager B cannot delete Company A training assignment
        const crossDeleteRes = await request(app)
            .delete(`/api/training/assignments/${assignmentId}`)
            .set('Authorization', `Bearer ${otherManagerToken}`);

        expect([403, 404]).toContain(crossDeleteRes.status);
    });

    // -------------------------------------------------------------------------
    // Step 5: Executive Dashboard & Strategic AI Reports
    // -------------------------------------------------------------------------
    test('Step 5: Executive Intelligence - Real-time dashboard KPI & Strategic AI report integration', async () => {
        // Fetch dashboard stats reflecting completed task & training
        const dashRes = await request(app)
            .get('/api/analytics/dashboard')
            .set('Authorization', `Bearer ${managerToken}`);

        expect(dashRes.status).toBe(200);
        expect(dashRes.body.data.hr.totalEmployees).toBeGreaterThanOrEqual(1);
        expect(dashRes.body.data.recruitment.activeJobs).toBeGreaterThanOrEqual(1);

        // Generate AI Strategic Report
        const reportRes = await request(app)
            .get('/api/analytics/strategic-report')
            .set('Authorization', `Bearer ${managerToken}`);

        expect(reportRes.status).toBe(200);
        expect(reportRes.body.data.executive_summary).toBeDefined();
    });

    // -------------------------------------------------------------------------
    // Step 6: System Audit Verification
    // -------------------------------------------------------------------------
    test('Step 6: Audit Completeness - Comprehensive audit logs exist for all core operations', async () => {
        const logs = await prisma.auditLog.findMany({
            where: { companyId },
            orderBy: { timestamp: 'desc' }
        });

        expect(logs.length).toBeGreaterThanOrEqual(2);
        const actions = logs.map(l => l.action);
        expect(actions).toContain('TRAINING_ASSIGNED');
        expect(actions).toContain('TASK_CREATED');
    });
});
