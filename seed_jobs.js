// Seed script to add sample jobs for testing
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function seedJobs() {
    try {
        // Get first company
        const company = await prisma.company.findFirst();

        if (!company) {
            console.error('No company found. Please create a company first.');
            return;
        }

        // Create sample jobs
        const jobs = [
            {
                title: 'مطور Full Stack',
                description: 'نبحث عن مطور Full Stack محترف للانضمام لفريقنا التقني. ستكون مسؤولاً عن تطوير وصيانة تطبيقات الويب باستخدام أحدث التقنيات.',
                department: 'التقنية',
                location: 'الرياض، المملكة العربية السعودية',
                type: 'دوام كامل',
                requirements: JSON.stringify([
                    'خبرة 3 سنوات على الأقل في تطوير الويب',
                    'إتقان React و Node.js',
                    'معرفة جيدة بقواعد البيانات (PostgreSQL, MongoDB)',
                    'خبرة في Git و CI/CD'
                ]),
                status: 'OPEN',
                companyId: company.id
            },
            {
                title: 'مصمم UI/UX',
                description: 'نبحث عن مصمم UI/UX مبدع لتصميم واجهات مستخدم جذابة وسهلة الاستخدام لمنتجاتنا الرقمية.',
                department: 'التصميم',
                location: 'جدة، المملكة العربية السعودية',
                type: 'دوام كامل',
                requirements: JSON.stringify([
                    'خبرة 2-4 سنوات في تصميم UI/UX',
                    'إتقان Figma و Adobe XD',
                    'معرفة بمبادئ التصميم الحديثة',
                    'قدرة على إنشاء نماذج تفاعلية'
                ]),
                status: 'OPEN',
                companyId: company.id
            },
            {
                title: 'مدير مشاريع تقنية',
                description: 'نبحث عن مدير مشاريع تقنية ذو خبرة لقيادة فرق التطوير وإدارة المشاريع التقنية من البداية حتى النهاية.',
                department: 'الإدارة',
                location: 'الرياض، المملكة العربية السعودية',
                type: 'دوام كامل',
                requirements: JSON.stringify([
                    'خبرة 5 سنوات في إدارة المشاريع التقنية',
                    'شهادة PMP أو ما يعادلها',
                    'خبرة في Agile و Scrum',
                    'مهارات قيادية وتواصل ممتازة'
                ]),
                status: 'OPEN',
                companyId: company.id
            }
        ];

        for (const jobData of jobs) {
            const job = await prisma.recruitmentJob.create({
                data: jobData
            });
            console.log(`✅ Created job: ${job.title} (ID: ${job.id})`);
        }

        console.log('\n✅ Successfully seeded jobs!');
    } catch (error) {
        console.error('❌ Error seeding jobs:', error);
    } finally {
        await prisma.$disconnect();
    }
}

seedJobs();
