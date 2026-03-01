import prisma from '../src/config/db.js';

async function seedAIQuality() {
    console.log('--- Starting AI Quality Seed ---');

    try {
        await prisma.aIQualityMetric.deleteMany({});
        console.log('- Cleared existing AI metrics.');

        const metrics = [
            {
                id: 'gpt-4o-production',
                modelName: 'GPT-4o (Primary)',
                accuracy: 94.5,
                precision: 92.8,
                recall: 91.2,
                latency: 450,
                costPerRequest: 0.015,
                status: 'production',
                lastUpdated: new Date()
            },
            {
                id: 'gpt-4o-mini-production',
                modelName: 'GPT-4o Mini (Speed)',
                accuracy: 89.2,
                precision: 88.5,
                recall: 87.8,
                latency: 180,
                costPerRequest: 0.002,
                status: 'production',
                lastUpdated: new Date()
            },
            {
                id: 'gpt-4o-experimental',
                modelName: 'GPT-4o (Refined)',
                accuracy: 96.1,
                precision: 95.4,
                recall: 94.0,
                latency: 520,
                costPerRequest: 0.015,
                status: 'experimental',
                lastUpdated: new Date()
            }
        ];

        for (const metric of metrics) {
            await prisma.aIQualityMetric.create({ data: metric });
        }

        console.log(`- Created ${metrics.length} AI quality baseline records.`);
        console.log('--- AI Quality Seed Completed ---');
    } catch (error) {
        console.error('AI Seed Error:', error);
        process.exit(1);
    }
}

seedAIQuality().finally(async () => await prisma.$disconnect());
