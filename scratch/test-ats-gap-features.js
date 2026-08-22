import dotenv from 'dotenv';
dotenv.config();
import prisma from '../src/config/db.js';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import app from '../src/app.js';

const JWT_SECRET = process.env.JWT_SECRET || 'secret';
const testResults = [];

function recordTest(category, testName, expected, actual, pass, evidence = '') {
    testResults.push({ category, testName, expected, actual, status: pass ? 'PASS' : 'FAIL', evidence });
    console.log(`[${pass ? 'PASS' : 'FAIL'}] [${category}] ${testName} ${evidence ? `-> ${evidence}` : ''}`);
}

async function runGapFeatureTests() {
    console.log('\n======================================================');
    console.log('🧪 RUNNING ATS GAP FEATURE TESTS (Applications, Notes, Updates)');
    console.log('======================================================\n');

    let connected = false;
    for (let retry = 1; retry <= 5; retry++) {
        try {
            await prisma.$queryRaw`SELECT 1`;
            connected = true;
            break;
        } catch (e) {
            await new Promise(r => setTimeout(r, 2000));
        }
    }
    if (!connected) throw new Error('Database connection failed.');

    const uniqueSuffix = Date.now();
    let comp, user, token, job1, job2, candidate;

    try {
        comp = await prisma.company.create({ data: { name: `ATS Gap Test ${uniqueSuffix}`, status: 'ACTIVE', updatedAt: new Date() } });
        user = await prisma.user.create({
            data: {
                name: 'HR Lead',
                email: `hrgap_${uniqueSuffix}@company.com`,
                passwordHash: '$2b$10$ep/C/mE7b9h8H9JbH/rVDezB7fE2zK2U1qY0wO6E1Z.l8b6R5N0G2',
                role: 'HR_MANAGER',
                companyId: comp.id
            }
        });
        token = jwt.sign({ id: user.id, email: user.email, role: user.role, companyId: comp.id }, JWT_SECRET);

        job1 = await prisma.recruitmentJob.create({
            data: { companyId: comp.id, title: 'Fullstack Dev', description: 'Web dev', department: 'IT', location: 'الرياض', status: 'OPEN' }
        });
        job2 = await prisma.recruitmentJob.create({
            data: { companyId: comp.id, title: 'DevOps Engineer', description: 'Cloud ops', department: 'IT', location: 'الرياض', status: 'OPEN' }
        });

        // 1. Create Candidate with Extended Attributes (salary, availability)
        const createRes = await request(app)
            .post('/api/candidates')
            .set('Authorization', `Bearer ${token}`)
            .send({
                jobId: job1.id,
                fullName: 'فهد العصيمي',
                email: `fahad_${uniqueSuffix}@ex.com`,
                phone: '+966555111222',
                location: 'الرياض',
                nationality: 'سعودي',
                currentTitle: 'Senior Dev',
                yearsOfExperience: 7,
                salaryExpectation: 25000,
                availability: 'Immediate',
                skills: ['Node.js', 'React', 'Docker']
            });
        candidate = createRes.body.data;
        recordTest('Candidate Profile', 'Create candidate with extended salary & availability', 201, createRes.status, createRes.status === 201);

        // 2. Update Candidate Information via PUT /:id
        const updateRes = await request(app)
            .put(`/api/candidates/${candidate.id}`)
            .set('Authorization', `Bearer ${token}`)
            .send({
                currentTitle: 'Lead Fullstack Architect',
                salaryExpectation: 28000,
                availability: '2 Weeks Notice'
            });
        const passUpdate = updateRes.status === 200 && updateRes.body.data.currentTitle === 'Lead Fullstack Architect';
        recordTest('Candidate Profile', 'Update candidate professional information via PUT /:id', true, passUpdate, passUpdate);

        // 3. Candidate Notes System (Add, List, Delete)
        const addNoteRes = await request(app)
            .post(`/api/candidates/${candidate.id}/notes`)
            .set('Authorization', `Bearer ${token}`)
            .send({ content: 'المرشح ممتاز في المقابلة التقنية، ينصح بالانتقال لمرحلة العرض الوظيفي.' });
        const note = addNoteRes.body.data;
        recordTest('Candidate Notes', 'Add internal HR note for candidate', 201, addNoteRes.status, addNoteRes.status === 201);

        const listNotesRes = await request(app)
            .get(`/api/candidates/${candidate.id}/notes`)
            .set('Authorization', `Bearer ${token}`);
        recordTest('Candidate Notes', 'Retrieve candidate notes list', 200, listNotesRes.status, listNotesRes.status === 200 && listNotesRes.body.count >= 1);

        const deleteNoteRes = await request(app)
            .delete(`/api/candidates/${candidate.id}/notes/${note.id}`)
            .set('Authorization', `Bearer ${token}`);
        recordTest('Candidate Notes', 'Delete candidate note', 200, deleteNoteRes.status, deleteNoteRes.status === 200);

        // 4. Multi-Job Applications (Candidate applying to Job 1 and Job 2 separately)
        const app1Res = await request(app)
            .post(`/api/candidates/${candidate.id}/applications`)
            .set('Authorization', `Bearer ${token}`)
            .send({ jobId: job1.id, status: 'INTERVIEWING' });
        recordTest('Multi-Job Applications', 'Apply candidate to Job 1 with status INTERVIEWING', 201, app1Res.status, app1Res.status === 201);

        const app2Res = await request(app)
            .post(`/api/candidates/${candidate.id}/applications`)
            .set('Authorization', `Bearer ${token}`)
            .send({ jobId: job2.id, status: 'SCREENING' });
        recordTest('Multi-Job Applications', 'Apply candidate to Job 2 with distinct status SCREENING', 201, app2Res.status, app2Res.status === 201);

        const getAppsRes = await request(app)
            .get(`/api/candidates/${candidate.id}/applications`)
            .set('Authorization', `Bearer ${token}`);
        const passApps = getAppsRes.status === 200 && getAppsRes.body.count === 2;
        recordTest('Multi-Job Applications', 'Retrieve multiple applications for candidate without mixing jobs', true, passApps, passApps, `Total Apps: ${getAppsRes.body.count}`);

    } catch (err) {
        console.error('Gap Tests Error:', err);
        recordTest('Gap Tests', 'Execution Error', 'No error', err.message, false);
    } finally {
        try {
            if (comp?.id) {
                await prisma.candidateNote.deleteMany({ where: { candidate: { recruitmentjob: { companyId: comp.id } } } });
                await prisma.candidateApplication.deleteMany({ where: { candidate: { recruitmentjob: { companyId: comp.id } } } });
                await prisma.candidateHistory.deleteMany({ where: { candidate: { recruitmentjob: { companyId: comp.id } } } });
                await prisma.candidateSkill.deleteMany({ where: { candidate: { recruitmentjob: { companyId: comp.id } } } });
                await prisma.candidate.deleteMany({ where: { recruitmentjob: { companyId: comp.id } } });
                await prisma.recruitmentJob.deleteMany({ where: { companyId: comp.id } });
                await prisma.user.deleteMany({ where: { companyId: comp.id } });
                await prisma.company.delete({ where: { id: comp.id } });
            }
        } catch (e) {}

        console.log('\n======================================================');
        console.log('🏁 GAP TESTS SUMMARY:');
        console.log('======================================================\n');
        console.table(testResults.map(r => ({ Category: r.category, Test: r.testName, Status: r.status, Evidence: r.evidence })));
    }
}

runGapFeatureTests();
