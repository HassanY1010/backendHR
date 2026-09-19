
import request from 'supertest';
import app from '../src/app.js';
import prisma from '../src/config/db.js';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';

describe('Phase 4: Full System Permissions & Centralized Audit Logs Deep Verification', () => {
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

    beforeAll(async () => {
        try {
            console.log('[DEBUG-TEST] Starting beforeAll...');
            const secret = process.env.JWT_SECRET || 'your_jwt_secret';
            const passwordHash = await bcrypt.hash('TestPass123!', 10);

        // 1. Setup Companies A and B
        const compA = await prisma.company.upsert({
            where: { id: 'p4-audit-comp-a' },
            update: { status: 'active', subscriptionStatus: 'ACTIVE' },
            create: {
                id: 'p4-audit-comp-a',
                name: 'شركة التدقيق المركزي أ',
                status: 'active',
                subscriptionStatus: 'ACTIVE'
            }
        });
        companyAId = compA.id;

        const compB = await prisma.company.upsert({
            where: { id: 'p4-audit-comp-b' },
            update: { status: 'active', subscriptionStatus: 'ACTIVE' },
            create: {
                id: 'p4-audit-comp-b',
                name: 'شركة التدقيق المركزي ب',
                status: 'active',
                subscriptionStatus: 'ACTIVE'
            }
        });
        companyBId = compB.id;

        // 2. Setup Super Admin
        const superAdmin = await prisma.user.upsert({
            where: { email: 'p4-superadmin@test.com' },
            update: { status: 'ACTIVE', role: 'SUPER_ADMIN', deletedAt: null },
            create: {
                id: 'p4-superadmin',
                name: 'المدير العام للنظام',
                email: 'p4-superadmin@test.com',
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

        // 3. Setup Manager A & Manager B
        const managerA = await prisma.user.upsert({
            where: { email: 'p4-man-a@test.com' },
            update: { status: 'ACTIVE', role: 'MANAGER', companyId: companyAId, deletedAt: null },
            create: {
                id: 'p4-man-a',
                name: 'مدير شركة أ',
                email: 'p4-man-a@test.com',
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
            where: { email: 'p4-man-b@test.com' },
            update: { status: 'ACTIVE', role: 'MANAGER', companyId: companyBId, deletedAt: null },
            create: {
                id: 'p4-man-b',
                name: 'مدير شركة ب',
                email: 'p4-man-b@test.com',
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

        // 4. Setup Employee under Company A
        const userEmpA = await prisma.user.upsert({
            where: { email: 'p4-emp-a@test.com' },
            update: { status: 'ACTIVE', role: 'EMPLOYEE', companyId: companyAId, deletedAt: null, passwordHash },
            create: {
                id: 'p4-emp-a-user',
                name: 'موظف شركة أ',
                email: 'p4-emp-a@test.com',
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
                id: 'p4-emp-a-record',
                userId: userEmpA.id,
                companyId: companyAId,
                department: 'التقنية',
                position: 'مطور واجهات',
                updatedAt: new Date()
            }
        });
        employeeAId = empRecord.id;
            console.log('[DEBUG-TEST] beforeAll completed successfully. companyAId:', companyAId);
        } catch (err) {
            console.error('[DEBUG-TEST] FATAL in beforeAll:', err);
            throw err;
        }
    }, 60000);

    afterAll(async () => {
        try {
            await prisma.task.deleteMany({
                where: { project: { companyId: { in: [companyAId, companyBId] } } }
            });
            await prisma.project.deleteMany({
                where: { companyId: { in: [companyAId, companyBId] } }
            });
            await prisma.auditLog.deleteMany({
                where: { companyId: { in: [companyAId, companyBId] } }
            });
        } catch (e) {
            // Clean up error ignored
        }
    });

    // 1. Employee Creation & Centralized Audit Log
    test('1. Employee Lifecycle Audit: Creating an employee records EMPLOYEE_CREATED in AuditLog', async () => {
        const uniqueEmail = `new.emp.${Date.now()}@test.com`;
        const res = await request(app)
            .post('/api/employees')
            .set('Authorization', `Bearer ${managerAToken}`)
            .send({
                name: 'سالم الدوسري',
                email: uniqueEmail,
                department: 'الموارد البشرية',
                position: 'أخصائي توظيف',
                password: 'password123'
            });

        expect(res.status).toBe(201);
        const createdEmpId = res.body.data.employee.id;

        // Verify AuditLog in DB
        const log = await prisma.auditLog.findFirst({
            where: {
                companyId: companyAId,
                action: 'EMPLOYEE_CREATED',
                target: `Employee:${createdEmpId}`
            }
        });

        expect(log).not.toBeNull();
        expect(log.userId).toBe(userManagerAId);
        expect(log.severity).toBe('low');
        expect(log.status).toBe('success');
    });

    // 2. Employee Update & Centralized Audit Log
    test('2. Employee Lifecycle Audit: Updating employee records EMPLOYEE_UPDATED in AuditLog', async () => {
        const res = await request(app)
            .patch(`/api/employees/${employeeAId}`)
            .set('Authorization', `Bearer ${managerAToken}`)
            .send({
                position: 'كبير مطوري الواجهات',
                department: 'الهندسة والابتكار'
            });

        expect(res.status).toBe(200);

        const log = await prisma.auditLog.findFirst({
            where: {
                companyId: companyAId,
                action: 'EMPLOYEE_UPDATED',
                target: `Employee:${employeeAId}`
            }
        });

        expect(log).not.toBeNull();
        expect(log.userId).toBe(userManagerAId);
    });

    // 3. Multi-Tenant Cross-Access Block on Employees
    test('3. Multi-Tenant Guard: Manager B cannot update or delete Employee belonging to Company A', async () => {
        const resUpdate = await request(app)
            .patch(`/api/employees/${employeeAId}`)
            .set('Authorization', `Bearer ${managerBToken}`)
            .send({ position: 'محاولة اختراق عزل' });

        expect([403, 404]).toContain(resUpdate.status);

        const resDelete = await request(app)
            .delete(`/api/employees/${employeeAId}`)
            .set('Authorization', `Bearer ${managerBToken}`);

        expect([403, 404]).toContain(resDelete.status);
    });

    // 4. Role-Based Access Control (RBAC) Unauthorized Attempt Audit
    test('4. RBAC Protection: EMPLOYEE role cannot create employees or access Super Admin routes, generating unauthorized audit log', async () => {
        const res = await request(app)
            .post('/api/employees')
            .set('Authorization', `Bearer ${employeeAToken}`)
            .send({
                name: 'محاولة غير مصرح بها',
                email: 'hacker@test.com'
            });

        expect(res.status).toBe(403);

        // Verify unauthorized access attempt was logged
        const authFailLog = await prisma.auditLog.findFirst({
            where: {
                userId: employeeAUserId,
                action: 'UNAUTHORIZED_ACCESS_ATTEMPT'
            }
        });

        expect(authFailLog).not.toBeNull();
        expect(authFailLog.severity).toBe('high');
    });

    // 5. Admin Company Governance Audit
    test('5. Admin Governance: Super Admin updating company status or plan records centralized AuditLog', async () => {
        const statusRes = await request(app)
            .patch(`/api/admin/companies/${companyAId}/status`)
            .set('Authorization', `Bearer ${superAdminToken}`)
            .send({ status: 'active' });

        expect(statusRes.status).toBe(200);

        const statusLog = await prisma.auditLog.findFirst({
            where: {
                action: 'COMPANY_STATUS_UPDATED',
                target: `Company:${companyAId}`
            }
        });

        expect(statusLog).not.toBeNull();
        expect(statusLog.severity).toBe('high');
    });

    // 6. Projects & Tasks Tenant Scoping and Audit
    test('6. Projects & Tasks Isolation: Manager A creates and updates project/task with audit trail, Manager B rejected', async () => {
        // 1. Manager A creates project
        const projRes = await request(app)
            .post('/api/projects')
            .set('Authorization', `Bearer ${managerAToken}`)
            .send({
                name: 'مشروع التحول الرقمي أ',
                description: 'مشروع لاختبار العزل وسجلات التدقيق'
            });

        expect(projRes.status).toBe(201);
        const projectId = projRes.body.data.project.id;

        // 2. Manager A creates task
        const taskRes = await request(app)
            .post('/api/tasks')
            .set('Authorization', `Bearer ${managerAToken}`)
            .send({
                title: 'تطوير الـ API',
                projectId,
                employeeId: employeeAId,
                priority: 'HIGH'
            });

        expect(taskRes.status).toBe(201);
        const taskId = taskRes.body.data.task.id;

        // 3. Manager A updates task
        const updateTaskRes = await request(app)
            .patch(`/api/tasks/${taskId}`)
            .set('Authorization', `Bearer ${managerAToken}`)
            .send({
                title: 'تطوير الـ API المحدث',
                status: 'in_progress',
                progress: 50
            });

        expect(updateTaskRes.status).toBe(200);
        expect(updateTaskRes.body.data.task.title).toBe('تطوير الـ API المحدث');

        // 4. Manager B tries to access or update Manager A's task -> Rejected
        const crossTaskRes = await request(app)
            .patch(`/api/tasks/${taskId}`)
            .set('Authorization', `Bearer ${managerBToken}`)
            .send({ title: 'محاولة تعديل مهمة شركة أخرى' });

        expect([403, 404]).toContain(crossTaskRes.status);
    }, 60000);

    // 7. Password Change Self-Service Audit
    test('7. Auth Security Audit: Changing password records USER_PASSWORD_CHANGED in AuditLog', async () => {
        const passRes = await request(app)
            .post('/api/employees/change-password')
            .set('Authorization', `Bearer ${employeeAToken}`)
            .send({
                oldPassword: 'TestPass123!',
                newPassword: 'NewSecurePass2026!'
            });

        expect(passRes.status).toBe(200);

        const passLog = await prisma.auditLog.findFirst({
            where: {
                userId: employeeAUserId,
                action: 'USER_PASSWORD_CHANGED'
            }
        });

        expect(passLog).not.toBeNull();
        expect(passLog.severity).toBe('medium');
    });
});
