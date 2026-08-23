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

async function testAIJDCreateJobRequest() {
    console.log('🧪 Testing Job Request Creation from AI Job Description Page...');

    const user = await prisma.user.findFirst({
        where: { status: 'ACTIVE', companyId: { not: null } },
        include: { company: true }
    });

    assert(user, 'Active test user must exist');
    const token = generateAuthToken(user);

    // Payload exactly matching AIJobDescriptionPage.tsx
    const payload = {
        jobTitle: 'مهندس برمجيات ذكاء اصطناعي (AI Software Engineer)',
        department: 'تكنولوجيا المعلومات والبرمجيات',
        departmentName: 'تكنولوجيا المعلومات والبرمجيات',
        location: 'الرياض',
        employmentType: 'FULL_TIME',
        vacancies: 2,
        jobSummary: 'تصميم وبناء الأنظمة الذكية والحلول السحابية',
        requiredExperience: '3-5 سنوات',
        educationLevel: 'بكالوريوس في علوم الحاسب',
        responsibilities: '1. تطوير الواجهات الخلفية\n2. تدريب النماذج',
        skills: ['TypeScript', 'Node.js', 'Python', 'Docker'],
        salaryMin: '12000',
        salaryMax: '18000',
        budgetCode: `BUD-${new Date().getFullYear()}-8888`,
        costCenter: 'CC-101',
        hiringType: 'IMMEDIATE',
        requiredDate: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10),
        hiringDeadline: new Date(Date.now() + 21 * 86400000).toISOString().slice(0, 10),
        priority: 'MEDIUM',
        hiringReason: 'NEW_POSITION',
        submitDirectly: true
    };

    const res = await request(app)
        .post('/api/job-requests')
        .set('Authorization', `Bearer ${token}`)
        .send(payload);

    console.log('Status code:', res.status);
    console.log('Response body status:', res.body.status || res.body.message);
    console.log('Created Job Request ID:', res.body.data?.id || res.body.data?.requestId);

    assert.strictEqual(res.status, 201);
    assert(res.body.data?.id, 'Job Request ID must exist');

    console.log('✅ Job Request created successfully with 201 Created!');

    // Cleanup
    if (res.body.data?.id) {
        await prisma.jobRequestSkill.deleteMany({ where: { jobRequestId: res.body.data.id } });
        await prisma.jobRequestApproval.deleteMany({ where: { jobRequestId: res.body.data.id } });
        await prisma.jobRequestHistory.deleteMany({ where: { jobRequestId: res.body.data.id } });
        await prisma.jobRequest.deleteMany({ where: { id: res.body.data.id } });
    }

    await prisma.$disconnect();
}

testAIJDCreateJobRequest();
