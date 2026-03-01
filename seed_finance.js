import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
    console.log('Seeding Finance Data...');

    await prisma.financialTransaction.deleteMany();
    await prisma.financeMetric.deleteMany();

    // Seed Transactions (Income)
    const incomeTransactions = [
        { amount: 250000, type: 'INCOME', category: 'SUBSCRIPTIONS', description: 'Monthly Subscription Revenue - Dec', date: new Date('2024-12-01') },
        { amount: 215000, type: 'INCOME', category: 'SUBSCRIPTIONS', description: 'Monthly Subscription Revenue - Nov', date: new Date('2024-11-01') },
        { amount: 198000, type: 'INCOME', category: 'SUBSCRIPTIONS', description: 'Monthly Subscription Revenue - Oct', date: new Date('2024-10-01') },
        { amount: 185000, type: 'INCOME', category: 'SUBSCRIPTIONS', description: 'Monthly Subscription Revenue - Sep', date: new Date('2024-09-01') },
    ];

    // Seed Transactions (Expenses)
    const expenseTransactions = [
        { amount: 95000, type: 'EXPENSE', category: 'SALARIES', description: 'Payroll - Dec', date: new Date('2024-12-25') },
        { amount: 35000, type: 'EXPENSE', category: 'INFRASTRUCTURE', description: 'AWS/Cloud Hosting', date: new Date('2024-12-15') },
        { amount: 28000, type: 'EXPENSE', category: 'MARKETING', description: 'Social Media Ads', date: new Date('2024-12-10') },
        { amount: 32000, type: 'EXPENSE', category: 'DEVELOPMENT', description: 'External Contractors', date: new Date('2024-12-05') },
        { amount: 15000, type: 'EXPENSE', category: 'OTHER', description: 'Office Supplies & Misc', date: new Date('2024-12-01') },

        { amount: 92000, type: 'EXPENSE', category: 'SALARIES', description: 'Payroll - Nov', date: new Date('2024-11-25') },
        { amount: 34000, type: 'EXPENSE', category: 'INFRASTRUCTURE', description: 'Cloud Services', date: new Date('2024-11-15') },
        { amount: 25000, type: 'EXPENSE', category: 'MARKETING', description: 'Marketing Campaign', date: new Date('2024-11-10') },
    ];

    await prisma.financialTransaction.createMany({
        data: [...incomeTransactions, ...expenseTransactions]
    });

    // Seed Metrics
    await prisma.financeMetric.createMany({
        data: [
            { name: 'Monthly Revenue Growth', value: 16.2, change: 2.1, trend: 'up' },
            { name: 'Customer Acquisition Cost', value: 450, change: -15, trend: 'down' },
            { name: 'Burn Rate', value: 205000, change: 5.4, trend: 'stable' }
        ]
    });

    console.log('Finance Data seeded!');
}

main()
    .catch(e => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
