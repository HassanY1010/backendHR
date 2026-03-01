import { jest } from '@jest/globals';

// 1. Setup Environment
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret';
process.env.RESEND_API_KEY = 'test-key';

// 2. Mocks (Must be at the top for ESM)
jest.unstable_mockModule('../src/ai/ai-service.js', () => ({
    aiService: {
        evaluateInterview: jest.fn().mockResolvedValue({
            score: 85,
            strengths: ['Communication', 'Positive Attitude'],
            weaknesses: ['Technical Depth'],
            decision: 'HIRE',
            summary: 'Excellent candidate with great potential.'
        }),
        generateInterviewQuestions: jest.fn().mockResolvedValue([
            'What are your strengths?',
            'Tell us about a challenge you faced.',
            'Where do you see yourself in 5 years?'
        ])
    }
}));

jest.unstable_mockModule('../src/services/email.service.js', () => ({
    emailService: {
        sendInterviewInvitation: jest.fn().mockResolvedValue({ status: 'success' })
    }
}));

// 3. Dynamic Imports after mocks
const { default: request } = await import('supertest');
const { default: app } = await import('../src/app.js');
const { default: prisma } = await import('../src/config/db.js');

describe('Recruitment Flow Integration', () => {
    let testJob;
    let testCandidate;
    let testToken;

    beforeAll(async () => {
        // Cleanup any previous test data with same name to avoid collisions
        await prisma.company.deleteMany({ where: { name: 'Test Recruitment Co' } });

        // Setup: Create a test company and job
        const company = await prisma.company.create({
            data: {
                name: 'Test Recruitment Co',
                updatedAt: new Date()
            }
        });

        testJob = await prisma.recruitmentJob.create({
            data: {
                companyId: company.id,
                title: 'Test Software Engineer',
                description: 'A test job description for integration testing',
                status: 'OPEN'
            }
        });
    });

    afterAll(async () => {
        // Cleanup everything related to testJob
        if (testJob) {
            const companyId = testJob.companyId;
            // First delete interviews then candidates due to foreign keys
            await prisma.interview.deleteMany({ where: { jobId: testJob.id } });
            await prisma.candidate.deleteMany({ where: { jobId: testJob.id } });
            await prisma.recruitmentJob.deleteMany({ where: { companyId } });
            await prisma.company.deleteMany({ where: { id: companyId } });
        }
        await prisma.$disconnect();
    });

    test('Full Recruitment Cycle: Application -> Token -> Submission -> AI', async () => {
        // 1. Create Candidate
        const candRes = await request(app)
            .post('/api/recruitment/candidates')
            .send({
                fullName: 'Job Applicant',
                email: 'applicant@test.com',
                jobId: testJob.id
            });

        expect(candRes.status).toBe(201);
        testCandidate = candRes.body.data.candidate;
        expect(testCandidate.fullName).toBe('Job Applicant');

        // 2. Schedule Interview (Generates Token)
        const schedRes = await request(app)
            .post('/api/recruitment/interviews/schedule')
            .send({
                candidateId: testCandidate.id,
                type: 'VIDEO',
                notes: 'Test Session Integration'
            });

        expect(schedRes.status).toBe(201);
        testToken = schedRes.body.data.interview.token;
        expect(testToken).toBeDefined();

        // 3. Verify Interview by Token
        const verifyRes = await request(app)
            .get(`/api/recruitment/interviews/token/${testToken}`);

        expect(verifyRes.status).toBe(200);
        expect(verifyRes.body.data.candidate.id).toBe(testCandidate.id);

        // 4. Submit Interview Answers (with Token)
        const submitRes = await request(app)
            .post('/api/recruitment/interviews/submit')
            .send({
                candidateId: testCandidate.id,
                token: testToken,
                videoUrl: 'https://supabase.gl/test-recording.mp4',
                notes: 'Q1: My experience... Q2: My skills... Q3: Why this role...'
            });

        expect(submitRes.status).toBe(200);
        expect(submitRes.body.data.interview.status).toBe('completed');

        // 5. Verify Candidate Status & AI Results in DB
        const finalCandRes = await prisma.candidate.findUnique({
            where: { id: testCandidate.id }
        });

        expect(finalCandRes.status).toBe('INTERVIEW_COMPLETED');
        expect(finalCandRes.aiScore).toBeGreaterThanOrEqual(0);
        expect(finalCandRes.aiSummary).toBeDefined();
    });

    test('Security: Prevent Multi-Submission for same Token', async () => {
        const repeatRes = await request(app)
            .post('/api/recruitment/interviews/submit')
            .send({
                candidateId: testCandidate.id,
                token: testToken,
                videoUrl: 'https://supabase.gl/hack.mp4'
            });

        expect(repeatRes.status).toBe(400);
        expect(repeatRes.body.message).toContain('مسبقاً');
    });

    test('Security: Root Route Health Check', async () => {
        const res = await request(app).get('/health');
        expect(res.status).toBe(200);
    });
});
