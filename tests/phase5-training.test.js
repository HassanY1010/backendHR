import request from 'supertest';
import app from '../src/app.js';
import prisma from '../src/config/db.js';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';

describe('Phase 5: Training Courses, Assignments, Needs Detection & Evaluation Deep Verification', () => {
    let companyAId;
    let companyBId;
    let superAdminToken;
    let managerAToken;
    let managerBToken;
    let employeeAToken;
    let userSuperAdminId;
    let userManagerAId;
    let userManagerBId;
    let employeeAId;
    let employeeAUserId;
    let testCourseId;
    let assignmentAId;

    beforeAll(async () => {
        const secret = process.env.JWT_SECRET || 'your_jwt_secret';
        const passwordHash = await bcrypt.hash('TestPass123!', 10);

        // 1. Setup Companies
        const compA = await prisma.company.upsert({
            where: { id: 'p5-training-comp-a' },
            update: { status: 'active', subscriptionStatus: 'ACTIVE' },
            create: {
                id: 'p5-training-comp-a',
                name: 'شركة التدريب أ',
                status: 'active',
                subscriptionStatus: 'ACTIVE'
            }
        });
        companyAId = compA.id;

        const compB = await prisma.company.upsert({
            where: { id: 'p5-training-comp-b' },
            update: { status: 'active', subscriptionStatus: 'ACTIVE' },
            create: {
                id: 'p5-training-comp-b',
                name: 'شركة التدريب ب',
                status: 'active',
                subscriptionStatus: 'ACTIVE'
            }
        });
        companyBId = compB.id;

        // 2. Setup Super Admin
        const superAdmin = await prisma.user.upsert({
            where: { email: 'p5-superadmin@test.com' },
            update: { status: 'ACTIVE', role: 'SUPER_ADMIN', deletedAt: null },
            create: {
                id: 'p5-superadmin',
                name: 'المدير العام للنظام',
                email: 'p5-superadmin@test.com',
                passwordHash,
                role: 'SUPER_ADMIN',
                status: 'ACTIVE',
                deletedAt: null
            }
        });
        userSuperAdminId = superAdmin.id;
        superAdminToken = jwt.sign(
            { id: superAdmin.id, email: superAdmin.email, role: 'SUPER_ADMIN' },
            secret,
            { expiresIn: '2h' }
        );

        // 3. Setup Managers
        const managerA = await prisma.user.upsert({
            where: { email: 'p5-man-a@test.com' },
            update: { status: 'ACTIVE', role: 'MANAGER', companyId: companyAId, deletedAt: null },
            create: {
                id: 'p5-man-a',
                name: 'مدير تدريب أ',
                email: 'p5-man-a@test.com',
                passwordHash,
                role: 'MANAGER',
                status: 'ACTIVE',
                companyId: companyAId,
                deletedAt: null
            }
        });
        userManagerAId = managerA.id;
        managerAToken = jwt.sign(
            { id: managerA.id, email: managerA.email, role: 'MANAGER', companyId: companyAId },
            secret,
            { expiresIn: '2h' }
        );

        const managerB = await prisma.user.upsert({
            where: { email: 'p5-man-b@test.com' },
            update: { status: 'ACTIVE', role: 'MANAGER', companyId: companyBId, deletedAt: null },
            create: {
                id: 'p5-man-b',
                name: 'مدير تدريب ب',
                email: 'p5-man-b@test.com',
                passwordHash,
                role: 'MANAGER',
                status: 'ACTIVE',
                companyId: companyBId,
                deletedAt: null
            }
        });
        userManagerBId = managerB.id;
        managerBToken = jwt.sign(
            { id: managerB.id, email: managerB.email, role: 'MANAGER', companyId: companyBId },
            secret,
            { expiresIn: '2h' }
        );

        // 4. Setup Employee A
        const userEmpA = await prisma.user.upsert({
            where: { email: 'p5-emp-a@test.com' },
            update: { status: 'ACTIVE', role: 'EMPLOYEE', companyId: companyAId, deletedAt: null, passwordHash },
            create: {
                id: 'p5-emp-a-user',
                name: 'موظف تدريب أ',
                email: 'p5-emp-a@test.com',
                passwordHash,
                role: 'EMPLOYEE',
                status: 'ACTIVE',
                companyId: companyAId,
                deletedAt: null
            }
        });
        employeeAUserId = userEmpA.id;
        employeeAToken = jwt.sign(
            { id: userEmpA.id, email: userEmpA.email, role: 'EMPLOYEE', companyId: companyAId },
            secret,
            { expiresIn: '2h' }
        );

        const empRecord = await prisma.employee.upsert({
            where: { userId: userEmpA.id },
            update: { companyId: companyAId, deletedAt: null, updatedAt: new Date() },
            create: {
                id: 'p5-emp-a-record',
                userId: userEmpA.id,
                companyId: companyAId,
                department: 'الموارد البشرية',
                position: 'مسؤول تدريب وتطوير',
                updatedAt: new Date()
            }
        });
        employeeAId = empRecord.id;

        // 5. Setup Course
        const course = await prisma.trainingCourse.upsert({
            where: { id: 'p5-test-course' },
            update: { status: 'active', deletedAt: null },
            create: {
                id: 'p5-test-course',
                title: 'دورة القيادة وإدارة الفرق الحديثة',
                description: 'دورة تدريبية متخصصة في تنمية المهارات القيادية وإدارة فرق العمل',
                category: 'Management',
                provider: 'AI Academy',
                duration: 120,
                level: 'intermediate',
                language: 'ar',
                status: 'active',
                deletedAt: null
            }
        });
        testCourseId = course.id;
    }, 60000);

    afterAll(async () => {
        try {
            await prisma.trainingAssignment.deleteMany({
                where: { employeeId: employeeAId }
            });
            await prisma.trainingRequest.deleteMany({
                where: { employeeId: employeeAId }
            });
        } catch (e) {
            // Cleanup error ignored
        }
    });

    // 1. Get Courses List
    test('1. Courses Repository: Retrieve active courses successfully', async () => {
        const res = await request(app)
            .get('/api/training/courses')
            .set('Authorization', `Bearer ${employeeAToken}`);

        expect(res.status).toBe(200);
        expect(Array.isArray(res.body.data)).toBe(true);
        const found = res.body.data.find(c => c.id === testCourseId);
        expect(found).toBeDefined();
    });

    // 2. Manager Assigns Training with Tenant Verification & Audit Logging
    test('2. Training Assignment: Manager A assigns course to Employee A, creating audit trail', async () => {
        const res = await request(app)
            .post('/api/training/assign')
            .set('Authorization', `Bearer ${managerAToken}`)
            .send({
                employeeId: employeeAId,
                courseId: testCourseId
            });

        expect(res.status).toBe(201);
        expect(res.body.data).toBeDefined();
        expect(res.body.data.courseId).toBe(testCourseId);
        assignmentAId = res.body.data.id;

        // Verify audit log
        const log = await prisma.auditLog.findFirst({
            where: {
                companyId: companyAId,
                action: 'TRAINING_ASSIGNED'
            }
        });

        expect(log).not.toBeNull();
        expect(log.userId).toBe(userManagerAId);
    });

    // 3. Multi-Tenant Guard: Manager B cannot assign training to Employee A
    test('3. Multi-Tenant Guard: Manager B cannot assign training to Employee belonging to Company A', async () => {
        const res = await request(app)
            .post('/api/training/assign')
            .set('Authorization', `Bearer ${managerBToken}`)
            .send({
                employeeId: employeeAId,
                courseId: testCourseId
            });

        expect([403, 404]).toContain(res.status);
    });

    // 4. Employee Training Lifecycle: Start & Complete Training
    test('4. Training Progress Lifecycle: Employee starts and completes assigned training', async () => {
        // Start training
        const startRes = await request(app)
            .patch(`/api/training/enrollments/${assignmentAId}/progress`)
            .set('Authorization', `Bearer ${employeeAToken}`)
            .send({
                progress: 50,
                score: 80
            });

        expect(startRes.status).toBe(200);
        expect(startRes.body.data.status).toBe('IN_PROGRESS');

        // Complete training
        const completeRes = await request(app)
            .patch(`/api/training/enrollments/${assignmentAId}/progress`)
            .set('Authorization', `Bearer ${employeeAToken}`)
            .send({
                progress: 100,
                score: 95
            });

        expect(completeRes.status).toBe(200);
        expect(completeRes.body.data.status).toBe('COMPLETED');
    });

    // 5. Training Impact Evaluation (AI Evaluation)
    test('5. Impact Analyzer: Evaluates completed training and updates impact score', async () => {
        const evalRes = await request(app)
            .post(`/api/training/evaluate/${assignmentAId}`)
            .set('Authorization', `Bearer ${managerAToken}`);

        expect(evalRes.status).toBe(200);
        expect(evalRes.body.data).toBeDefined();
        expect(evalRes.body.data.status).toBe('EVALUATED');
        expect(evalRes.body.data.impactScore).toBeDefined();
    });

    // 6. Multi-Tenant Analytics & Isolation: Manager A vs Manager B
    test('6. Training Analytics Isolation: Manager A views company training analytics, Manager B isolated', async () => {
        const analyticsResA = await request(app)
            .get('/api/training/analytics')
            .set('Authorization', `Bearer ${managerAToken}`);

        expect(analyticsResA.status).toBe(200);
        expect(Array.isArray(analyticsResA.body.data)).toBe(true);
        const itemA = analyticsResA.body.data.find(i => i.id === testCourseId);
        expect(itemA).toBeDefined();

        // Manager B should not see Company A's employee records
        const analyticsResB = await request(app)
            .get('/api/training/analytics')
            .set('Authorization', `Bearer ${managerBToken}`);

        expect(analyticsResB.status).toBe(200);
        const crossItem = analyticsResB.body.data.find(i => i.employeeName === 'موظف تدريب أ');
        expect(crossItem).toBeUndefined();
    });

    // 7. Training Request & Manager Approval with Audit Logging
    test('7. Training Request & Approval: Employee requests enrollment and Manager approves with audit log', async () => {
        // Create second course for request
        const course2 = await prisma.trainingCourse.create({
            data: {
                title: 'دورة الذكاء الاصطناعي في إدارة الأعمال',
                description: 'تطبيقات الذكاء الاصطناعي في إدارة الموارد',
                duration: 90,
                status: 'active'
            }
        });

        // Employee requests enrollment
        const enrollRes = await request(app)
            .post(`/api/training/enroll/${course2.id}`)
            .set('Authorization', `Bearer ${employeeAToken}`);

        expect(enrollRes.status).toBe(201);
        const requestId = enrollRes.body.data.id;

        // Manager approves request
        const approveRes = await request(app)
            .patch(`/api/training/requests/${requestId}`)
            .set('Authorization', `Bearer ${managerAToken}`)
            .send({ status: 'APPROVED' });

        expect(approveRes.status).toBe(200);

        // Verify audit log
        const log = await prisma.auditLog.findFirst({
            where: {
                companyId: companyAId,
                action: 'TRAINING_REQUEST_APPROVED'
            }
        });

        expect(log).not.toBeNull();

        // Cleanup course2
        await prisma.trainingAssignment.deleteMany({ where: { courseId: course2.id } });
        await prisma.trainingRequest.deleteMany({ where: { courseId: course2.id } });
        await prisma.trainingCourse.delete({ where: { id: course2.id } });
    });
});
