import assert from 'assert';
import request from 'supertest';
import app from '../src/app.js';
import pkg from '@prisma/client';
const { PrismaClient } = pkg;
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
dotenv.config();

const prisma = new PrismaClient();

const generateAuthToken = (user) => {
    return jwt.sign(
        { id: user.id, email: user.email, role: user.role, companyId: user.companyId },
        process.env.JWT_SECRET || 'secretKey',
        { expiresIn: '1h' }
    );
};

async function testUploadCV() {
    console.log('🧪 Testing POST /api/candidates/upload-cv...');

    const user = await prisma.user.findFirst({
        where: { status: 'ACTIVE', companyId: { not: null } },
        include: { company: true }
    });

    assert(user, 'Active test user must exist');
    const token = generateAuthToken(user);

    // Create a temporary sample PDF file
    const samplePdfPath = path.join(process.cwd(), 'sample_test_cv.pdf');
    // Minimal valid PDF header and content
    const minimalPdfBuffer = Buffer.from(
        '%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R >>\nendobj\n4 0 obj\n<< /Length 55 >>\nstream\nBT /F1 12 Tf 100 700 Td (John Doe - Senior Software Engineer) Tj ET\nendstream\nendobj\nxref\n0 5\n0000000000 65535 f \n0000000009 00000 n \n0000000058 00000 n \n0000000115 00000 n \n0000000214 00000 n \ntrailer\n<< /Size 5 /Root 1 0 R >>\nstartxref\n320\n%%EOF'
    );
    fs.writeFileSync(samplePdfPath, minimalPdfBuffer);

    try {
        const res = await request(app)
            .post('/api/candidates/upload-cv')
            .set('Authorization', `Bearer ${token}`)
            .attach('cv', samplePdfPath);

        console.log('Status code:', res.status);
        console.log('Response body status:', res.body.status);
        console.log('Created candidate:', res.body.data?.fullName, 'ID:', res.body.data?.id);

        assert.strictEqual(res.status, 200);
        assert.strictEqual(res.body.status, 'success');
        assert(res.body.data?.id, 'Candidate ID must be returned');

        console.log('✅ POST /api/candidates/upload-cv succeeded with 200 OK!');

        // Clean up created candidate
        if (res.body.data?.id) {
            await prisma.candidateHistory.deleteMany({ where: { candidateId: res.body.data.id } });
            await prisma.candidateSkill.deleteMany({ where: { candidateId: res.body.data.id } });
            await prisma.candidate.deleteMany({ where: { id: res.body.data.id } });
        }
    } finally {
        if (fs.existsSync(samplePdfPath)) {
            fs.unlinkSync(samplePdfPath);
        }
        await prisma.$disconnect();
    }
}

testUploadCV();
