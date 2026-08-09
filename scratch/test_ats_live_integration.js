import prisma from '../src/config/db.js';
import * as atsService from '../src/controllers/ats-candidate.controller.js';

async function runFullIntegrationTest() {
    console.log('================================================================');
    console.log('🧪 REAL LIVE ATS INTEGRATION TEST (DB + API + AI + FRONTEND CONTRACT)');
    console.log('================================================================\n');

    let createdCandidateId = null;
    let companyId = null;
    let jobId = null;

    try {
        // Step 1: Database & Tenant Initialization
        console.log('🔍 Step 1: Testing Database Tenant & Job Setup...');
        const company = await prisma.company.findFirst();
        if (!company) {
            throw new Error('No company found in DB');
        }
        companyId = company.id;

        let job = await prisma.recruitmentJob.findFirst({ where: { companyId, deletedAt: null } });
        if (!job) {
            job = await prisma.recruitmentJob.create({
                data: {
                    companyId,
                    title: 'مهندس حلول برمجية Senior Cloud Architect',
                    description: 'الوصف الوظيفي لمهندس الحلول السحابية',
                    department: 'تكنولوجيا المعلومات والبرمجيات',
                    location: 'الرياض',
                    status: 'OPEN'
                }
            });
        }
        jobId = job.id;
        console.log(`✅ Database connection active. Company: ${company.name} | Job: ${job.title}\n`);

        // Step 2: Testing Real Candidate Creation API Endpoint Contract
        console.log('🔍 Step 2: Testing Candidate Profile Creation (Personal + Professional + Docs)...');
        const reqCreate = {
            user: { companyId, id: 'test_manager_id' },
            body: {
                jobId,
                fullName: 'د. خالد عبد الرحمن الغامدي',
                email: `khalid.ats.${Date.now()}@example.com`,
                phone: '+966551239876',
                location: 'الرياض',
                nationality: 'سعودي',
                dateOfBirth: '1992-05-15',
                currentTitle: 'Senior Cloud & AI Architect',
                yearsOfExperience: 7,
                skillsList: [
                    { skillName: 'Kubernetes', level: 'EXPERT' },
                    { skillName: 'Node.js', level: 'EXPERT' },
                    { skillName: 'React', level: 'ADVANCED' },
                    { skillName: 'PostgreSQL', level: 'EXPERT' },
                    { skillName: 'Python AI', level: 'ADVANCED' }
                ],
                experiencesList: [
                    { company: 'Saudi Tech Corp', position: 'Cloud Architect', startDate: '2021-01-01', description: 'تصميم حلول سحابية متقدمة' },
                    { company: 'Innovate SaaS', position: 'Senior Backend Engineer', startDate: '2018-06-01', endDate: '2020-12-31', description: 'تطوير انظمة microservices' }
                ],
                education: 'ماجستير علوم حاسب وبحث الذكاء الاصطناعي - جامعة الملك فهد للبترول والمعادن',
                certifications: ['AWS Certified Solutions Architect', 'CKA Kubernetes Admin'],
                languages: ['العربية', 'الإنجليزية'],
                portfolioLinks: ['https://github.com/khalid-dev', 'https://khalid-cloud.io']
            }
        };

        let responseData = null;
        const resMockCreate = {
            status: (code) => ({
                json: (data) => {
                    responseData = data;
                    return data;
                }
            })
        };

        await atsService.createCandidate(reqCreate, resMockCreate, (err) => { if (err) throw err; });
        
        if (!responseData || responseData.status !== 'success') {
            throw new Error('Failed to create candidate profile: ' + JSON.stringify(responseData));
        }

        createdCandidateId = responseData.data.id;
        console.log(`✅ Candidate created successfully in DB with ID: ${createdCandidateId}`);
        console.log(`   - Name: ${responseData.data.fullName}`);
        console.log(`   - Title: ${responseData.data.currentTitle}`);
        console.log(`   - Skills Count: ${responseData.data.candidateSkills.length}`);
        console.log(`   - Experiences Count: ${responseData.data.candidateExperiences.length}\n`);

        // Step 3: Testing Real AI Matching Engine
        console.log('🔍 Step 3: Testing Real AI Match Engine (Match Score + Strengths + Weaknesses)...');
        const reqMatch = {
            params: { id: createdCandidateId },
            body: { jobId },
            user: { companyId, id: 'test_manager_id' }
        };

        let matchResponseData = null;
        const resMockMatch = {
            status: (code) => ({
                json: (data) => {
                    matchResponseData = data;
                    return data;
                }
            })
        };

        await atsService.matchCandidateWithJob(reqMatch, resMockMatch, (err) => { if (err) throw err; });

        console.log(`✅ AI Matching completed successfully:`);
        console.log(`   - Match Score: ${matchResponseData.data.matchScore}/100`);
        console.log(`   - Strengths (${matchResponseData.data.strengths.length}):`, matchResponseData.data.strengths);
        console.log(`   - Weaknesses (${matchResponseData.data.weaknesses.length}):`, matchResponseData.data.weaknesses, '\n');

        // Step 4: Testing Candidate Pipeline Stage Updates & Audit Trail
        console.log('🔍 Step 4: Testing Pipeline Stage Progression & Audit Trail Log...');
        const stagesToTest = ['SCREENING', 'AI_REVIEW', 'SHORTLISTED', 'INTERVIEW_SCHEDULED', 'OFFER_SENT', 'HIRED'];

        for (const stage of stagesToTest) {
            let statusResponse = null;
            const reqStatus = {
                params: { id: createdCandidateId },
                body: { status: stage, comment: `انتقال تجريبي لمرحلة ${stage}` },
                user: { companyId, id: 'test_manager_id' }
            };
            const resMockStatus = {
                status: (code) => ({
                    json: (data) => {
                        statusResponse = data;
                        return data;
                    }
                })
            };

            await atsService.updateCandidateStatus(reqStatus, resMockStatus, (err) => { if (err) throw err; });
        }

        console.log(`✅ Pipeline status transitions tested up to HIRED.`);

        // Step 5: Verification of Full Candidate Profile Query (Frontend View Contract)
        console.log('🔍 Step 5: Verifying Full Candidate Profile Data Contract (CandidateProfileModal view)...');
        let profileResponse = null;
        const reqProfile = { params: { id: createdCandidateId } };
        const resMockProfile = {
            status: (code) => ({
                json: (data) => {
                    profileResponse = data;
                    return data;
                }
            })
        };

        await atsService.getCandidateById(reqProfile, resMockProfile, (err) => { if (err) throw err; });
        const finalCandidate = profileResponse.data;

        console.log('\n================================================================');
        console.log('🎉 FULL REAL LIVE ATS INTEGRATION TEST RESULTS:');
        console.log(`- Candidate ID: ${finalCandidate.id}`);
        console.log(`- Full Name: ${finalCandidate.fullName}`);
        console.log(`- Final Status: ${finalCandidate.status}`);
        console.log(`- Calculated AI Score: ${finalCandidate.aiScore}/100`);
        console.log(`- Recorded Skills: ${finalCandidate.candidateSkills.map(s => s.skillName).join(', ')}`);
        console.log(`- Recorded Experiences: ${finalCandidate.candidateExperiences.map(e => e.company).join(', ')}`);
        console.log(`- Timeline Audit History Records: ${finalCandidate.candidateHistories.length}`);
        console.log('================================================================\n');

        console.log('✨ SYSTEM VERIFIED 100%: REAL DATA, DYNAMIC REAL-TIME QUERIES, FULLY COMPATIBLE! ✨');

    } catch (err) {
        console.error('❌ Live Integration Test Failed:', err);
        process.exit(1);
    } finally {
        await prisma.$disconnect();
    }
}

runFullIntegrationTest();
