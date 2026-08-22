import dotenv from 'dotenv';
dotenv.config();
import prisma from '../src/config/db.js';
import jwt from 'jsonwebtoken';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import request from 'supertest';
import app from '../src/app.js';

// Setup Mock Environment variables if needed
const JWT_SECRET = process.env.JWT_SECRET || 'secret';

const testResults = [];

function recordTest(suite, testName, expected, actual, pass, evidence = '') {
    testResults.push({
        suite,
        testName,
        expected,
        actual,
        status: pass ? 'PASS' : 'FAIL',
        evidence
    });
    console.log(`[${pass ? 'PASS' : 'FAIL'}] [${suite}] ${testName} ${evidence ? `-> ${evidence}` : ''}`);
}

async function runATSVerificationSuite() {
    console.log('\n======================================================');
    console.log('🚀 STARTING ATS PRODUCTION READINESS VERIFICATION SUITE');
    console.log('======================================================\n');

    // Warm up DB connection with retry
    let connected = false;
    for (let retry = 1; retry <= 5; retry++) {
        try {
            await prisma.$queryRaw`SELECT 1`;
            connected = true;
            console.log('✅ Database connected successfully via transaction pooler (port 6543).');
            break;
        } catch (e) {
            console.log(`Database connection attempt ${retry} failed, retrying in 2s...`);
            await new Promise(r => setTimeout(r, 2000));
        }
    }

    if (!connected) {
        throw new Error('Could not establish initial connection to Supabase pooler.');
    }

    let compA, compB;
    let userA, userB, unauthEmployee;
    let tokenA, tokenB, tokenUnauth;
    let jobA, jobB;

    try {
        // --------------------------------------------------------------------
        // Setup Test Data (Multi-Tenant Companies, Users, Jobs)
        // --------------------------------------------------------------------
        const uniqueSuffix = Date.now();

        // 1. Create Company A & B
        compA = await prisma.company.create({
            data: {
                name: `ATS Test Company Alpha ${uniqueSuffix}`,
                status: 'ACTIVE',
                updatedAt: new Date()
            }
        });

        compB = await prisma.company.create({
            data: {
                name: `ATS Test Company Beta ${uniqueSuffix}`,
                status: 'ACTIVE',
                updatedAt: new Date()
            }
        });

        // 2. Create Users
        userA = await prisma.user.create({
            data: {
                name: `HR Manager A`,
                email: `managerA_${uniqueSuffix}@company.com`,
                passwordHash: '$2b$10$ep/C/mE7b9h8H9JbH/rVDezB7fE2zK2U1qY0wO6E1Z.l8b6R5N0G2',
                role: 'HR_MANAGER',
                status: 'ACTIVE',
                companyId: compA.id
            }
        });

        userB = await prisma.user.create({
            data: {
                name: `HR Manager B`,
                email: `managerB_${uniqueSuffix}@company.com`,
                passwordHash: '$2b$10$ep/C/mE7b9h8H9JbH/rVDezB7fE2zK2U1qY0wO6E1Z.l8b6R5N0G2',
                role: 'HR_MANAGER',
                status: 'ACTIVE',
                companyId: compB.id
            }
        });

        unauthEmployee = await prisma.user.create({
            data: {
                name: `Regular Employee`,
                email: `employee_${uniqueSuffix}@company.com`,
                passwordHash: '$2b$10$ep/C/mE7b9h8H9JbH/rVDezB7fE2zK2U1qY0wO6E1Z.l8b6R5N0G2',
                role: 'EMPLOYEE',
                status: 'INACTIVE', // Test inactive / unauth
                companyId: compA.id
            }
        });

        // Tokens
        tokenA = jwt.sign({ id: userA.id, email: userA.email, role: userA.role, companyId: compA.id }, JWT_SECRET);
        tokenB = jwt.sign({ id: userB.id, email: userB.email, role: userB.role, companyId: compB.id }, JWT_SECRET);
        tokenUnauth = jwt.sign({ id: unauthEmployee.id, email: unauthEmployee.email, role: unauthEmployee.role, companyId: compA.id }, JWT_SECRET);

        // 3. Create Jobs
        jobA = await prisma.recruitmentJob.create({
            data: {
                companyId: compA.id,
                title: 'Senior Node.js Developer',
                description: 'We need Node.js, TypeScript and Microservices expert',
                department: 'Engineering',
                location: 'Riyadh',
                status: 'OPEN'
            }
        });

        jobB = await prisma.recruitmentJob.create({
            data: {
                companyId: compB.id,
                title: 'Marketing Specialist',
                description: 'We need SEO, Social Media and Content Specialist',
                department: 'Marketing',
                location: 'Jeddah',
                status: 'OPEN'
            }
        });

        // ====================================================================
        // TEST 1: Candidate CRUD
        // ====================================================================
        let candidateA;
        {
            const res = await request(app)
                .post('/api/candidates')
                .set('Authorization', `Bearer ${tokenA}`)
                .send({
                    jobId: jobA.id,
                    fullName: 'سعد المنصور',
                    email: `saad_${uniqueSuffix}@example.com`,
                    phone: '+966500000001',
                    location: 'الرياض',
                    nationality: 'سعودي',
                    dateOfBirth: '1992-05-15',
                    currentTitle: 'Senior Backend Engineer',
                    yearsOfExperience: 6,
                    skills: ['Node.js', 'PostgreSQL', 'Docker', 'Prisma'],
                    previousCompanies: ['STC', 'Elm'],
                    education: 'بكالوريوس هندسة برمجيات - جامعة الملك فهد'
                });

            const pass = res.status === 201 && res.body.data && res.body.data.fullName === 'سعد المنصور';
            candidateA = res.body.data;
            recordTest('Candidate CRUD', 'Create Candidate with full details', 201, res.status, pass, `Candidate ID: ${candidateA?.id}`);
        }

        // Retrieve Profile
        {
            const res = await request(app)
                .get(`/api/candidates/${candidateA.id}`)
                .set('Authorization', `Bearer ${tokenA}`);

            const pass = res.status === 200 && res.body.data.id === candidateA.id && res.body.data.candidateSkills.length > 0;
            recordTest('Candidate CRUD', 'Get Candidate by ID with skills & histories', 200, res.status, pass, `Skills count: ${res.body.data?.candidateSkills?.length}`);
        }

        // Soft Delete
        {
            const delRes = await request(app)
                .delete(`/api/candidates/${candidateA.id}`)
                .set('Authorization', `Bearer ${tokenA}`);

            const getRes = await request(app)
                .get(`/api/candidates/${candidateA.id}`)
                .set('Authorization', `Bearer ${tokenA}`);

            const listRes = await request(app)
                .get(`/api/candidates`)
                .set('Authorization', `Bearer ${tokenA}`);

            const isExcludedFromList = !listRes.body.data.some(c => c.id === candidateA.id);
            const pass = delRes.status === 200 && getRes.status === 404 && isExcludedFromList;
            recordTest('Candidate CRUD', 'Soft Delete candidate and verify excluded from search', '404 on get and excluded from list', `Get: ${getRes.status}, Excluded: ${isExcludedFromList}`, pass);
        }

        // ====================================================================
        // TEST 2: Multi-Tenancy Isolation
        // ====================================================================
        let compACandidate, compBCandidate;
        {
            // Create in Company A
            const resA = await request(app)
                .post('/api/candidates')
                .set('Authorization', `Bearer ${tokenA}`)
                .send({
                    jobId: jobA.id,
                    fullName: 'مرشح شركة أ',
                    email: `candA_${uniqueSuffix}@example.com`,
                    phone: '+966500000002',
                    skills: ['Node.js']
                });
            compACandidate = resA.body.data;

            // Create in Company B
            const resB = await request(app)
                .post('/api/candidates')
                .set('Authorization', `Bearer ${tokenB}`)
                .send({
                    jobId: jobB.id,
                    fullName: 'مرشح شركة ب',
                    email: `candB_${uniqueSuffix}@example.com`,
                    phone: '+966500000003',
                    skills: ['Marketing']
                });
            compBCandidate = resB.body.data;

            // 1. Tenant Isolation on GET List
            const listB = await request(app)
                .get('/api/candidates')
                .set('Authorization', `Bearer ${tokenB}`);

            const canBSeeA = listB.body.data.some(c => c.id === compACandidate.id);
            recordTest('Multi-Tenancy', 'Company B cannot see Company A candidates in list', false, canBSeeA, !canBSeeA, `Total B candidates: ${listB.body.data.length}`);

            // 2. Tenant Isolation on GET Single ID
            const getAFromB = await request(app)
                .get(`/api/candidates/${compACandidate.id}`)
                .set('Authorization', `Bearer ${tokenB}`);
            recordTest('Multi-Tenancy', 'Company B receives 404/403 when accessing Company A candidate by ID', 404, getAFromB.status, getAFromB.status === 404, getAFromB.body.message);

            // 3. Tenant Isolation on PUT Status
            const putAFromB = await request(app)
                .put(`/api/candidates/${compACandidate.id}/status`)
                .set('Authorization', `Bearer ${tokenB}`)
                .send({ status: 'HIRED' });
            recordTest('Multi-Tenancy', 'Company B cannot update stage/status of Company A candidate', 404, putAFromB.status, putAFromB.status === 404, putAFromB.body.message);

            // 4. Tenant Isolation on DELETE
            const delAFromB = await request(app)
                .delete(`/api/candidates/${compACandidate.id}`)
                .set('Authorization', `Bearer ${tokenB}`);
            recordTest('Multi-Tenancy', 'Company B cannot delete Company A candidate', 404, delAFromB.status, delAFromB.status === 404, delAFromB.body.message);

            // 5. Tenant Isolation on Match
            const matchAFromB = await request(app)
                .post(`/api/candidates/${compACandidate.id}/match`)
                .set('Authorization', `Bearer ${tokenB}`)
                .send({ jobId: jobB.id });
            recordTest('Multi-Tenancy', 'Company B cannot run AI matching on Company A candidate', 404, matchAFromB.status, matchAFromB.status === 404, matchAFromB.body.message);
        }

        // ====================================================================
        // TEST 3: Authorization & Security
        // ====================================================================
        {
            // Unauthenticated
            const unauthRes = await request(app).get('/api/candidates');
            recordTest('Authorization', 'Reject unauthenticated requests with 401', 401, unauthRes.status, unauthRes.status === 401);

            // Inactive user token
            const inactiveRes = await request(app)
                .get('/api/candidates')
                .set('Authorization', `Bearer ${tokenUnauth}`);
            recordTest('Authorization', 'Reject inactive user access with 401', 401, inactiveRes.status, inactiveRes.status === 401);
        }

        // ====================================================================
        // TEST 4: CV Upload & Security (File types, limits, magic bytes)
        // ====================================================================
        {
            const dummyPdfPath = path.join(process.cwd(), 'scratch', `test_cv_${uniqueSuffix}.pdf`);
            const invalidTxtPath = path.join(process.cwd(), 'scratch', `test_malicious_${uniqueSuffix}.exe`);
            fs.mkdirSync(path.join(process.cwd(), 'scratch'), { recursive: true });

            // Write minimal valid PDF header
            fs.writeFileSync(dummyPdfPath, '%PDF-1.4\n%âãÏÓ\n1 0 obj\n<< /Title (Test CV) >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF');
            // Write malicious file
            fs.writeFileSync(invalidTxtPath, 'MZ\x90\x00\x03\x00\x00\x00\x04\x00\x00\x00\xff\xff\x00\x00');

            // 1. Valid PDF Upload
            const validUpload = await request(app)
                .post('/api/candidates/upload-cv')
                .set('Authorization', `Bearer ${tokenA}`)
                .attach('cv', dummyPdfPath)
                .field('jobId', jobA.id)
                .field('fullName', 'فيصل الشمري')
                .field('email', `faisal_${uniqueSuffix}@example.com`)
                .field('skills', 'Node.js, Express, MySQL');

            recordTest('CV Upload', 'Upload valid PDF CV with magic bytes validation', 200, validUpload.status, validUpload.status === 200, validUpload.body.message);

            // 2. Reject Disallowed extension (.exe)
            const invalidExtUpload = await request(app)
                .post('/api/candidates/upload-cv')
                .set('Authorization', `Bearer ${tokenA}`)
                .attach('cv', invalidTxtPath)
                .field('jobId', jobA.id);

            recordTest('CV Upload', 'Reject disallowed file extension (.exe)', 500, invalidExtUpload.status, invalidExtUpload.status === 500 || invalidExtUpload.status === 400, invalidExtUpload.body.message || invalidExtUpload.text);

            // Clean scratch test files
            try { fs.unlinkSync(dummyPdfPath); } catch (e) {}
            try { fs.unlinkSync(invalidTxtPath); } catch (e) {}
        }

        // ====================================================================
        // TEST 5: Candidate Pipeline Stage Progression & Audit History
        // ====================================================================
        {
            const stages = [
                'APPLIED',
                'SCREENING',
                'AI_REVIEW',
                'SHORTLISTED',
                'INTERVIEW_SCHEDULED',
                'INTERVIEW_COMPLETED',
                'OFFER_SENT',
                'ACCEPTED',
                'HIRED',
                'REJECTED',
                'WITHDRAWN',
                'NO_RESPONSE'
            ];

            let allStagesPassed = true;
            for (const stage of stages) {
                const res = await request(app)
                    .put(`/api/candidates/${compACandidate.id}/status`)
                    .set('Authorization', `Bearer ${tokenA}`)
                    .send({ status: stage, comment: `Transition to ${stage}` });

                if (res.status !== 200 || res.body.data.status !== stage) {
                    allStagesPassed = false;
                    break;
                }
            }

            // Verify CandidateHistory count
            const historyCount = await prisma.candidateHistory.count({
                where: { candidateId: compACandidate.id }
            });

            const pass = allStagesPassed && historyCount >= stages.length;
            recordTest('Pipeline Stages', 'Cycle candidate through all 12 stages with audit trail logged', `All 12 stages success and logged (History >= ${stages.length})`, `History records logged: ${historyCount}`, pass);
        }

        // ====================================================================
        // TEST 6: AI Matching
        // ====================================================================
        {
            const matchRes = await request(app)
                .post(`/api/candidates/${compACandidate.id}/match`)
                .set('Authorization', `Bearer ${tokenA}`)
                .send({ jobId: jobA.id });

            const data = matchRes.body.data;
            const pass = matchRes.status === 200 &&
                typeof data.matchScore === 'number' &&
                data.matchScore >= 0 && data.matchScore <= 100 &&
                Array.isArray(data.strengths) &&
                Array.isArray(data.weaknesses);

            recordTest('AI Matching', 'Match candidate vs Job requirements with Score, Strengths, and Weaknesses', 'Score 0-100 and strengths/weaknesses arrays', `Score: ${data?.matchScore}, Strengths: ${data?.strengths?.length}, Weaknesses: ${data?.weaknesses?.length}`, pass);
        }

        // ====================================================================
        // TEST 7: Search, Filtering & Pagination
        // ====================================================================
        {
            // Seed a few candidates for search test
            for (let i = 1; i <= 5; i++) {
                await request(app)
                    .post('/api/candidates')
                    .set('Authorization', `Bearer ${tokenA}`)
                    .send({
                        jobId: jobA.id,
                        fullName: `مرشح بحث ${i}`,
                        email: `search_${i}_${uniqueSuffix}@example.com`,
                        location: i % 2 === 0 ? 'الرياض' : 'جدة',
                        yearsOfExperience: i * 2,
                        skills: i % 2 === 0 ? ['React', 'TypeScript'] : ['Node.js', 'Python']
                    });
            }

            // 1. Filter by location
            const locRes = await request(app)
                .get('/api/candidates?location=الرياض')
                .set('Authorization', `Bearer ${tokenA}`);
            const locPass = locRes.status === 200 && locRes.body.data.every(c => c.location?.includes('الرياض'));
            recordTest('Search & Filter', 'Filter candidates by location (الرياض)', true, locPass, locPass, `Count: ${locRes.body.data?.length}`);

            // 2. Filter by Skill
            const skillRes = await request(app)
                .get('/api/candidates?skill=Node.js')
                .set('Authorization', `Bearer ${tokenA}`);
            const skillPass = skillRes.status === 200 && skillRes.body.data.length > 0;
            recordTest('Search & Filter', 'Filter candidates by Skill (Node.js)', true, skillPass, skillPass, `Count: ${skillRes.body.data?.length}`);

            // 3. Filter by Min Experience
            const expRes = await request(app)
                .get('/api/candidates?minExperience=4')
                .set('Authorization', `Bearer ${tokenA}`);
            const expPass = expRes.status === 200 && expRes.body.data.every(c => (c.yearsOfExperience || c.experience) >= 4);
            recordTest('Search & Filter', 'Filter candidates by Min Experience (>= 4 years)', true, expPass, expPass, `Count: ${expRes.body.data?.length}`);

            // 4. Pagination
            const pageRes = await request(app)
                .get('/api/candidates?page=1&limit=2')
                .set('Authorization', `Bearer ${tokenA}`);
            const pagePass = pageRes.status === 200 && pageRes.body.data.length <= 2 && pageRes.body.total >= 5 && pageRes.body.totalPages >= 3;
            recordTest('Search & Filter', 'Pagination metadata & limit slice verification', 'limit: 2, totalPages >= 3', `Received: ${pageRes.body.data?.length}, Total: ${pageRes.body.total}, Pages: ${pageRes.body.totalPages}`, pagePass);
        }

        // ====================================================================
        // TEST 8: Error Handling (Edge Cases)
        // ====================================================================
        {
            // 1. Non-existent candidate
            const fakeIdRes = await request(app)
                .get('/api/candidates/00000000-0000-0000-0000-000000000000')
                .set('Authorization', `Bearer ${tokenA}`);
            recordTest('Error Handling', 'Non-existent candidate returns 404', 404, fakeIdRes.status, fakeIdRes.status === 404);

            // 2. Missing required fields on creation
            const missingFieldRes = await request(app)
                .post('/api/candidates')
                .set('Authorization', `Bearer ${tokenA}`)
                .send({ phone: '+966500000000' });
            recordTest('Error Handling', 'Missing candidate name/email returns 400', 400, missingFieldRes.status, missingFieldRes.status === 400);

            // 3. Cross-company job assignment
            const crossJobRes = await request(app)
                .post('/api/candidates')
                .set('Authorization', `Bearer ${tokenA}`)
                .send({
                    jobId: jobB.id, // Belongs to company B
                    fullName: 'اختبار خرق العزل',
                    email: `leak_${uniqueSuffix}@example.com`
                });
            recordTest('Error Handling', 'Assigning candidate to another company job returns 404/403', 404, crossJobRes.status, crossJobRes.status === 404, crossJobRes.body.message);
        }

    } catch (err) {
        console.error('CRITICAL SUITE ERROR:', err);
        recordTest('Suite Execution', 'Global Execution Error', 'No error', err.message, false);
    } finally {
        // Cleanup Test Data
        try {
            if (compA?.id) {
                await prisma.candidateHistory.deleteMany({ where: { candidate: { recruitmentjob: { companyId: compA.id } } } });
                await prisma.candidateSkill.deleteMany({ where: { candidate: { recruitmentjob: { companyId: compA.id } } } });
                await prisma.candidateExperience.deleteMany({ where: { candidate: { recruitmentjob: { companyId: compA.id } } } });
                await prisma.candidate.deleteMany({ where: { recruitmentjob: { companyId: compA.id } } });
                await prisma.recruitmentJob.deleteMany({ where: { companyId: compA.id } });
                await prisma.user.deleteMany({ where: { companyId: compA.id } });
                await prisma.company.delete({ where: { id: compA.id } });
            }
            if (compB?.id) {
                await prisma.candidateHistory.deleteMany({ where: { candidate: { recruitmentjob: { companyId: compB.id } } } });
                await prisma.candidateSkill.deleteMany({ where: { candidate: { recruitmentjob: { companyId: compB.id } } } });
                await prisma.candidateExperience.deleteMany({ where: { candidate: { recruitmentjob: { companyId: compB.id } } } });
                await prisma.candidate.deleteMany({ where: { recruitmentjob: { companyId: compB.id } } });
                await prisma.recruitmentJob.deleteMany({ where: { companyId: compB.id } });
                await prisma.user.deleteMany({ where: { companyId: compB.id } });
                await prisma.company.delete({ where: { id: compB.id } });
            }
        } catch (cleanupErr) {
            console.error('Cleanup warning:', cleanupErr.message);
        }

        console.log('\n======================================================');
        console.log('🏁 TEST SUITE FINISHED. SUMMARY OF RESULTS:');
        console.log('======================================================\n');
        console.table(testResults.map(r => ({
            Suite: r.suite,
            Test: r.testName,
            Status: r.status,
            Evidence: r.evidence
        })));

        const passed = testResults.filter(r => r.status === 'PASS').length;
        const failed = testResults.filter(r => r.status === 'FAIL').length;
        console.log(`\nTotal: ${testResults.length} | Passed: ${passed} | Failed: ${failed}\n`);
        
        fs.writeFileSync(path.join(process.cwd(), 'ats_verification_results.json'), JSON.stringify({
            timestamp: new Date().toISOString(),
            total: testResults.length,
            passed,
            failed,
            results: testResults
        }, null, 2));

        process.exit(failed > 0 ? 1 : 0);
    }
}

runATSVerificationSuite();
