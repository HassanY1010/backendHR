import prisma from '../src/config/db.js';

async function seedAIUsage() {
    console.log('--- Starting AI Usage History Seed ---');

    try {
        const companies = await prisma.company.findMany();
        if (companies.length === 0) {
            console.log('No companies found. Please seed companies first.');
            return;
        }

        console.log(`- Found ${companies.length} companies. Clearing old logs...`);
        await prisma.aIUsageLog.deleteMany({});

        const logs = [];
        const now = new Date();
        const models = ['gpt-4o', 'gpt-4o-mini'];
        const services = ['recruitment', 'check-in', 'standard-analysis'];

        // Generate logs for the last 30 days
        for (let i = 0; i < 30; i++) {
            const date = new Date(now);
            date.setDate(date.getDate() - i);

            for (const company of companies) {
                // Random number of requests per day per company
                const dailyRequests = Math.floor(Math.random() * 10) + 2;

                for (let j = 0; j < dailyRequests; j++) {
                    const model = models[Math.floor(Math.random() * models.length)];
                    const service = services[Math.floor(Math.random() * services.length)];
                    const tokens = model === 'gpt-4o' ?
                        Math.floor(Math.random() * 2000) + 500 :
                        Math.floor(Math.random() * 800) + 100;

                    const cost = model === 'gpt-4o' ?
                        (tokens / 1000) * 0.03 :
                        (tokens / 1000) * 0.002;

                    logs.push({
                        companyId: company.id,
                        model,
                        service,
                        tokens,
                        cost,
                        timestamp: new Date(date.getTime() + Math.random() * 24 * 60 * 60 * 1000)
                    });
                }
            }
        }

        console.log(`- Creating ${logs.length} logs...`);

        // Chunking inserts to avoid overwhelming the DB
        const chunkSize = 100;
        for (let i = 0; i < logs.length; i += chunkSize) {
            await prisma.aIUsageLog.createMany({
                data: logs.slice(i, i + chunkSize)
            });
        }

        console.log('--- AI Usage History Seed Completed ---');
    } catch (error) {
        console.error('AI Usage Seed Error:', error);
        process.exit(1);
    }
}

seedAIUsage().finally(async () => await prisma.$disconnect());
