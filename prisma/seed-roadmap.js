import prisma from '../src/config/db.js';

async function seedRoadmap() {
    console.log('--- Starting Roadmap Seed ---');

    try {
        // Clear existing data
        await prisma.roadmapItem.deleteMany({});
        await prisma.milestone.deleteMany({});
        await prisma.platformFeature.deleteMany({});
        console.log('- Cleared existing roadmap data.');

        // 1. Seed Milestones
        const milestones = [
            {
                name: 'إطلاق النسخة التجريبية (V1.0)',
                description: 'إطلاق النظام مع الميزات الأساسية لإدارة الموارد البشرية والتوظيف.',
                targetDate: new Date('2025-12-01'),
                status: 'completed',
                progress: 100,
                features: 12
            },
            {
                name: 'تكامل الذكاء الاصطناعي الاستراتيجي (Q1 2026)',
                description: 'إضافة ميزات التحليل المتقدم للمرشحين وتوقع مخاطر استقالة الموظفين.',
                targetDate: new Date('2026-03-30'),
                status: 'current',
                progress: 65,
                features: 8
            },
            {
                name: 'التوسع العالمي ودعم اللغات المتعددة (Q2 2026)',
                description: 'دعم أنظمة قانونية وضرائبية لدول إضافية وتحسين واجهة المستخدم.',
                targetDate: new Date('2026-06-15'),
                status: 'upcoming',
                progress: 15,
                features: 10
            }
        ];

        for (const m of milestones) {
            await prisma.milestone.create({
                data: { ...m, updatedAt: new Date() }
            });
        }
        console.log(`- Created ${milestones.length} milestones.`);

        // 2. Seed Roadmap Items
        const roadmapItems = [
            {
                title: 'نظام التقييم الذكي للمرشحين (V2)',
                description: 'تطوير خوارزميات جديدة لتقييم الملاءمة الثقافية والتقنية للمرشحين بناءً على بيانات الشركة.',
                status: 'in-progress',
                priority: 'high',
                startDate: new Date('2026-01-01'),
                endDate: new Date('2026-02-28'),
                progress: 85,
                category: 'AI / Recruitment',
                assignedTo: 'فريق الذكاء الاصطناعي'
            },
            {
                title: 'لوحة تحكم إحصائيات الموظفين المتقدمة',
                description: 'توفير رؤى بيانية حول إنتاجية الأقسام وتوزيع المهارات داخل المؤسسة.',
                status: 'in-progress',
                priority: 'medium',
                startDate: new Date('2026-01-15'),
                endDate: new Date('2026-03-15'),
                progress: 40,
                category: 'Analytics',
                assignedTo: 'فريق البيانات'
            },
            {
                title: 'تطبيق الهاتف المحمول للمديرين',
                description: 'إطلاق تطبيق خاص للمديرين لمتابعة الموافقات والتقارير أثناء التنقل.',
                status: 'planned',
                priority: 'critical',
                startDate: new Date('2026-03-01'),
                endDate: new Date('2026-05-30'),
                progress: 0,
                category: 'Mobile',
                assignedTo: 'فريق الهواتف'
            },
            {
                title: 'تحسين نظام الحماية والخصوصية (GDPR)',
                description: 'تحديث كافة بروتوكولات معالجة البيانات لتتوافق مع المعايير الدولية للخصوصية.',
                status: 'completed',
                priority: 'high',
                startDate: new Date('2025-11-01'),
                endDate: new Date('2025-12-30'),
                progress: 100,
                category: 'Security',
                assignedTo: 'فريق الأمان'
            }
        ];

        for (const item of roadmapItems) {
            await prisma.roadmapItem.create({
                data: { ...item, updatedAt: new Date() }
            });
        }
        console.log(`- Created ${roadmapItems.length} roadmap items.`);

        // 3. Seed Platform Features (Votes)
        const features = [
            { name: 'تكامل مع LinkedIn Jobs', status: 'planned', votes: 145 },
            { name: 'مولد عقود العمل التلقائي', status: 'planned', votes: 98 },
            { name: 'تتبع الحضور عبر الموقع الجغرافي', status: 'planned', votes: 210 },
            { name: 'نظام الدردشة الداخلية للشركات', status: 'planned', votes: 67 }
        ];

        for (const f of features) {
            await prisma.platformFeature.create({
                data: { ...f, updatedAt: new Date() }
            });
        }
        console.log(`- Created ${features.length} platform features.`);

        console.log('--- Roadmap Seed Completed ---');
    } catch (error) {
        console.error('Roadmap Seed Error:', error);
        process.exit(1);
    }
}

seedRoadmap().finally(async () => await prisma.$disconnect());
