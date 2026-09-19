import request from 'supertest';
import app from '../src/app.js';
import prisma from '../src/config/db.js';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';

describe('Phase 7: Reports & Analytics Multi-Tenant Deep Verification', () => {
    let companyAId;
    let companyBId;
    let managerAToken;
    let managerBToken;
    let employeeAToken;
    let superAdminToken;
    let userManagerAId;
    let userManagerBId;
    let employeeAId;

    beforeAll(async () => {
        const secret = process.env.JWT_SECRET || 'test-secret';
        const passwordHash = await bcrypt.hash('TestPass123!', 10);

        // 1. Setup Companies
        const compA = await prisma.company.upsert({
            where: { id: 'p7-reports-comp-a' },
            update: { status: 'active', subscriptionStatus: 'ACTIVE' },
            create: {
                id: 'p7-reports-comp-a',
                name: 'شركة التقارير أ',
                status: 'active',
                subscriptionStatus: 'ACTIVE'
            }
        });
        companyAId = compA.id;

        const compB = await prisma.company.upsert({
            where: { id: 'p7-reports-comp-b' },
            update: { status: 'active', subscriptionStatus: 'ACTIVE' },
            create: {
                id: 'p7-reports-comp-b',
                name: 'شركة التقارير ب',
                status: 'active',
                subscriptionStatus: 'ACTIVE'
            }
        });
        companyBId = compB.id;

        // 2. Setup Super Admin
        const superAdmin = await prisma.user.upsert({
            where: { email: 'p7-superadmin@test.com' },
            update: { status: 'ACTIVE', role: 'SUPER_ADMIN', deletedAt: null },
            create: {
                id: 'p7-superadmin',
                name: 'المدير العام للنظام',
                email: 'p7-superadmin@test.com',
                passwordHash,
                role: 'SUPER_ADMIN',
                status: 'ACTIVE',
                deletedAt: null
            }
        });
        superAdminToken = jwt.sign(
            { id: superAdmin.id, email: superAdmin.email, role: 'SUPER_ADMIN' },
            secret,
            { expiresIn: '2h' }
        );

        // 3. Setup Manager A
        const managerA = await prisma.user.upsert({
            where: { email: 'p7-manager-a@test.com' },
            update: { status: 'ACTIVE', role: 'MANAGER', companyId: companyAId, deletedAt: null, passwordHash },
            create: {
                id: 'p7-manager-a',
                name: 'مدير تقارير أ',
                email: 'p7-manager-a@test.com',
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

        // 4. Setup Manager B
        const managerB = await prisma.user.upsert({
            where: { email: 'p7-manager-b@test.com' },
            update: { status: 'ACTIVE', role: 'MANAGER', companyId: companyBId, deletedAt: null, passwordHash },
            create: {
                id: 'p7-manager-b',
                name: 'مدير تقارير ب',
                email: 'p7-manager-b@test.com',
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

        // 5. Setup Employee A
        const userEmpA = await prisma.user.upsert({
            where: { email: 'p7-emp-a@test.com' },
            update: { status: 'ACTIVE', role: 'EMPLOYEE', companyId: companyAId, deletedAt: null, passwordHash },
            create: {
                id: 'p7-emp-a-user',
                name: 'موظف تقارير أ',
                email: 'p7-emp-a@test.com',
                passwordHash,
                role: 'EMPLOYEE',
                status: 'ACTIVE',
                companyId: companyAId,
                deletedAt: null
            }
        });

        const empA = await prisma.employee.upsert({
            where: { userId: userEmpA.id },
            update: { companyId: companyAId, deletedAt: null, updatedAt: new Date() },
            create: {
                id: 'p7-emp-a-record',
                userId: userEmpA.id,
                companyId: companyAId,
                department: 'المالية',
                position: 'محلل مالي',
                updatedAt: new Date()
            }
        });
        employeeAId = empA.id;

        employeeAToken = jwt.sign(
            { id: userEmpA.id, email: userEmpA.email, role: 'EMPLOYEE', companyId: companyAId },
            secret,
            { expiresIn: '2h' }
        );
    });

    afterAll(async () => {
        // Cleanup test data
        const companyIds = [companyAId, companyBId].filter(Boolean);
        if (companyIds.length > 0) {
            await prisma.jobRequest.deleteMany({ where: { companyId: { in: companyIds } } });
            await prisma.hiringPlan.deleteMany({ where: { companyId: { in: companyIds } } });
            await prisma.department.deleteMany({ where: { companyId: { in: companyIds } } });
            await prisma.employee.deleteMany({ where: { companyId: { in: companyIds } } });
            await prisma.user.deleteMany({ where: { companyId: { in: companyIds } } });
            await prisma.company.deleteMany({ where: { id: { in: companyIds } } });
        }
    });

    // -------------------------------------------------------------
    // Test 1: Dashboard Analytics & KPI Scoping
    // -------------------------------------------------------------
    test('1. Dashboard Analytics: Manager A receives scoped company stats', async () => {
        const res = await request(app)
            .get('/api/analytics/dashboard')
            .set('Authorization', `Bearer ${managerAToken}`);

        expect(res.status).toBe(200);
        expect(res.body.status).toBe('success');
        expect(res.body.data).toBeDefined();
        expect(typeof res.body.data.hr.totalEmployees).toBe('number');
        expect(typeof res.body.data.recruitment.activeJobs).toBe('number');
    });

    // -------------------------------------------------------------
    // Test 2: Role Authorization Guard: Employees cannot view manager analytics
    // -------------------------------------------------------------
    test('2. Authorization Guard: Employees are blocked from accessing manager dashboard stats', async () => {
        const res = await request(app)
            .get('/api/analytics/dashboard')
            .set('Authorization', `Bearer ${employeeAToken}`);

        expect([401, 403]).toContain(res.status);
    });

    // -------------------------------------------------------------
    // Test 3: Hiring Types & SLA Reports
    // -------------------------------------------------------------
    test('3. Hiring Reports: Manager retrieves hiring report summary with company scoping', async () => {
        // Create a department for Company A
        const deptA = await prisma.department.upsert({
            where: { id: 'p7-dept-a' },
            update: { name: 'قسم البرمجيات', companyId: companyAId },
            create: {
                id: 'p7-dept-a',
                name: 'قسم البرمجيات',
                companyId: companyAId
            }
        });

        // Create an immediate job request for Company A
        await prisma.jobRequest.create({
            data: {
                requestId: `REQ-${Date.now()}`,
                companyId: companyAId,
                createdBy: userManagerAId,
                departmentId: deptA.id,
                jobTitle: 'مهندس برمجيات عاجل',
                location: 'الرياض',
                employmentType: 'FULL_TIME',
                vacancies: 1,
                hiringType: 'IMMEDIATE',
                hiringReason: 'NEW_POSITION',
                priority: 'URGENT',
                status: 'SUBMITTED',
                updatedAt: new Date()
            }
        });

        const resA = await request(app)
            .get('/api/hiring-reports/summary')
            .set('Authorization', `Bearer ${managerAToken}`);

        expect(resA.status).toBe(200);
        expect(resA.body.success).toBe(true);
        expect(resA.body.data.summary.immediateJobsCount).toBeGreaterThanOrEqual(1);

        // Manager B sees 0 immediate jobs for company B
        const resB = await request(app)
            .get('/api/hiring-reports/summary')
            .set('Authorization', `Bearer ${managerBToken}`);

        expect(resB.status).toBe(200);
        expect(resB.body.success).toBe(true);
        expect(resB.body.data.summary.immediateJobsCount).toBe(0);
    });

    // -------------------------------------------------------------
    // Test 4: Recruitment Funnel Analytics
    // -------------------------------------------------------------
    test('4. Recruitment Funnel: Manager retrieves recruitment pipeline analytics', async () => {
        const res = await request(app)
            .get('/api/analytics/recruitment')
            .set('Authorization', `Bearer ${managerAToken}`);

        expect(res.status).toBe(200);
        expect(res.body.status).toBe('success');
        expect(res.body.data).toBeDefined();
        expect(Array.isArray(res.body.data.byStatus)).toBe(true);
    });

    // -------------------------------------------------------------
    // Test 5: Training Analytics Scoping
    // -------------------------------------------------------------
    test('5. Training Analytics: Scoped training completion and category distribution', async () => {
        const res = await request(app)
            .get('/api/analytics/training')
            .set('Authorization', `Bearer ${managerAToken}`);

        expect(res.status).toBe(200);
        expect(res.body.status).toBe('success');
        expect(res.body.data).toBeDefined();
        expect(typeof res.body.data.completionRate).toBe('number');
    });

    // -------------------------------------------------------------
    // Test 6: AI Strategic Report Generation
    // -------------------------------------------------------------
    test('6. Strategic AI Report: Generates comprehensive HR strategic insights', async () => {
        const res = await request(app)
            .get('/api/analytics/strategic-report')
            .set('Authorization', `Bearer ${managerAToken}`);

        expect(res.status).toBe(200);
        expect(res.body.status).toBe('success');
        expect(res.body.data).toBeDefined();
        expect(res.body.data.executive_summary).toBeDefined();
    });

    // -------------------------------------------------------------
    // Test 7: Super Admin Platform Metrics Isolation
    // -------------------------------------------------------------
    test('7. Super Admin Metrics: System stats accessible by Super Admin and blocked for Managers', async () => {
        // Manager cannot access system-health
        const managerRes = await request(app)
            .get('/api/analytics/system-health')
            .set('Authorization', `Bearer ${managerAToken}`);

        expect([401, 403]).toContain(managerRes.status);

        // Super Admin can access system-health
        const adminRes = await request(app)
            .get('/api/analytics/system-health')
            .set('Authorization', `Bearer ${superAdminToken}`);

        expect(adminRes.status).toBe(200);
        expect(adminRes.body.status).toBe('success');
    });
});
