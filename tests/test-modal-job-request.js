import assert from 'assert';
import request from 'supertest';
import app from '../src/app.js';
import pkg from '@prisma/client';
const { PrismaClient } = pkg;
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
dotenv.config();

const prisma = new PrismaClient();

const generateAuthToken = (user) => {
    return jwt.sign(
        { id: user.id, email: user.email, role: user.role, companyId: user.companyId },
        process.env.JWT_SECRET || 'secretKey',
        { expiresIn: '1h' }
    );
};

async function testModalSubmitJobRequest() {
    console.log('🧪 Testing Job Request Creation from CreateJobRequestModal.tsx payload...');

    const user = await prisma.user.findFirst({
        where: { status: 'ACTIVE', companyId: { not: null } },
        include: { company: true }
    });

    assert(user, 'Active test user must exist');
    const token = generateAuthToken(user);

    // Payload exactly as sent by CreateJobRequestModal.tsx
    const payload = {
        jobTitle: 'مطور واجهات أمامية أول (Senior Frontend Developer)',
        departmentId: 'dep-tech',
        departmentName: 'تكنولوجيا المعلومات والبرمجيات',
        department: 'تكنولوجيا المعلومات والبرمجيات',
        location: 'الرياض',
        employmentType: 'FULL_TIME',
        vacancies: 1,
        jobSummary: 'تطوير وصيانة الواجهات الأمامية باستخدام React و TypeScript',
        requiredExperience: '3-5 سنوات',
        educationLevel: 'بكالوريوس',
        certifications: '',
        languages: 'العربية، الإنجليزية',
        responsibilities: '1. بناء مكونات الواجهة\n2. تحسين الأداء',
        salaryMin: '10000',
        salaryMax: '15000',
        budgetCode: `BUD-${new Date().getFullYear()}-101`,
        costCenter: 'CC-101',
        hiringReason: 'NEW_POSITION',
        hiringType: 'IMMEDIATE',
        requiredDate: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10),
        hiringDeadline: new Date(Date.now() + 21 * 86400000).toISOString().slice(0, 10),
        priority: 'URGENT',
        skills: ['TypeScript', 'React', 'TailwindCSS'],
        submitDirectly: false
    };

    const res = await request(app)
        .post('/api/job-requests')
        .set('Authorization', `Bearer ${token}`)
        .send(payload);

    console.log('Status code:', res.status);
    console.log('Response body:', JSON.stringify(res.body, null, 2));

    assert.strictEqual(res.status, 201);
    assert(res.body.data?.id, 'Job Request ID must exist');

    console.log('✅ Job Request created successfully from Modal payload!');

    // Test with submitDirectly: true (which triggers notification + HR_REVIEW approval creation)
    const submittedPayload = {
        ...payload,
        jobTitle: 'مدير منتجات تقنية (Technical Product Manager)',
        submitDirectly: true
    };

    const resSubmitted = await request(app)
        .post('/api/job-requests')
        .set('Authorization', `Bearer ${token}`)
        .send(submittedPayload);

    console.log('Submitted Status code:', resSubmitted.status);
    console.log('Submitted Response body:', JSON.stringify(resSubmitted.body, null, 2));

    assert.strictEqual(resSubmitted.status, 201);
    assert(resSubmitted.body.data?.id, 'Submitted Job Request ID must exist');
    console.log('✅ Submitted Job Request created with direct approval workflow!');

    // Cleanup
    const ids = [res.body.data?.id, resSubmitted.body.data?.id].filter(Boolean);
    for (const id of ids) {
        await prisma.jobRequestSkill.deleteMany({ where: { jobRequestId: id } });
        await prisma.approvalRequest.deleteMany({ where: { jobRequestId: id } });
        await prisma.jobRequestHistory.deleteMany({ where: { jobRequestId: id } });
        await prisma.jobRequest.deleteMany({ where: { id } });
    }

    await prisma.$disconnect();
}

testModalSubmitJobRequest();
