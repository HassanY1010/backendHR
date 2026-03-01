import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
    console.log('Seeding roadmap data...');

    // Clear existing
    await prisma.roadmapItem.deleteMany();
    await prisma.milestone.deleteMany();
    await prisma.platformFeature.deleteMany();

    // Milestones
    await prisma.milestone.createMany({
        data: [
            {
                name: 'الربع الأول 2025',
                description: 'إطلاق الميزات الأساسية للنسخة 2.0',
                targetDate: new Date('2025-03-31'),
                status: 'current',
                progress: 65,
                features: 12
            },
            {
                name: 'الربع الثاني 2025',
                description: 'توسيع التطبيق للأجهزة المحمولة',
                targetDate: new Date('2025-06-30'),
                status: 'upcoming',
                progress: 15,
                features: 8
            }
        ]
    });

    // Roadmap Items
    await prisma.roadmapItem.createMany({
        data: [
            {
                title: 'تحسين محرك التوظيف الذكي',
                description: 'تطوير خوارزميات الذكاء الاصطناعي لمطابقة أفضل بين المرشحين والوظائف',
                status: 'in-progress',
                priority: 'high',
                startDate: new Date('2024-12-01'),
                endDate: new Date('2025-02-28'),
                progress: 45,
                category: 'AI & ML',
                assignedTo: 'فريق الذكاء الاصطناعي'
            },
            {
                title: 'تطبيق الجوال - نسخة iOS',
                description: 'إطلاق تطبيق iOS للموظفين والمديرين',
                status: 'planned',
                priority: 'high',
                startDate: new Date('2025-01-15'),
                endDate: new Date('2025-04-30'),
                progress: 0,
                category: 'Mobile',
                assignedTo: 'فريق التطوير'
            }
        ]
    });

    console.log('Roadmap seeded!');
}

main()
    .catch(e => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
