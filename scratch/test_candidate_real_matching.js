import { PrismaClient } from '@prisma/client';
import * as atsController from '../src/controllers/ats-candidate.controller.js';
import { aiService } from '../src/ai/ai-service.js';

const prisma = new PrismaClient();

async function runTests() {
    console.log('🚀 Starting Comprehensive Candidate & AI Matching Integration Tests...\n');

    let companyA, companyB;
    let jobA1, jobA2, jobB;
    let candidate1, candidate2, candidateIncomplete;

    try {
        // 1. Setup Test Companies & Users
        companyA = await prisma.company.upsert({
            where: { id: 'test-comp-ats-a' },
            update: { name: 'Test Corp Alpha' },
            create: { id: 'test-comp-ats-a', name: 'Test Corp Alpha' }
        });

        companyB = await prisma.company.upsert({
            where: { id: 'test-comp-ats-b' },
            update: { name: 'Test Corp Beta' },
            create: { id: 'test-comp-ats-b', name: 'Test Corp Beta' }
        });

        // 2. Setup Jobs
        jobA1 = await prisma.recruitmentJob.create({
            data: {
                companyId: companyA.id,
                title: 'مطور واجهات أمامية أول (Senior React Developer)',
                department: 'الهندسة التقنية',
                description: 'تطوير واجهات المستخدم باستخدام React و TypeScript و Next.js',
                requirements: 'خبرة لا تقل عن 5 سنوات في React و State Management وتطوير SPA و TypeScript و Redux و TailwindCSS',
                responsibilities: 'بناء واجهات تفاعلية سريعة، مراجعة الكود، تحسين أداء الواجهات',
                yearsOfExperience: 5,
                status: 'OPEN'
            }
        });

        jobA2 = await prisma.recruitmentJob.create({
            data: {
                companyId: companyA.id,
                title: 'مهندس ذكاء اصطناعي وبيانات (AI Engineer & Data Scientist)',
                department: 'الذكاء الاصطناعي',
                description: 'بناء وتدريب نماذج التعلم الآلي و LLMs و Python Pipelines',
                requirements: 'خبرة عملية 4+ سنوات في Python و PyTorch و NLP و LangChain و OpenAI API و Machine Learning',
                responsibilities: 'تطوير محركات الـ AI، تحسين جودة الـ Prompts، تدريب النماذج',
                yearsOfExperience: 4,
                status: 'OPEN'
            }
        });

        jobB = await prisma.recruitmentJob.create({
            data: {
                companyId: companyB.id,
                title: 'مدير مالي (CFO)',
                department: 'المالية',
                description: 'إدارة العمليات المالية والتدقيق',
                status: 'OPEN'
            }
        });

        console.log('✅ 1. Test Companies and Jobs created.');

        // 3. Create Candidate 1 (React Frontend Profile)
        candidate1 = await prisma.candidate.create({
            data: {
                jobId: jobA1.id,
                fullName: 'أحمد التميمي',
                email: `ahmed.frontend.${Date.now()}@example.com`,
                phone: '+966501234567',
                location: 'الرياض',
                nationality: 'سعودي',
                currentTitle: 'Senior Frontend Developer',
                yearsOfExperience: 6,
                experience: 6,
                skills: JSON.stringify(['React', 'TypeScript', 'Next.js', 'Redux', 'HTML5', 'CSS3']),
                education: 'بكالوريوس تقنية معلومات - جامعة الملك سعود',
                previousCompanies: JSON.stringify(['شركة علم', 'شركة تقنية']),
                interviewCode: `TEST-C1-${Date.now()}`,
                status: 'APPLIED'
            }
        });

        // 4. Create Candidate 2 (AI Engineer Profile)
        candidate2 = await prisma.candidate.create({
            data: {
                jobId: jobA2.id,
                fullName: 'سارة المنصور',
                email: `sara.ai.${Date.now()}@example.com`,
                phone: '+966559876543',
                location: 'جدة',
                nationality: 'سعودية',
                currentTitle: 'Machine Learning Engineer',
                yearsOfExperience: 4,
                experience: 4,
                skills: JSON.stringify(['Python', 'PyTorch', 'TensorFlow', 'NLP', 'LangChain', 'FastAPI']),
                education: 'ماجستير ذكاء اصطناعي - جامعة الملك عبدالله للعلوم والتقنية',
                previousCompanies: JSON.stringify(['مركز أبحاث الذكاء الاصطناعي', 'شركة ناشئة']),
                interviewCode: `TEST-C2-${Date.now()}`,
                status: 'APPLIED'
            }
        });

        // 5. Create Candidate Incomplete (No skills, no experience, no title)
        candidateIncomplete = await prisma.candidate.create({
            data: {
                jobId: jobA1.id,
                fullName: 'مرشح بيانات أولية',
                email: `incomplete.${Date.now()}@example.com`,
                yearsOfExperience: 0,
                experience: 0,
                skills: null,
                education: null,
                currentTitle: null,
                location: null,
                nationality: null,
                interviewCode: `TEST-C3-${Date.now()}`,
                status: 'APPLIED'
            }
        });

        console.log('✅ 2. Real Candidate profiles created without mock defaults.');

        // Test 1: Verify Incomplete Candidate has NULLs, not default 85 or 'الرياض' or 'مطور برمجيات'
        const fetchedIncomplete = await prisma.candidate.findUnique({ where: { id: candidateIncomplete.id } });
        if (fetchedIncomplete.location !== null || fetchedIncomplete.aiScore !== null || fetchedIncomplete.currentTitle !== null) {
            throw new Error(`❌ Incomplete candidate contained unexpected mock defaults! aiScore: ${fetchedIncomplete.aiScore}, location: ${fetchedIncomplete.location}`);
        }
        console.log('✅ 3. Candidate without data has strictly NULL fields (No fake 85/الرياض/مطور defaults).');

        // Test 2: AI Matching Candidate 1 (Frontend) against Job A1 (Frontend Job) -> High Match
        console.log('\n🤖 Testing AI Matching: Candidate 1 (React Frontend) vs Job A1 (Frontend Job)...');
        const reqMatch1 = {
            user: { companyId: companyA.id },
            params: { id: candidate1.id },
            body: { jobId: jobA1.id }
        };
        let match1Data = null;
        const resMatch1 = {
            status: (code) => ({
                json: (payload) => {
                    match1Data = payload;
                    return payload;
                }
            })
        };
        await atsController.matchCandidateWithJob(reqMatch1, resMatch1, (err) => { if (err) throw err; });

        console.log(`Match Result (Ahmed vs Frontend Job): Score = ${match1Data?.data?.matchScore}%, Rec = ${match1Data?.data?.recommendation}`);
        if (!match1Data || match1Data.data.matchScore === null || match1Data.data.matchScore < 70) {
            throw new Error(`❌ Expected high match score for Frontend candidate against Frontend job, got: ${match1Data?.data?.matchScore}`);
        }
        console.log('✅ 4. Candidate 1 achieved high, fact-based match with Job A1.');

        // Test 3: AI Matching Candidate 1 (Frontend) against Job B (CFO Financial Job within Company A created as Job A_CFO)
        const jobCFO = await prisma.recruitmentJob.create({
            data: {
                companyId: companyA.id,
                title: 'رئيس قسم الحسابات المالية (Senior Financial Accountant)',
                department: 'المالية والمحاسبة',
                description: 'إعداد التقارير المالية والميزانيات العمومية والتدقيق المالي وإدارة الضرائب',
                requirements: 'بكالوريوس محاسبة مع خبرة 7 سنوات في إعداد القوائم المالية والمعايير الدولية IFRS وتدقيق الحسابات و SOCPA',
                responsibilities: 'إقفال الحسابات الشهرية والسنوية، مراجعة قيود اليومية، الامتثال للزكاة والضريبة',
                yearsOfExperience: 7,
                status: 'OPEN'
            }
        });

        console.log('\n🤖 Testing AI Matching: Candidate 1 (React Developer) vs CFO/Accountant Job...');
        const reqMatch1VsCFO = {
            user: { companyId: companyA.id },
            params: { id: candidate1.id },
            body: { jobId: jobCFO.id }
        };
        let matchCFOData = null;
        const resMatchCFO = {
            status: (code) => ({
                json: (payload) => {
                    matchCFOData = payload;
                    return payload;
                }
            })
        };
        await atsController.matchCandidateWithJob(reqMatch1VsCFO, resMatchCFO, (err) => { if (err) throw err; });

        console.log(`Match Result (Ahmed Developer vs CFO Job): Score = ${matchCFOData?.data?.matchScore}%, Rec = ${matchCFOData?.data?.recommendation}`);
        if (matchCFOData.data.matchScore >= 60 || matchCFOData.data.matchScore >= match1Data.data.matchScore) {
            throw new Error(`❌ Expected significantly lower match score (<60%) for Developer against Accountant job! Got: ${matchCFOData.data.matchScore}`);
        }
        if (!matchCFOData.data.missingSkills || matchCFOData.data.missingSkills.length === 0) {
            throw new Error(`❌ Expected missing skills to be extracted for mismatched job!`);
        }
        console.log('✅ 5. Job-Specific AI Matching accurately distinguished between Frontend Job and Financial Job.');

        // Test 4: Multi-tenant Isolation (Company B trying to access Company A's candidate)
        console.log('\n🔒 Testing Multi-tenant Isolation...');
        const reqTenantAttack = {
            user: { companyId: companyB.id },
            params: { id: candidate1.id },
            body: {}
        };
        let tenantDenied = false;
        const resTenant = {
            status: (code) => {
                if (code === 404) tenantDenied = true;
                return { json: () => {} };
            }
        };
        await atsController.getCandidateById(reqTenantAttack, resTenant, () => {});
        if (!tenantDenied) {
            throw new Error('❌ Multi-tenant isolation failed! Company B accessed Company A candidate!');
        }
        console.log('✅ 6. Multi-Tenant Isolation verified: Company B cannot access Company A candidates.');

        // Test 5: Interview Integration
        console.log('\n🎙️ Testing Real Interview Evaluation...');
        const interview = await prisma.interview.create({
            data: {
                candidateId: candidate1.id,
                type: 'AI_VIDEO',
                notes: 'أجاب المرشح بدقة عن أسئلة الـ State Management والـ React Performance Optimization',
                aiScore: 92,
                aiSummary: 'أداء ممتاز في المقابلة مع وضوح عالي في المفاهيم التقنية وحل المشكلات.',
                completed: true,
                status: 'completed'
            }
        });

        const reqCandWithInterview = {
            user: { companyId: companyA.id },
            params: { id: candidate1.id }
        };
        let fetchedCandidateProfile = null;
        const resCandProfile = {
            status: () => ({
                json: (payload) => {
                    fetchedCandidateProfile = payload.data;
                }
            })
        };
        await atsController.getCandidateById(reqCandWithInterview, resCandProfile, () => {});

        if (!fetchedCandidateProfile.interviews || fetchedCandidateProfile.interviews.length === 0) {
            throw new Error('❌ Interview data not linked or fetched in candidate profile!');
        }
        if (fetchedCandidateProfile.interviews[0].aiScore !== 92) {
            throw new Error('❌ Interview AI Score mismatch!');
        }
        console.log('✅ 7. Real Interview data correctly linked and retrieved in Candidate Profile.');

        console.log('\n🎉 ALL INTEGRATION TESTS PASSED SUCCESSFULLY! 🚀');
    } catch (err) {
        console.error('\n❌ TEST FAILED:', err);
        process.exit(1);
    } finally {
        // Cleanup test data
        try {
            if (candidate1) await prisma.candidate.deleteMany({ where: { id: { in: [candidate1.id, candidate2?.id, candidateIncomplete?.id].filter(Boolean) } } });
            if (jobA1) await prisma.recruitmentJob.deleteMany({ where: { id: { in: [jobA1.id, jobA2?.id, jobB?.id].filter(Boolean) } } });
            if (companyA) await prisma.company.deleteMany({ where: { id: { in: [companyA.id, companyB?.id].filter(Boolean) } } });
        } catch (cleanErr) {
            // ignore
        }
        await prisma.$disconnect();
    }
}

runTests();
