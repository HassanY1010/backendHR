import request from 'supertest';
import app from '../src/app.js';
import prisma from '../src/config/db.js';
import jwt from 'jsonwebtoken';
import { CandidateStateMachine, CANDIDATE_STATUS } from '../src/services/candidateStateMachine.js';

describe('Phase 1 Verification: Analytics Real Data & Candidate State Machine', () => {
    let companyId;
    let otherCompanyId;
    let userId;
    let token;
    let otherToken;
    let jobId;
    let candidateId;

    beforeAll(async () => {
        const secret = process.env.JWT_SECRET || 'your_jwt_secret';

        // 1. Create primary company
        const comp = await prisma.company.upsert({
            where: { id: 'phase1-test-company' },
            update: {},
            create: {
                id: 'phase1-test-company',
                name: 'شركة المرحلة الأولى للاختبار',
                subscriptionStatus: 'ACTIVE',
                status: 'active'
            }
        });
        companyId = comp.id;

        // 2. Create secondary company for isolation test
        const otherComp = await prisma.company.upsert({
            where: { id: 'phase1-other-company' },
            update: {},
            create: {
                id: 'phase1-other-company',
                name: 'شركة العزل الأخرى',
                subscriptionStatus: 'ACTIVE',
                status: 'active'
            }
        });
        otherCompanyId = otherComp.id;

        // 3. Create primary manager user
        const user = await prisma.user.upsert({
            where: { email: 'phase1-manager@test.com' },
            update: {},
            create: {
                id: 'phase1-manager-user',
                email: 'phase1-manager@test.com',
                passwordHash: 'hashed_password',
                name: 'مدير المرحلة الأولى',
                role: 'MANAGER',
                status: 'ACTIVE',
                companyId
            }
        });
        userId = user.id;

        // 4. Create other manager user
        const otherUser = await prisma.user.upsert({
            where: { email: 'phase1-other-mgr@test.com' },
            update: {},
            create: {
                id: 'phase1-other-mgr-user',
                email: 'phase1-other-mgr@test.com',
                passwordHash: 'hashed_password',
                name: 'مدير شركة أخرى',
                role: 'MANAGER',
                status: 'ACTIVE',
                companyId: otherCompanyId
            }
        });

        token = jwt.sign({ id: user.id, companyId, role: 'MANAGER' }, secret, { expiresIn: '1h' });
        otherToken = jwt.sign({ id: otherUser.id, companyId: otherCompanyId, role: 'MANAGER' }, secret, { expiresIn: '1h' });

        // Clean any existing test data
        await prisma.checkInAssessment.deleteMany({
            where: { employee: { user: { companyId } } }
        });
        await prisma.trainingAssignment.deleteMany({
            where: { employee: { user: { companyId } } }
        });
        await prisma.candidateHistory.deleteMany({
            where: { candidate: { recruitmentjob: { companyId } } }
        });
        await prisma.candidate.deleteMany({
            where: { recruitmentjob: { companyId } }
        });
        await prisma.recruitmentJob.deleteMany({
            where: { companyId }
        });

        // Create a test job
        const job = await prisma.recruitmentJob.create({
            data: {
                companyId,
                title: 'مهندس برمجيات أول',
                description: 'وصف وظيفي لاختبار المرحلة الأولى',
                department: 'تقنية المعلومات',
                status: 'OPEN'
            }
        });
        jobId = job.id;

        // Create a test candidate in APPLIED status
        const candidate = await prisma.candidate.create({
            data: {
                jobId,
                fullName: 'أحمد التست الفعلي',
                email: 'ahmed.test.phase1@example.com',
                status: 'APPLIED',
                experience: 5
            }
        });
        candidateId = candidate.id;
    }, 60000);

    afterAll(async () => {
        // Clean up
        try {
            await prisma.auditLog.deleteMany({ where: { companyId } });
            await prisma.candidateHistory.deleteMany({ where: { candidate: { recruitmentjob: { companyId } } } });
            await prisma.candidate.deleteMany({ where: { recruitmentjob: { companyId } } });
            await prisma.recruitmentJob.deleteMany({ where: { companyId } });
            await prisma.checkInAssessment.deleteMany({ where: { employee: { user: { companyId } } } });
            await prisma.trainingAssignment.deleteMany({ where: { employee: { user: { companyId } } } });
            await prisma.employee.deleteMany({ where: { user: { companyId } } });
            await prisma.user.deleteMany({ where: { companyId } });
            await prisma.user.deleteMany({ where: { companyId: otherCompanyId } });
            await prisma.company.deleteMany({ where: { id: { in: [companyId, otherCompanyId] } } });
        } catch (e) {
            // Ignore cleanup error
        }
    }, 60000);

    describe('1. Analytics Real Data Verification (No Fake 82 or 12)', () => {
        test('GET /api/analytics/dashboard returns insufficientData: true and satisfaction: null when no check-ins exist', async () => {
            let res = await request(app)
                .get('/api/analytics/dashboard')
                .set('Authorization', `Bearer ${token}`);

            // Retry once if pooler connection drops on cold start
            if (res.status === 500) {
                await new Promise(r => setTimeout(r, 2000));
                res = await request(app)
                    .get('/api/analytics/dashboard')
                    .set('Authorization', `Bearer ${token}`);
            }

            expect(res.status).toBe(200);
            expect(res.body.status).toBe('success');
            const data = res.body.data;

            // Satisfaction must NOT be hardcoded 82
            expect(data.hr.satisfaction).toBeNull();
            expect(data.hr.satisfactionInsufficientData).toBe(true);
            expect(data.hr.satisfactionSampleCount).toBe(0);

            // Impact must NOT be hardcoded 12
            expect(data.training.impact).toBeNull();
            expect(data.training.impactInsufficientData).toBe(true);
            expect(data.training.impactSampleCount).toBe(0);
        });

        test('GET /api/analytics/dashboard returns authentic average when real assessments exist and respects company isolation', async () => {
            // Create an employee in company A
            const empUser = await prisma.user.create({
                data: {
                    id: 'emp-user-phase1',
                    email: 'emp-phase1@example.com',
                    passwordHash: 'hash',
                    name: 'موظف تجريبي',
                    role: 'EMPLOYEE',
                    companyId
                }
            });

            const employee = await prisma.employee.create({
                data: {
                    userId: empUser.id,
                    companyId,
                    department: 'تقنية المعلومات',
                    position: 'مطور',
                    updatedAt: new Date()
                }
            });

            // Create 2 completed checkIn assessments with scores 80 and 90 => average 85
            await prisma.checkInAssessment.createMany({
                data: [
                    {
                        employeeId: employee.id,
                        score: 80,
                        status: 'COMPLETED',
                        riskLevel: 'LOW',
                        updatedAt: new Date()
                    },
                    {
                        employeeId: employee.id,
                        score: 90,
                        status: 'COMPLETED',
                        riskLevel: 'LOW',
                        updatedAt: new Date()
                    }
                ]
            });

            // Create a course first for training assignment relation
            const course = await prisma.trainingCourse.create({
                data: {
                    title: 'دورة القيادة الهندسية',
                    description: 'دورة متقدمة في قيادة الفرق',
                    category: 'Management',
                    provider: 'Internal',
                    duration: 12
                }
            });

            // Create a training assignment with impactScore 45
            await prisma.trainingAssignment.create({
                data: {
                    employeeId: employee.id,
                    courseId: course.id,
                    status: 'COMPLETED',
                    impactScore: 45
                }
            });

            const res = await request(app)
                .get('/api/analytics/dashboard')
                .set('Authorization', `Bearer ${token}`);

            expect(res.status).toBe(200);
            expect(res.body.data.hr.satisfaction).toBe(85);
            expect(res.body.data.hr.satisfactionInsufficientData).toBe(false);
            expect(res.body.data.hr.satisfactionSampleCount).toBe(2);
            expect(res.body.data.hr.satisfactionSource).toBeTruthy();

            expect(res.body.data.training.impact).toBe(45);
            expect(res.body.data.training.impactInsufficientData).toBe(false);
            expect(res.body.data.training.impactSampleCount).toBe(1);

            // Verify company B does NOT see company A data
            const resOther = await request(app)
                .get('/api/analytics/dashboard')
                .set('Authorization', `Bearer ${otherToken}`);

            expect(resOther.status).toBe(200);
            expect(resOther.body.data.hr.satisfaction).toBeNull();
            expect(resOther.body.data.hr.satisfactionInsufficientData).toBe(true);
            expect(resOther.body.data.training.impact).toBeNull();
        });
    });

    describe('2. Candidate State Machine Unit Logic', () => {
        test('canTransition allows valid steps', () => {
            expect(CandidateStateMachine.canTransition('APPLIED', 'SCREENING')).toBe(true);
            expect(CandidateStateMachine.canTransition('SCREENING', 'SHORTLISTED')).toBe(true);
            expect(CandidateStateMachine.canTransition('SHORTLISTED', 'INTERVIEW_SCHEDULED')).toBe(true);
            expect(CandidateStateMachine.canTransition('INTERVIEW_SCHEDULED', 'INTERVIEWING')).toBe(true);
            expect(CandidateStateMachine.canTransition('INTERVIEWING', 'INTERVIEW_COMPLETED')).toBe(true);
            expect(CandidateStateMachine.canTransition('INTERVIEW_COMPLETED', 'OFFER_SENT')).toBe(true);
            expect(CandidateStateMachine.canTransition('OFFER_SENT', 'HIRED')).toBe(true);
            expect(CandidateStateMachine.canTransition('SCREENING', 'REJECTED')).toBe(true);
        });

        test('blocks forbidden transitions', () => {
            // Cannot jump from APPLIED straight to HIRED
            expect(CandidateStateMachine.canTransition('APPLIED', 'HIRED')).toBe(false);
            // Cannot transition out of HIRED
            expect(CandidateStateMachine.canTransition('HIRED', 'SCREENING')).toBe(false);
            expect(CandidateStateMachine.canTransition('HIRED', 'APPLIED')).toBe(false);
        });

        test('validateTransition throws error for HIRED candidate', () => {
            expect(() => {
                CandidateStateMachine.validateTransition('HIRED', 'SCREENING');
            }).toThrow('لا يمكن تغيير مرحلته');
        });

        test('validateTransition requires comment to reactivate REJECTED candidate', () => {
            expect(() => {
                CandidateStateMachine.validateTransition('REJECTED', 'SCREENING', { comment: '' });
            }).toThrow('إعادة تنشيط مرشح مستبعد تتطلب كتابة سبب أو ملاحظة توضيحية');

            // With sufficient comment, it should succeed
            expect(
                CandidateStateMachine.validateTransition('REJECTED', 'SCREENING', { comment: 'تم إعادة التقييم بعد تحديث الخبرات' })
            ).toBe(true);
        });
    });

    describe('3. Candidate State Machine API & Audit Trail Verification', () => {
        test('PUT /api/candidates/:id/status allows valid forward transition and creates AuditLog', async () => {
            const res = await request(app)
                .put(`/api/candidates/${candidateId}/status`)
                .set('Authorization', `Bearer ${token}`)
                .send({
                    status: 'SCREENING',
                    comment: 'تم الانتقال إلى الفرز الأولي'
                });

            expect(res.status).toBe(200);
            expect(res.body.status).toBe('success');
            expect(res.body.data.status).toBe('SCREENING');

            // Verify AuditLog was recorded in database
            const audit = await prisma.auditLog.findFirst({
                where: {
                    companyId,
                    action: 'CANDIDATE_STATUS_CHANGED',
                    target: candidateId
                },
                orderBy: { timestamp: 'desc' }
            });
            expect(audit).toBeTruthy();
            expect(audit.actionType).toBe('ATS_PIPELINE');
        });

        test('PUT /api/candidates/:id/status rejects invalid transition (SCREENING -> HIRED) with 400', async () => {
            const res = await request(app)
                .put(`/api/candidates/${candidateId}/status`)
                .set('Authorization', `Bearer ${token}`)
                .send({
                    status: 'HIRED',
                    comment: 'محاولة تخطي المراحل مباشرة للتوظيف'
                });

            expect(res.status).toBe(400);
            expect(res.body.status).toBe('error');
            expect(res.body.message).toContain('انتقال غير مسموح به في مسار المرشح');
        });

        test('PUT /api/candidates/:id/status rejects cross-company candidate modification with 404', async () => {
            const res = await request(app)
                .put(`/api/candidates/${candidateId}/status`)
                .set('Authorization', `Bearer ${otherToken}`)
                .send({
                    status: 'SHORTLISTED',
                    comment: 'محاولة تعديل مرشح شركة أخرى'
                });

            expect(res.status).toBe(404);
            expect(res.body.status).toBe('error');
            expect(res.body.message).toContain('غير موجود أو لا تملك صلاحية الوصول إليه');
        });

        test('PUT /api/recruitment/candidates/:id also enforces Candidate State Machine and company isolation', async () => {
            // 1. Valid step from SCREENING -> SHORTLISTED
            const resValid = await request(app)
                .put(`/api/recruitment/candidates/${candidateId}`)
                .set('Authorization', `Bearer ${token}`)
                .send({
                    status: 'SHORTLISTED',
                    comment: 'تم الفرز للقائمة المختصرة عبر مسار recruitment'
                });

            expect(resValid.status).toBe(200);
            expect(resValid.body.status).toBe('success');
            expect(resValid.body.data.candidate.status).toBe('SHORTLISTED');

            // 2. Invalid jump from SHORTLISTED -> HIRED
            const resInvalid = await request(app)
                .put(`/api/recruitment/candidates/${candidateId}`)
                .set('Authorization', `Bearer ${token}`)
                .send({
                    status: 'HIRED',
                    comment: 'محاولة توظيف مباشرة غير شرعية'
                });

            expect(resInvalid.status).toBe(400);
            expect(resInvalid.body.status).toBe('error');
            expect(resInvalid.body.message).toContain('انتقال غير مسموح به في مسار المرشح');

            // 3. Cross company access rejection
            const resCross = await request(app)
                .put(`/api/recruitment/candidates/${candidateId}`)
                .set('Authorization', `Bearer ${otherToken}`)
                .send({
                    status: 'INTERVIEW_SCHEDULED'
                });

            expect(resCross.status).toBe(404);
            expect(resCross.body.status).toBe('error');
        });

        test('AuditLog does NOT record phantom entries if status update fails', async () => {
            const countBefore = await prisma.auditLog.count({
                where: { companyId, target: candidateId }
            });

            // Attempt an illegal transition that fails
            const res = await request(app)
                .put(`/api/candidates/${candidateId}/status`)
                .set('Authorization', `Bearer ${token}`)
                .send({
                    status: 'HIRED',
                    comment: 'عملية يجب أن تفشل ولا تسجل لوج'
                });

            expect(res.status).toBe(400);

            const countAfter = await prisma.auditLog.count({
                where: { companyId, target: candidateId }
            });

            expect(countAfter).toBe(countBefore);
        });
    });
});
