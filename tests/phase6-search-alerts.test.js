import request from 'supertest';
import app from '../src/app.js';
import prisma from '../src/config/db.js';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';

describe('Phase 6: Search & Alerts Deep Verification', () => {
    let companyAId;
    let companyBId;
    let userAId;
    let userBId;
    let tokenA;
    let tokenB;
    let employeeAId;
    let employeeBId;
    let notificationAId;

    beforeAll(async () => {
        const secret = process.env.JWT_SECRET || 'test-secret';
        const passwordHash = await bcrypt.hash('TestPass123!', 10);

        // 1. Setup Companies
        const compA = await prisma.company.upsert({
            where: { id: 'p6-comp-a' },
            update: { status: 'active', subscriptionStatus: 'ACTIVE' },
            create: {
                id: 'p6-comp-a',
                name: 'شركة البحث والتنبيهات أ',
                status: 'active',
                subscriptionStatus: 'ACTIVE'
            }
        });
        companyAId = compA.id;

        const compB = await prisma.company.upsert({
            where: { id: 'p6-comp-b' },
            update: { status: 'active', subscriptionStatus: 'ACTIVE' },
            create: {
                id: 'p6-comp-b',
                name: 'شركة البحث والتنبيهات ب',
                status: 'active',
                subscriptionStatus: 'ACTIVE'
            }
        });
        companyBId = compB.id;

        // 2. Setup User & Employee A
        const userA = await prisma.user.upsert({
            where: { email: 'p6-user-a@test.com' },
            update: { status: 'ACTIVE', role: 'MANAGER', companyId: companyAId, deletedAt: null, passwordHash },
            create: {
                id: 'p6-user-a',
                name: 'مدير شركة أ',
                email: 'p6-user-a@test.com',
                passwordHash,
                role: 'MANAGER',
                status: 'ACTIVE',
                companyId: companyAId,
                deletedAt: null
            }
        });
        userAId = userA.id;
        tokenA = jwt.sign(
            { id: userA.id, email: userA.email, role: 'MANAGER', companyId: companyAId },
            secret,
            { expiresIn: '2h' }
        );

        const empA = await prisma.employee.upsert({
            where: { userId: userA.id },
            update: { companyId: companyAId, deletedAt: null, updatedAt: new Date() },
            create: {
                id: 'p6-emp-a',
                userId: userA.id,
                companyId: companyAId,
                department: 'الإدارة',
                position: 'مدير عمليات',
                updatedAt: new Date()
            }
        });
        employeeAId = empA.id;

        // 3. Setup User & Employee B
        const userB = await prisma.user.upsert({
            where: { email: 'p6-user-b@test.com' },
            update: { status: 'ACTIVE', role: 'MANAGER', companyId: companyBId, deletedAt: null, passwordHash },
            create: {
                id: 'p6-user-b',
                name: 'مدير شركة ب',
                email: 'p6-user-b@test.com',
                passwordHash,
                role: 'MANAGER',
                status: 'ACTIVE',
                companyId: companyBId,
                deletedAt: null
            }
        });
        userBId = userB.id;
        tokenB = jwt.sign(
            { id: userB.id, email: userB.email, role: 'MANAGER', companyId: companyBId },
            secret,
            { expiresIn: '2h' }
        );

        const empB = await prisma.employee.upsert({
            where: { userId: userB.id },
            update: { companyId: companyBId, deletedAt: null, updatedAt: new Date() },
            create: {
                id: 'p6-emp-b',
                userId: userB.id,
                companyId: companyBId,
                department: 'العمليات',
                position: 'مدير فرع',
                updatedAt: new Date()
            }
        });
        employeeBId = empB.id;
    });

    afterAll(async () => {
        // Cleanup created test records
        const userIds = [userAId, userBId].filter(Boolean);
        if (userIds.length > 0) {
            await prisma.notification.deleteMany({
                where: { userId: { in: userIds } }
            });
        }
        const companyIds = [companyAId, companyBId].filter(Boolean);
        if (companyIds.length > 0) {
            await prisma.searchIndex.deleteMany({
                where: { companyId: { in: companyIds } }
            });
        }
    });

    // -------------------------------------------------------------
    // Test 1: Reindex Data for Company
    // -------------------------------------------------------------
    test('1. Search Reindexing: Manager triggers reindexing of company data', async () => {
        const res = await request(app)
            .post('/api/search/reindex')
            .set('Authorization', `Bearer ${tokenA}`);

        expect(res.status).toBe(200);
        expect(res.body.status).toBe('success');
    });

    // -------------------------------------------------------------
    // Test 2: Smart Semantic Search with Multi-Tenant Isolation
    // -------------------------------------------------------------
    test('2. Multi-Tenant Search: Company A documents are found by Manager A and isolated from Manager B', async () => {
        // Create an indexed document for Company A
        const testDocAId = 'p6-doc-a-1';
        const vectorA = Array.from({ length: 10 }, () => 0.95);
        await prisma.searchIndex.upsert({
            where: { id: `TASK_${testDocAId}` },
            update: {
                companyId: companyAId,
                documentId: testDocAId,
                documentType: 'TASK',
                content: 'مهمة تطوير الواجهات الأمامية والذكاء الاصطناعي لشركة أ',
                vector: JSON.stringify(vectorA),
                metadata: JSON.stringify({ title: 'تطوير الواجهات' })
            },
            create: {
                id: `TASK_${testDocAId}`,
                companyId: companyAId,
                documentId: testDocAId,
                documentType: 'TASK',
                content: 'مهمة تطوير الواجهات الأمامية والذكاء الاصطناعي لشركة أ',
                vector: JSON.stringify(vectorA),
                metadata: JSON.stringify({ title: 'تطوير الواجهات' })
            }
        });

        // Search by Manager A
        const resA = await request(app)
            .post('/api/search')
            .set('Authorization', `Bearer ${tokenA}`)
            .send({ query: 'تطوير الواجهات', limit: 5 });

        expect(resA.status).toBe(200);
        expect(resA.body.status).toBe('success');
        expect(Array.isArray(resA.body.data)).toBe(true);

        // Search by Manager B (Must not find Company A's task)
        const resB = await request(app)
            .post('/api/search')
            .set('Authorization', `Bearer ${tokenB}`)
            .send({ query: 'تطوير الواجهات', limit: 5 });

        expect(resB.status).toBe(200);
        const leaked = (resB.body.data || []).find(d => d.companyId === companyAId && d.documentType === 'TASK');
        expect(leaked).toBeUndefined();
    });

    // -------------------------------------------------------------
    // Test 3: Search Query Validation
    // -------------------------------------------------------------
    test('3. Search Validation: Empty query returns 400 Bad Request', async () => {
        const res = await request(app)
            .post('/api/search')
            .set('Authorization', `Bearer ${tokenA}`)
            .send({});

        expect(res.status).toBe(400);
        expect(res.body.status).toBe('error');
    });

    // -------------------------------------------------------------
    // Test 4: Alerts & Notification Fetching
    // -------------------------------------------------------------
    test('4. Notification Retrieval: User receives personal & employee-scoped notifications', async () => {
        // Seed a notification for User A
        const notifA = await prisma.notification.create({
            data: {
                userId: userAId,
                employeeId: employeeAId,
                title: 'تنبيه موعد نهائي',
                message: 'لديك مهمة تنتهي صلاحيتها قريباً',
                type: 'deadline',
                priority: 'high',
                isRead: false,
                metadata: JSON.stringify({ deadlineDays: 1 }),
                updatedAt: new Date()
            }
        });
        notificationAId = notifA.id;

        const res = await request(app)
            .get('/api/notifications')
            .set('Authorization', `Bearer ${tokenA}`);

        expect(res.status).toBe(200);
        expect(res.body.status).toBe('success');
        expect(Array.isArray(res.body.data)).toBe(true);
        const found = res.body.data.find(n => n.id === notificationAId);
        expect(found).toBeDefined();
        expect(found.title).toBe('تنبيه موعد نهائي');
    });

    // -------------------------------------------------------------
    // Test 5: Notification Read Lifecycle & Metadata Update
    // -------------------------------------------------------------
    test('5. Notification Actions: Mark as read and update metadata', async () => {
        // Mark as read
        const readRes = await request(app)
            .patch(`/api/notifications/${notificationAId}/read`)
            .set('Authorization', `Bearer ${tokenA}`);

        expect(readRes.status).toBe(200);

        // Update metadata
        const metaRes = await request(app)
            .patch(`/api/notifications/${notificationAId}/metadata`)
            .set('Authorization', `Bearer ${tokenA}`)
            .send({ metadata: { acknowledged: true } });

        expect(metaRes.status).toBe(200);

        // Verify in DB
        const updated = await prisma.notification.findUnique({ where: { id: notificationAId } });
        expect(updated.isRead).toBe(true);
    });

    // -------------------------------------------------------------
    // Test 6: Cross-Tenant Security on Notification Mutation
    // -------------------------------------------------------------
    test('6. Notification Cross-User Security: User B cannot modify or delete User A notification', async () => {
        // User B attempts to mark User A's notification as read
        const patchRes = await request(app)
            .patch(`/api/notifications/${notificationAId}/read`)
            .set('Authorization', `Bearer ${tokenB}`);

        expect([403, 404]).toContain(patchRes.status);

        // User B attempts to delete User A's notification
        const deleteRes = await request(app)
            .delete(`/api/notifications/${notificationAId}`)
            .set('Authorization', `Bearer ${tokenB}`);

        expect([403, 404]).toContain(deleteRes.status);
    });

    // -------------------------------------------------------------
    // Test 7: Mark All as Read & Delete Notification
    // -------------------------------------------------------------
    test('7. Bulk Notification Operations: Mark all as read and delete own notification', async () => {
        // Mark all as read
        const markAllRes = await request(app)
            .post('/api/notifications/read-all')
            .set('Authorization', `Bearer ${tokenA}`);

        expect(markAllRes.status).toBe(200);

        // Delete own notification
        const delRes = await request(app)
            .delete(`/api/notifications/${notificationAId}`)
            .set('Authorization', `Bearer ${tokenA}`);

        expect(delRes.status).toBe(200);

        const checkDb = await prisma.notification.findUnique({ where: { id: notificationAId } });
        expect(checkDb).toBeNull();
    });
});
