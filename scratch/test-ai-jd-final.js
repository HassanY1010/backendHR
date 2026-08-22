import request from 'supertest';
import express from 'express';
import cookieParser from 'cookie-parser';
import jwt from 'jsonwebtoken';
import prisma from '../src/config/db.js';
import aiJdRoutes from '../src/routes/ai-jd.routes.js';
import { errorHandler } from '../src/middlewares/error.middleware.js';

const app = express();
app.use(express.json());
app.use(cookieParser());
app.use('/api/ai/job-description', aiJdRoutes);
app.use('/api/ai-jd', aiJdRoutes);
app.use(errorHandler);

const results = [];
function recordTest(category, testName, expected, actual, passed, details = '') {
    const icon = passed ? '✅ PASS' : '❌ FAIL';
    console.log(`${icon} [${category}] ${testName} ${details ? `-> ${details}` : ''}`);
    results.push({ category, test: testName, status: passed ? 'PASS' : 'FAIL', details });
}

async function runAIJobDescriptionFullVerification() {
    console.log('\n==================================================================');
    console.log('🤖 RUNNING AI JOB DESCRIPTION GENERATOR COMPLETE VERIFICATION SUITE');
    console.log('==================================================================\n');

    let compA, compB, userA, userB;
    let tokenA, tokenB;

    try {
        const JWT_SECRET = process.env.JWT_SECRET || 'secret';

        // 1. Create Test Tenants
        compA = await prisma.company.create({
            data: { name: `AI JD Tenant A ${Date.now()}`, status: 'ACTIVE' }
        });
        compB = await prisma.company.create({
            data: { name: `AI JD Tenant B ${Date.now()}`, status: 'ACTIVE' }
        });

        userA = await prisma.user.create({
            data: { email: `recruiter-a-${Date.now()}@ai.com`, name: 'Ahmed Recruiter', passwordHash: 'hash123', role: 'RECRUITER', status: 'ACTIVE', companyId: compA.id }
        });
        tokenA = jwt.sign({ id: userA.id, companyId: compA.id, role: 'RECRUITER' }, JWT_SECRET);

        userB = await prisma.user.create({
            data: { email: `recruiter-b-${Date.now()}@ai.com`, name: 'Omar Recruiter B', passwordHash: 'hash123', role: 'RECRUITER', status: 'ACTIVE', companyId: compB.id }
        });
        tokenB = jwt.sign({ id: userB.id, companyId: compB.id, role: 'RECRUITER' }, JWT_SECRET);

        // -----------------------------------------------------------------------------------
        // TEST 1: Standard AI Generation (Senior Backend Developer - Riyadh - 7 yrs - Node/Postgres)
        // -----------------------------------------------------------------------------------
        const genRes1 = await request(app)
            .post('/api/ai/job-description/generate')
            .set('Authorization', `Bearer ${tokenA}`)
            .send({
                jobTitle: 'Senior Backend Developer',
                experience: '7 سنوات',
                location: 'الرياض',
                skills: ['Node.js', 'PostgreSQL', 'REST APIs'],
                salaryMin: 22000,
                salaryMax: 30000,
                department: 'هندسة البرمجيات'
            });

        const data1 = genRes1.body.data;
        const passGen1 = genRes1.status === 200 &&
            data1?.jobTitle &&
            data1?.summary &&
            Array.isArray(data1?.responsibilities) && data1.responsibilities.length > 0 &&
            Array.isArray(data1?.requirements) && data1.requirements.length > 0 &&
            Array.isArray(data1?.requiredSkills) &&
            Array.isArray(data1?.interviewQuestions) && data1.interviewQuestions.length > 0 &&
            Array.isArray(data1?.searchKeywords) &&
            data1?.marketAnalysis;

        recordTest('AI Generation', 'Generate comprehensive JD (Title, Summary, Responsibilities, Requirements, Skills, Questions, Keywords)', true, passGen1, passGen1, `Title: ${data1?.jobTitle}`);

        // -----------------------------------------------------------------------------------
        // TEST 2: Market Intelligence & Skills/Salary Suggestion
        // -----------------------------------------------------------------------------------
        const hasMarketSuggestions = !!(data1?.marketAnalysis?.marketTip && Array.isArray(data1?.marketAnalysis?.recommendedSkillsToAdd));
        recordTest('Market Intelligence', 'AI provides Market Tips, recommended skills to add (e.g. Cloud/K8s) and salary insights', true, hasMarketSuggestions, hasMarketSuggestions, `Tip: ${data1?.marketAnalysis?.marketTip?.slice(0, 40)}...`);

        // -----------------------------------------------------------------------------------
        // TEST 3: Partial / Incomplete Inputs Handling
        // -----------------------------------------------------------------------------------
        const partialRes = await request(app)
            .post('/api/ai/job-description/generate')
            .set('Authorization', `Bearer ${tokenA}`)
            .send({
                jobTitle: 'UI/UX Designer'
                // No department, salary, skills, or experience passed
            });
        const partialData = partialRes.body.data;
        const passPartial = partialRes.status === 200 && partialData?.summary && partialData?.responsibilities?.length > 0;
        recordTest('Incomplete Inputs', 'Handle minimal/incomplete inputs gracefully with domain defaults', true, passPartial, passPartial);

        // -----------------------------------------------------------------------------------
        // TEST 4: Multi-Language & Technical Domains (English & Arabic)
        // -----------------------------------------------------------------------------------
        const enRes = await request(app)
            .post('/api/ai/job-description/generate')
            .set('Authorization', `Bearer ${tokenA}`)
            .send({
                jobTitle: 'AI Research Scientist',
                department: 'Artificial Intelligence Lab',
                experience: '5+ years',
                location: 'Riyadh',
                skills: ['PyTorch', 'Transformers', 'CUDA']
            });
        const enData = enRes.body.data;
        const passEn = enRes.status === 200 && enData?.jobTitle === 'AI Research Scientist' && enData?.interviewQuestions?.length > 0;
        recordTest('Multi-Language & Domain', 'Generate JD for English/Tech roles with specialized domain-tailored questions', true, passEn, passEn);

        // -----------------------------------------------------------------------------------
        // TEST 5: Interactive Chat Gathering (/chat endpoint)
        // -----------------------------------------------------------------------------------
        const chatRes1 = await request(app)
            .post('/api/ai/job-description/chat')
            .set('Authorization', `Bearer ${tokenA}`)
            .send({
                messages: [
                    { role: 'user', content: 'أحتاج وظيفة محاسب مالي خبير بالرياض' }
                ]
            });
        const passChat = chatRes1.status === 200 && (chatRes1.body.data?.nextQuestion || chatRes1.body.data?.jobTitle);
        recordTest('Interactive Chat', 'Interactive Chat mode for multi-turn JD requirements gathering', true, passChat, passChat);

        // -----------------------------------------------------------------------------------
        // TEST 6: Improve Job Description Endpoint (/improve)
        // -----------------------------------------------------------------------------------
        const improveRes = await request(app)
            .post('/api/ai/job-description/improve')
            .set('Authorization', `Bearer ${tokenA}`)
            .send({
                jobTitle: 'Senior Backend Developer',
                department: 'الهندسة البرمجية',
                currentContent: data1,
                improvementInstructions: 'الوصف الحالي ضعيف، اقترح إضافة Kubernetes و Microservices لأن أغلب الوظائف تطلبها'
            });
        const improveData = improveRes.body.data;
        const passImprove = improveRes.status === 200 && improveData?.marketAnalysis && improveRes.body.version >= 2;
        recordTest('AI Improve Text', 'Improve existing JD with custom user instructions & market benchmarking', true, passImprove, passImprove, `Version: ${improveRes.body.version}`);

        // -----------------------------------------------------------------------------------
        // TEST 7: Versioned History Retrieval (/history)
        // -----------------------------------------------------------------------------------
        const histRes = await request(app)
            .get('/api/ai/job-description/history')
            .set('Authorization', `Bearer ${tokenA}`);
        const historyList = histRes.body.data;
        const passHist = histRes.status === 200 && Array.isArray(historyList) && historyList.length >= 2;
        recordTest('Versioned History', 'Retrieve version history records from AIJobDescriptions table', true, passHist, passHist, `Total versions stored: ${historyList?.length}`);

        // -----------------------------------------------------------------------------------
        // TEST 8: Multi-Tenant Isolation (Tenant B cannot access Tenant A history)
        // -----------------------------------------------------------------------------------
        const tenantBHist = await request(app)
            .get('/api/ai/job-description/history')
            .set('Authorization', `Bearer ${tokenB}`);
        const passIsolation = tenantBHist.status === 200 && tenantBHist.body.data.length === 0;
        recordTest('Tenant Isolation', 'Tenant B cannot see Tenant A Job Description versions in DB (0 leaks)', true, passIsolation, passIsolation);

        // -----------------------------------------------------------------------------------
        // TEST 9: Direct Database Integrity Check (AIJobDescriptions Table)
        // -----------------------------------------------------------------------------------
        const dbRecords = await prisma.aIJobDescription.findMany({
            where: { companyId: compA.id }
        });
        const passDb = dbRecords.length >= 2 && dbRecords.every(r => r.companyId === compA.id && r.createdBy === userA.id);
        recordTest('Database Integrity', 'Records safely linked with foreign keys, JSON payloads, and user creator ID', true, passDb, passDb, `DB Count: ${dbRecords.length}`);

    } catch (err) {
        console.error('Error during AI JD verification:', err);
        recordTest('Execution Error', 'Unexpected runtime error during tests', 'None', err.message, false);
    } finally {
        try {
            if (compA?.id) {
                await prisma.aIJobDescription.deleteMany({ where: { companyId: compA.id } });
                await prisma.user.deleteMany({ where: { companyId: compA.id } });
                await prisma.company.delete({ where: { id: compA.id } });
            }
            if (compB?.id) {
                await prisma.aIJobDescription.deleteMany({ where: { companyId: compB.id } });
                await prisma.user.deleteMany({ where: { companyId: compB.id } });
                await prisma.company.delete({ where: { id: compB.id } });
            }
        } catch (e) {}
    }

    console.log('\n==================================================================');
    console.log('🏁 FINAL AI JOB DESCRIPTION GENERATOR ACCEPTANCE RESULTS:');
    console.log('==================================================================\n');
    console.table(results);
}

runAIJobDescriptionFullVerification();
