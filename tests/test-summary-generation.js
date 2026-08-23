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

async function testGenerateSummary() {
    console.log('🧪 Testing /api/ai-jd/generate-summary with dynamic AI generation...');

    const user = await prisma.user.findFirst({
        where: { status: 'ACTIVE', companyId: { not: null } },
        include: { company: true }
    });

    assert(user, 'An active user in DB must exist for testing');
    console.log(`Using active test user: ${user.email} (${user.company.name})`);

    const token = generateAuthToken(user);

    const testPayload = {
        jobTitle: 'مهندس ذكاء اصطناعي أول (Senior AI Engineer)',
        department: 'إدارة الذكاء الاصطناعي والبيانات',
        location: 'الرياض، السعودية',
        requiredExperience: '5-7 سنوات',
        educationLevel: 'ماجستير في الذكاء الاصطناعي أو علوم الحاسب',
        skills: ['Python', 'PyTorch', 'LLMs & RAG', 'PostgreSQL', 'Docker'],
        hiringReason: 'بناء وتطوير نماذج الذكاء الاصطناعي للمنصة'
    };

    const res = await request(app)
        .post('/api/ai-jd/generate-summary')
        .set('Authorization', `Bearer ${token}`)
        .send(testPayload);

    console.log('Status code:', res.status);
    console.log('Response body:', JSON.stringify(res.body, null, 2));

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.status, 'success');
    assert(res.body.summary, 'Summary must exist');
    assert(res.body.summary.length > 50, 'Summary must be substantive and professional');
    assert(
        res.body.summary.includes('مهندس') || 
        res.body.summary.includes('الذكاء الاصطناعي') ||
        res.body.summary.includes('البيانات'),
        'Summary must be tailored to the job title and department'
    );

    console.log('\n=============================================================');
    console.log('🏆 AI SUMMARY OUTPUT GENERATED:');
    console.log(res.body.summary);
    console.log('=============================================================\n');
    console.log('✅ /api/ai-jd/generate-summary generated professional job summary successfully!');

    await prisma.$disconnect();
}

testGenerateSummary();
