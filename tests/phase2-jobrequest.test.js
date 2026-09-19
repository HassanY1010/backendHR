import request from 'supertest';
import app from '../src/app.js';
import prisma from '../src/config/db.js';
import jwt from 'jsonwebtoken';

describe('Phase 2 Integration & Deep Technical Verification', () => {
    let companyId;
    let otherCompanyId;
    let userId;
    let token;
    let otherToken;
    let departmentId;
    let otherDepartmentId;
    let createdJobRequestId;

    beforeAll(async () => {
        const secret = process.env.JWT_SECRET || 'your_jwt_secret';

        // 1. Primary test company
        const comp = await prisma.company.upsert({
            where: { id: 'phase2-test-company' },
            update: {},
            create: {
                id: 'phase2-test-company',
                name: 'شركة المرحلة الثانية للاختبار',
                subscriptionStatus: 'ACTIVE',
                status: 'active'
            }
        });
        companyId = comp.id;

        // 2. Isolation test company
        const otherComp = await prisma.company.upsert({
            where: { id: 'phase2-other-company' },
            update: {},
            create: {
                id: 'phase2-other-company',
                name: 'شركة العزل للاختبار',
                subscriptionStatus: 'ACTIVE',
                status: 'active'
            }
        });
        otherCompanyId = otherComp.id;

        // 3. User for primary company
        const user = await prisma.user.upsert({
            where: { email: 'phase2-manager@test.com' },
            update: {},
            create: {
                id: 'phase2-manager-user',
                email: 'phase2-manager@test.com',
                passwordHash: 'hashed_password',
                name: 'مدير التوظيف المرحلة الثانية',
                role: 'MANAGER',
                status: 'ACTIVE',
                companyId
            }
        });
        userId = user.id;

        // 4. Other user
        const otherUser = await prisma.user.upsert({
            where: { email: 'phase2-other-manager@test.com' },
            update: {},
            create: {
                id: 'phase2-other-user',
                email: 'phase2-other-manager@test.com',
                passwordHash: 'hashed_password',
                name: 'مدير شركة أخرى',
                role: 'MANAGER',
                status: 'ACTIVE',
                companyId: otherCompanyId
            }
        });

        // 5. Primary Test Department
        const dep = await prisma.department.upsert({
            where: { id: 'phase2-test-dept' },
            update: {},
            create: {
                id: 'phase2-test-dept',
                name: 'إدارة هندسة البرمجيات',
                companyId
            }
        });
        departmentId = dep.id;

        // 6. Other Company Department
        const otherDep = await prisma.department.upsert({
            where: { id: 'phase2-other-dept' },
            update: {},
            create: {
                id: 'phase2-other-dept',
                name: 'إدارة التسويق لشركة أخرى',
                companyId: otherCompanyId
            }
        });
        otherDepartmentId = otherDep.id;

        token = jwt.sign({ id: userId, email: user.email, role: 'MANAGER', companyId }, secret, { expiresIn: '1h' });
        otherToken = jwt.sign({ id: otherUser.id, email: otherUser.email, role: 'MANAGER', companyId: otherCompanyId }, secret, { expiresIn: '1h' });
    });

    afterAll(async () => {
        try {
            await prisma.auditLog.deleteMany({ where: { companyId: { in: [companyId, otherCompanyId] } } });
            await prisma.recruitmentJob.deleteMany({ where: { companyId: { in: [companyId, otherCompanyId] } } });
            await prisma.jobRequest.deleteMany({ where: { companyId: { in: [companyId, otherCompanyId] } } });
            await prisma.department.deleteMany({ where: { id: { in: [departmentId, otherDepartmentId] } } });
            await prisma.user.deleteMany({ where: { id: { in: [userId, 'phase2-other-user'] } } });
            await prisma.company.deleteMany({ where: { id: { in: [companyId, otherCompanyId] } } });
        } catch (e) {
            // Ignore cleanup errors
        }
    });

    // 1. Field-level validation: multiple invalid fields returned together
    test('1. Field-level validation: Multiple invalid fields return 400 with structured fieldErrors', async () => {
        const res = await request(app)
            .post('/api/job-requests')
            .set('Authorization', `Bearer ${token}`)
            .send({
                jobTitle: '',
                departmentId: '',
                vacancies: 0,
                salaryMin: 30000,
                salaryMax: 20000
            });

        expect(res.status).toBe(400);
        expect(res.body.fieldErrors).toBeDefined();
        expect(res.body.fieldErrors.jobTitle).toBeDefined();
        expect(res.body.fieldErrors.departmentId).toBeDefined();
        expect(res.body.fieldErrors.vacancies).toBeDefined();
        expect(res.body.fieldErrors.salaryMin).toBeDefined();
    });

    // 2. Happy Path - Create Job Request
    test('2. Happy Path: Create Job Request returns 201 and sets initial status to SUBMITTED', async () => {
        const idempotencyKey = `idem-create-${Date.now()}`;
        const res = await request(app)
            .post('/api/job-requests')
            .set('Authorization', `Bearer ${token}`)
            .set('Idempotency-Key', idempotencyKey)
            .send({
                jobTitle: 'مهندس بنية تحتية أول',
                departmentId,
                departmentName: 'إدارة هندسة البرمجيات',
                location: 'الرياض',
                employmentType: 'FULL_TIME',
                vacancies: 2,
                jobSummary: 'إدارة وتصميم البنية السحابية للشركة',
                requiredExperience: '5 سنوات',
                educationLevel: 'بكالوريوس',
                hiringType: 'IMMEDIATE',
                requiredDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
                hiringDeadline: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
                skills: ['AWS', 'Kubernetes', 'Terraform'],
                submitDirectly: true
            });

        expect(res.status).toBe(201);
        expect(res.body.data).toBeDefined();
        expect(res.body.data.id).toBeDefined();
        expect(res.body.data.status).toBe('SUBMITTED');
        expect(res.body.data.companyId).toBe(companyId);

        createdJobRequestId = res.body.data.id;
    });

    // 3. Idempotency: Same key + same payload
    test('3. Idempotency: Repeating request with identical key & payload returns cached 200 without duplicate row', async () => {
        const idempotencyKey = `idem-repeat-${Date.now()}`;
        const payload = {
            jobTitle: 'مطور واجهات أمامية أول',
            departmentId,
            departmentName: 'إدارة هندسة البرمجيات',
            submitDirectly: false
        };

        const res1 = await request(app)
            .post('/api/job-requests')
            .set('Authorization', `Bearer ${token}`)
            .set('Idempotency-Key', idempotencyKey)
            .send(payload);

        expect(res1.status).toBe(201);
        const firstId = res1.body.data.id;

        const res2 = await request(app)
            .post('/api/job-requests')
            .set('Authorization', `Bearer ${token}`)
            .set('Idempotency-Key', idempotencyKey)
            .send(payload);

        expect(res2.status).toBe(200);
        expect(res2.body.data.id).toBe(firstId);

        const count = await prisma.jobRequest.count({ where: { id: firstId } });
        expect(count).toBe(1);
    });

    // 4. Idempotency Security: Same key + different payload returns 409 Conflict
    test('4. Idempotency Conflict: Reusing same Idempotency-Key with different payload returns 409 Conflict', async () => {
        const sharedKey = `idem-tamper-${Date.now()}`;

        const res1 = await request(app)
            .post('/api/job-requests')
            .set('Authorization', `Bearer ${token}`)
            .set('Idempotency-Key', sharedKey)
            .send({
                jobTitle: 'محلل بيانات',
                departmentId,
                departmentName: 'إدارة هندسة البرمجيات'
            });

        expect(res1.status).toBe(201);

        // Call with altered payload
        const res2 = await request(app)
            .post('/api/job-requests')
            .set('Authorization', `Bearer ${token}`)
            .set('Idempotency-Key', sharedKey)
            .send({
                jobTitle: 'مدير منتجات رقمية (Altered)',
                departmentId,
                departmentName: 'إدارة هندسة البرمجيات'
            });

        expect(res2.status).toBe(409);
        expect(res2.body.code).toBe('IDEMPOTENCY_PAYLOAD_MISMATCH');
    });

    // 5. Concurrency: Two truly simultaneous creation requests with same key
    test('5. Concurrency: Two simultaneous create requests do not create duplicate records', async () => {
        const concurrentKey = `idem-concurrent-${Date.now()}`;
        const payload = {
            jobTitle: 'مهندس أمن سيبراني',
            departmentId,
            departmentName: 'إدارة هندسة البرمجيات',
            submitDirectly: false
        };

        const [r1, r2] = await Promise.all([
            request(app)
                .post('/api/job-requests')
                .set('Authorization', `Bearer ${token}`)
                .set('Idempotency-Key', concurrentKey)
                .send(payload),
            request(app)
                .post('/api/job-requests')
                .set('Authorization', `Bearer ${token}`)
                .set('Idempotency-Key', concurrentKey)
                .send(payload)
        ]);

        const statuses = [r1.status, r2.status];
        // One must succeed (201), the other must be either 200 (replay) or 409 (lock conflict)
        expect(statuses).toContain(201);
        expect([200, 409]).toContain(statuses.find(s => s !== 201) || 200);

        const count = await prisma.jobRequest.count({
            where: { companyId, jobTitle: 'مهندس أمن سيبراني', deletedAt: null }
        });
        expect(count).toBe(1);
    });

    // 6. State Machine: Prevent conversion if not APPROVED
    test('6. State Machine Guard: Converting non-APPROVED Job Request fails with 400', async () => {
        // createdJobRequestId is still in SUBMITTED status
        const res = await request(app)
            .post(`/api/job-requests/${createdJobRequestId}/convert-to-job`)
            .set('Authorization', `Bearer ${token}`)
            .send();

        expect(res.status).toBe(400);
        expect(res.body.error).toContain('APPROVED');
    });

    // 7. State Machine Transition & Atomic Conversion
    test('7. State Machine Transition: Approve and convert to RecruitmentJob atomically', async () => {
        await prisma.jobRequest.update({
            where: { id: createdJobRequestId },
            data: { status: 'APPROVED' }
        });

        const res = await request(app)
            .post(`/api/job-requests/${createdJobRequestId}/convert-to-job`)
            .set('Authorization', `Bearer ${token}`)
            .send({
                salaryMin: 18000,
                salaryMax: 25000
            });

        expect(res.status).toBe(201);
        expect(res.body.success).toBe(true);
        expect(res.body.data.vacancy).toBeDefined();
        expect(res.body.data.jobRequest.status).toBe('RECRUITMENT_STARTED');

        const vacancy = await prisma.recruitmentJob.findUnique({
            where: { id: res.body.data.vacancy.id }
        });
        expect(vacancy).toBeDefined();
        expect(vacancy.companyId).toBe(companyId);
        expect(vacancy.title).toBe('مهندس بنية تحتية أول');
        expect(vacancy.status).toBe('OPEN');
    });

    // 8. Duplicate Conversion & Idempotent Replay
    test('8. Duplicate Conversion: Re-invoking conversion returns 200 with existing vacancy without duplicate rows', async () => {
        const res = await request(app)
            .post(`/api/job-requests/${createdJobRequestId}/convert-to-job`)
            .set('Authorization', `Bearer ${token}`)
            .send();

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.data.vacancy).toBeDefined();

        const vacancies = await prisma.recruitmentJob.findMany({
            where: {
                companyId,
                departmentId,
                title: 'مهندس بنية تحتية أول',
                deletedAt: null
            }
        });
        expect(vacancies.length).toBe(1);
    });

    // 9. Simultaneous Concurrent Conversion
    test('9. Simultaneous Concurrent Conversion: Race on conversion handled safely without duplicate vacancies', async () => {
        // Create another approved job request to test concurrent conversion
        const tempReq = await prisma.jobRequest.create({
            data: {
                requestId: `JR-CONC-${Date.now()}`,
                companyId,
                createdBy: userId,
                jobTitle: 'مهندس موثوقية المواقع (SRE)',
                departmentId,
                location: 'الرياض',
                status: 'APPROVED'
            }
        });

        const [r1, r2] = await Promise.all([
            request(app)
                .post(`/api/job-requests/${tempReq.id}/convert-to-job`)
                .set('Authorization', `Bearer ${token}`)
                .send(),
            request(app)
                .post(`/api/job-requests/${tempReq.id}/convert-to-job`)
                .set('Authorization', `Bearer ${token}`)
                .send()
        ]);

        const statuses = [r1.status, r2.status];
        expect(statuses).toContain(201);
        expect([200, 201, 409]).toContain(statuses[1]);

        const vacancies = await prisma.recruitmentJob.findMany({
            where: {
                companyId,
                departmentId,
                title: 'مهندس موثوقية المواقع (SRE)',
                deletedAt: null
            }
        });
        expect(vacancies.length).toBe(1);
    });

    // 10. Direct Vacancy Creation: Draft (ON_HOLD) vs Publish (OPEN) validation
    test('10. Vacancy Pathways: Draft maps to ON_HOLD, Publish maps to OPEN and requires description directly on API', async () => {
        // 10a: Draft without description is allowed
        const draftRes = await request(app)
            .post('/api/recruitment/jobs')
            .set('Authorization', `Bearer ${token}`)
            .send({
                title: 'مسودة شاغر تجريبي',
                departmentId,
                status: 'draft',
                description: ''
            });

        expect(draftRes.status).toBe(201);
        expect(draftRes.body.data.job.status).toBe('ON_HOLD');

        // 10b: Publish without description fails directly on API
        const pubFailRes = await request(app)
            .post('/api/recruitment/jobs')
            .set('Authorization', `Bearer ${token}`)
            .send({
                title: 'شاغر بدون وصف مباشر',
                departmentId,
                status: 'published',
                description: '   '
            });

        expect(pubFailRes.status).toBe(400);

        // 10c: Publish with description succeeds
        const pubSuccessRes = await request(app)
            .post('/api/recruitment/jobs')
            .set('Authorization', `Bearer ${token}`)
            .send({
                title: 'شاغر متكامل النشر',
                departmentId,
                status: 'published',
                description: 'وصف تفصيلي للشاغر المعلن'
            });

        expect(pubSuccessRes.status).toBe(201);
        expect(pubSuccessRes.body.data.job.status).toBe('OPEN');
    });

    // 11. Multi-tenant Isolation: Company B cannot read, convert, update or delete Company A data
    test('11. Multi-tenant Isolation: Company B cannot access or modify Company A records', async () => {
        // Attempt convert by other company
        const convertRes = await request(app)
            .post(`/api/job-requests/${createdJobRequestId}/convert-to-job`)
            .set('Authorization', `Bearer ${otherToken}`)
            .send();

        expect([403, 404]).toContain(convertRes.status);

        // Attempt get job request by other company
        const getRes = await request(app)
            .get(`/api/job-requests/${createdJobRequestId}`)
            .set('Authorization', `Bearer ${otherToken}`);

        expect([403, 404]).toContain(getRes.status);

        // Attempt get departments returns only own company departments
        const depRes = await request(app)
            .get('/api/recruitment/departments')
            .set('Authorization', `Bearer ${token}`);

        expect(depRes.status).toBe(200);
        const depList = depRes.body.data.departments;
        expect(depList.some(d => d.id === departmentId)).toBe(true);
        expect(depList.some(d => d.id === otherDepartmentId)).toBe(false);
    });
});
