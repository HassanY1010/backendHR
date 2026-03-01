import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
    console.log('Seeding Product Metrics...');

    await prisma.productMetric.deleteMany();
    await prisma.productUsage.deleteMany();

    const metrics = [
        // KPI Cards
        { name: 'المستخدمون النشطون', category: 'USAGE', value: 12458, change: 18.2, trend: 'up', unit: 'users' },
        { name: 'معدل التفاعل', category: 'ENGAGEMENT', value: 68.5, change: 5.3, trend: 'up', unit: '%' },
        { name: 'الجلسات اليومية', category: 'USAGE', value: 45230, change: 12.1, trend: 'up', unit: 'sessions' },
        { name: 'متوسط وقت الجلسة', category: 'ENGAGEMENT', value: 24, change: 3.5, trend: 'up', unit: 'min' },

        // Feature Adoption
        { name: 'التوظيف الذكي', category: 'ADOPTION', value: 78, change: 4.2, trend: 'up', unit: '%', metadata: { activeUsers: 9720, totalUsers: 12458 } },
        { name: 'تقييم الأداء', category: 'ADOPTION', value: 65, change: 2.1, trend: 'up', unit: '%', metadata: { activeUsers: 8098, totalUsers: 12458 } },
        { name: 'إدارة المهام', category: 'ADOPTION', value: 92, change: 0.5, trend: 'stable', unit: '%', metadata: { activeUsers: 11461, totalUsers: 12458 } },
        { name: 'التدريب والتطوير', category: 'ADOPTION', value: 54, change: 8.4, trend: 'up', unit: '%', metadata: { activeUsers: 6727, totalUsers: 12458 } },

        // Engagement Details
        { name: 'معدل الاحتفاظ الشهري', category: 'ENGAGEMENT', value: 94.2, change: 2.1, trend: 'up', unit: '%' },
        { name: 'معدل الإكمال', category: 'ENGAGEMENT', value: 87.5, change: 4.3, trend: 'up', unit: '%' },
        { name: 'رضا المستخدمين', category: 'ENGAGEMENT', value: 4.6, change: 0.2, trend: 'up', unit: 'score' },

        // Performance
        { name: 'وقت التحميل', category: 'PERFORMANCE', value: 1.2, change: -15, trend: 'down', unit: 'sec', metadata: { target: 2.0, status: 'good' } },
        { name: 'معدل الأخطاء', category: 'PERFORMANCE', value: 0.3, change: -5, trend: 'down', unit: '%', metadata: { target: 1.0, status: 'good' } },
        { name: 'توفر النظام', category: 'PERFORMANCE', value: 99.9, change: 0, trend: 'stable', unit: '%', metadata: { target: 99.5, status: 'good' } }
    ];

    await prisma.productMetric.createMany({
        data: metrics
    });

    const usageHistory = [];
    const baseUsers = 10000;
    const baseSessions = 35000;

    for (let i = 29; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        date.setHours(0, 0, 0, 0);

        usageHistory.push({
            date,
            activeUsers: baseUsers + Math.floor(Math.random() * 3000) + (30 - i) * 100,
            sessions: baseSessions + Math.floor(Math.random() * 10000) + (30 - i) * 300,
            avgSessionDuration: 20 + Math.floor(Math.random() * 10)
        });
    }

    await prisma.productUsage.createMany({
        data: usageHistory
    });

    console.log('Product Metrics and History seeded!');
}

main()
    .catch(e => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
