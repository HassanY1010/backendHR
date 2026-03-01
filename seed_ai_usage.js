import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
    console.log('Seeding AI Usage data...');

    const companies = await prisma.company.findMany();

    if (companies.length === 0) {
        console.log('No companies found. Please seed companies first.');
        return;
    }

    // Create some usage logs for each company
    for (const company of companies) {
        await prisma.aIUsageLog.createMany({
            data: [
                {
                    companyId: company.id,
                    service: 'recruitment',
                    model: 'gpt-4',
                    tokens: Math.floor(Math.random() * 5000) + 1000,
                    cost: Math.random() * 0.5 + 0.1,
                    prompt: 'Analyze candidate for software engineer role',
                    response: 'Candidate is strong in React but weak in Node.js'
                },
                {
                    companyId: company.id,
                    service: 'training',
                    model: 'gpt-3.5-turbo',
                    tokens: Math.floor(Math.random() * 2000) + 500,
                    cost: Math.random() * 0.1,
                    prompt: 'Generate training plan for new hires',
                    response: 'Day 1: Introduction to company culture...'
                }
            ]
        });
    }

    console.log('AI Usage seeded!');
}

main()
    .catch(e => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
