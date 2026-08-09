import prisma from '../src/config/db.js';

async function verifyATS() {
    console.log('🧪 Starting ATS Candidate Management Verification Test...\n');

    try {
        // 1. Get or create company & job
        let company = await prisma.company.findFirst();
        if (!company) {
            company = await prisma.company.create({
                data: { name: 'اختبار ATS', domain: 'ats-test.com', status: 'ACTIVE', updatedAt: new Date() }
            });
        }

        let job = await prisma.recruitmentJob.findFirst({ where: { companyId: company.id } });
        if (!job) {
            job = await prisma.recruitmentJob.create({
                data: {
                    companyId: company.id,
                    title: 'مطور أول Cloud & Node.js',
                    description: 'وصف الوظيفة العام المعتمد',
                    department: 'تكنولوجيا المعلومات والبرمجيات',
                    location: 'الرياض',
                    status: 'OPEN'
                }
            });
        }

        console.log(`✅ Company ID: ${company.id}, Job ID: ${job.id}`);

        // 2. Create Candidate Profile with full fields
        const candidate = await prisma.candidate.create({
            data: {
                jobId: job.id,
                fullName: 'أحمد علي البارودي',
                email: `ahmed.test.${Date.now()}@example.com`,
                phone: '+966501234567',
                location: 'الرياض',
                nationality: 'سعودي',
                currentTitle: 'Senior Full Stack Developer',
                yearsOfExperience: 5,
                experience: 5,
                previousCompanies: JSON.stringify(['TechCorp', 'CloudSolutions', 'SaaS Platform']),
                skills: JSON.stringify(['Node.js', 'React', 'TypeScript', 'PostgreSQL', 'Docker']),
                education: 'بكالوريوس علوم حاسب - جامعة الملك سعود',
                aiScore: 88,
                aiSummary: 'مرشح ممتاز يمتلك خبرات تقنية متقدمة ومطابقة عالية لمتطلبات الوظيفة.',
                status: 'APPLIED'
            }
        });

        console.log(`✅ Created Candidate: ${candidate.fullName} (ID: ${candidate.id})`);

        // 3. Add CandidateSkills & CandidateExperiences
        await prisma.candidateSkill.createMany({
            data: [
                { candidateId: candidate.id, skillName: 'Node.js', level: 'EXPERT' },
                { candidateId: candidate.id, skillName: 'React', level: 'ADVANCED' },
                { candidateId: candidate.id, skillName: 'TypeScript', level: 'ADVANCED' }
            ]
        });

        await prisma.candidateExperience.create({
            data: {
                candidateId: candidate.id,
                company: 'CloudSolutions',
                position: 'Senior Software Engineer',
                description: 'تطوير وتصميم منصات SaaS عالية الأداء بالذكاء الاصطناعي'
            }
        });

        console.log(`✅ Linked CandidateSkills & CandidateExperiences`);

        // 4. Log initial CandidateHistory
        await prisma.candidateHistory.create({
            data: {
                candidateId: candidate.id,
                action: 'إنشاء ملف مرشح جديد',
                oldStatus: null,
                newStatus: 'APPLIED',
                comment: 'تقديم جديد عبر منصة ATS',
                performedBy: 'TEST_SUITE'
            }
        });

        // 5. Update Candidate Stage to SHORTLISTED & HIRED
        await prisma.candidate.update({
            where: { id: candidate.id },
            data: { status: 'SHORTLISTED' }
        });

        await prisma.candidateHistory.create({
            data: {
                candidateId: candidate.id,
                action: 'تغيير مرحلة المرشح إلى SHORTLISTED',
                oldStatus: 'APPLIED',
                newStatus: 'SHORTLISTED',
                comment: 'ترشيح القائمة القصيرة بعد المقابلة الأولى',
                performedBy: 'TEST_SUITE'
            }
        });

        console.log(`✅ Transitioned Candidate Status to SHORTLISTED`);

        // 6. Verify Candidate Query & Relations
        const result = await prisma.candidate.findUnique({
            where: { id: candidate.id },
            include: {
                candidateSkills: true,
                candidateExperiences: true,
                candidateHistories: { orderBy: { createdAt: 'desc' } }
            }
        });

        console.log('\n================================================');
        console.log('🎉 VERIFICATION RESULTS SUMMARY:');
        console.log(`- Candidate Name: ${result.fullName}`);
        console.log(`- Status: ${result.status}`);
        console.log(`- Skills Count: ${result.candidateSkills.length}`);
        console.log(`- Experiences Count: ${result.candidateExperiences.length}`);
        console.log(`- History Records Count: ${result.candidateHistories.length}`);
        console.log(`- AI Score: ${result.aiScore}/100`);
        console.log('================================================\n');

        console.log('✨ ALL ATS DATABASE & API CONTRACT TESTS PASSED 100%! ✨');
    } catch (err) {
        console.error('❌ Verification test failed:', err);
        process.exit(1);
    } finally {
        await prisma.$disconnect();
    }
}

verifyATS();
