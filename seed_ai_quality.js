import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
    console.log('Seeding AI Quality metrics...');

    await prisma.aIQualityMetric.deleteMany();

    await prisma.aIQualityMetric.createMany({
        data: [
            {
                modelName: 'HR Decision Model v1',
                accuracy: 87.5,
                precision: 85.2,
                recall: 89.1,
                latency: 156,
                costPerRequest: 0.85,
                status: 'production'
            },
            {
                modelName: 'Sentiment Analysis v2',
                accuracy: 92.3,
                precision: 90.5,
                recall: 94.2,
                latency: 89,
                costPerRequest: 0.65,
                status: 'production'
            },
            {
                modelName: 'CV Parser Model v1',
                accuracy: 89.1,
                precision: 87.4,
                recall: 91.2,
                latency: 210,
                costPerRequest: 1.40,
                status: 'beta'
            }
        ]
    });

    console.log('AI Quality seeded!');
}

main()
    .catch(e => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
