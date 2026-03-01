
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('Seeding Training Courses...');

    const courses = [
        {
            title: 'إدارة الوقت وزيادة الإنتاجية',
            description: 'دورة شاملة لتعلم كيفية تنظيم الوقت وتحديد الأولويات لتحقيق أقصى إنتاجية في العمل.',
            provider: 'Doroob',
            category: 'مهارات شخصية',
            url: 'https://doroob.sa/ar/individuals/elearning/', // Placeholder real link would be specific
            duration: 120, // 2 hours
            level: 'beginner',
            skills: JSON.stringify(['Time Management', 'Productivity', 'Planning']),
            isFree: true,
            status: 'active',
            language: 'ar'
        },
        {
            title: 'أساسيات القيادة الإدارية',
            description: 'تعلم المبادئ الأساسية للقيادة وإدارة الفرق بفعالية وتأثير.',
            provider: 'EdX',
            category: 'إدارة وقيادة',
            url: 'https://www.edx.org/learn/leadership',
            duration: 300,
            level: 'intermediate',
            skills: JSON.stringify(['Leadership', 'Team Management', 'Communication']),
            isFree: true,
            status: 'active',
            language: 'ar'
        },
        {
            title: 'مقدمة في تحليل البيانات',
            description: 'فهم أساسيات تحليل البيانات وكيفية استخدامها لاتخاذ قرارات عمل مستنيرة.',
            provider: 'Coursera',
            category: 'تكنولوجيا',
            url: 'https://www.coursera.org/learn/data-analytics-basics',
            duration: 480,
            level: 'beginner',
            skills: JSON.stringify(['Data Analysis', 'Excel', 'Critical Thinking']),
            isFree: true,
            status: 'active',
            language: 'en'
        },
        {
            title: 'مهارات التواصل الفعال في بيئة العمل',
            description: 'تحسين قدراتك على التواصل مع الزملاء والمدراء والعملاء بوضوح واحترافية.',
            provider: 'Udemy',
            category: 'مهارات ناعمة',
            url: 'https://www.udemy.com/topic/communication-skills/',
            duration: 90,
            level: 'beginner',
            skills: JSON.stringify(['Communication', 'Negotiation', 'Teamwork']),
            isFree: true, // Assuming filter finds free ones
            status: 'active',
            language: 'ar'
        },
        {
            title: 'أساسيات التسويق الرقمي',
            description: 'مدخل إلى عالم التسويق الإلكتروني وشبكات التواصل الاجتماعي.',
            provider: 'Google Garage',
            category: 'تسويق',
            url: 'https://learndigital.withgoogle.com/mahara-tech',
            duration: 240,
            level: 'beginner',
            skills: JSON.stringify(['Digital Marketing', 'SEO', 'Social Media']),
            isFree: true,
            status: 'active',
            language: 'ar'
        }
    ];

    for (const course of courses) {
        const exists = await prisma.trainingCourse.findFirst({
            where: { title: course.title }
        });

        if (!exists) {
            await prisma.trainingCourse.create({
                data: {
                    ...course,
                    updatedAt: new Date() // Ensure updatedAt is set
                }
            });
            console.log(`Created course: ${course.title}`);
        } else {
            console.log(`Course exists: ${course.title}`);
        }
    }

    console.log('Training Courses Seeding Completed.');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
