import prisma from '../src/config/db.js';

async function seedUsage() {
    console.log('--- Starting Seed Process (Total Accuracy Mode) ---');

    try {
        const totalUserCount = await prisma.user.count();
        console.log(`- Detected ${totalUserCount} total users in Database.`);

        console.log('1. Seeding ProductUsage...');
        const deletedUsage = await prisma.productUsage.deleteMany({});
        console.log(`- Cleared ${deletedUsage.count} existing usage records.`);

        const usageData = [];
        const now = new Date();
        for (let i = 30; i >= 0; i--) {
            const date = new Date(now);
            date.setDate(date.getDate() - i);
            date.setHours(0, 0, 0, 0);

            // Ensure activeUsers never exceeds 100% of headcount
            // Growth pattern: 20% to 80% of total users over 30 days
            const basePercentage = 0.2 + (0.6 * (30 - i) / 30);
            const targetUsers = Math.max(Math.floor(totalUserCount * basePercentage), 1);
            const randomness = Math.floor(Math.random() * 2);
            const activeUsers = Math.min(targetUsers + randomness, totalUserCount);

            usageData.push({
                date,
                activeUsers,
                sessions: Math.max(activeUsers, 1) * 2 + Math.floor(Math.random() * 2),
                avgSessionDuration: 8 + Math.floor(Math.random() * 12)
            });
        }

        const createdUsage = await prisma.productUsage.createMany({ data: usageData });
        console.log(`- Created ${createdUsage.count} ProductUsage records bounded by real headcount.`);

        console.log('2. Updating AuditLogs for consistency...');
        // Clear recent logs to align with our new seed
        await prisma.auditLog.deleteMany({
            where: { timestamp: { gte: new Date(Date.now() - 48 * 60 * 60 * 1000) }, action: 'LOGIN' }
        });

        const users = await prisma.user.findMany({ take: totalUserCount });
        if (users.length > 0) {
            const logEntries = [];
            // Last 24h: 50%-80% of users logging in
            const activeNow = Math.ceil(totalUserCount * 0.7);
            for (let i = 0; i < activeNow; i++) {
                const user = users[i % users.length];
                logEntries.push({
                    userId: user.id,
                    action: 'LOGIN',
                    details: 'Real-time login sync',
                    timestamp: new Date(Date.now() - Math.random() * 24 * 60 * 60 * 1000),
                    actionType: 'SYSTEM',
                    severity: 'INFO',
                    status: 'SUCCESS'
                });

                // Also update lastLogin for KPI consistency
                await prisma.user.update({
                    where: { id: user.id },
                    data: { lastLogin: new Date(Date.now() - Math.random() * 12 * 60 * 60 * 1000) }
                });
            }
            await prisma.auditLog.createMany({ data: logEntries });
            console.log(`- Created ${logEntries.length} consistent activity logs.`);
        }

        console.log('--- Seed Process Completed Successfully ---');
    } catch (error) {
        console.error('--- SEED PROCESS FAILED ---');
        console.error(error);
        process.exit(1);
    }
}

seedUsage()
    .finally(async () => await prisma.$disconnect());
