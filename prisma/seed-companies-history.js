import prisma from '../src/config/db.js';

async function seedCompanies() {
    console.log('--- Starting Companies History Seed ---');

    try {
        // We don't want to delete all companies if they have users, but for a clean seed in this dev context:
        // Actually, let's just add new ones or update if possible. 
        // But for "Real Data" consistency, let's clear if no critical dependencies or just add 10 more.

        const industries = ['Technology', 'Healthcare', 'Finance', 'Education', 'Retail', 'Manufacturing'];
        const statuses = ['ACTIVE', 'INACTIVE', 'PENDING'];
        const plans = ['TRIAL', 'PRO', 'ENTERPRISE'];

        const companyData = [
            { name: 'TechFlow Solutions', website: 'techflow.ai', industry: 'Technology', size: 'Medium' },
            { name: 'HealthBridge Medical', website: 'healthbridge.org', industry: 'Healthcare', size: 'Large' },
            { name: 'FinEdge Capital', website: 'finedge.com', industry: 'Finance', size: 'Small' },
            { name: 'EduSmart Learning', website: 'edusmart.edu', industry: 'Education', size: 'Medium' },
            { name: 'Global Retail Corp', website: 'globalretail.com', industry: 'Retail', size: 'ExtraLarge' },
            { name: 'BuildRight Construction', website: 'buildright.com', industry: 'Manufacturing', size: 'Large' },
            { name: 'CloudScale Systems', website: 'cloudscale.io', industry: 'Technology', size: 'Medium' },
            { name: 'PureAqua Waters', website: 'pureaqua.com', industry: 'Retail', size: 'Small' },
            { name: 'SafeGuard Security', website: 'safeguard.net', industry: 'Technology', size: 'Medium' },
            { name: 'MediCare Plus', website: 'medicareplus.com', industry: 'Healthcare', size: 'Large' }
        ];

        console.log(`- Creating ${companyData.length} companies...`);

        for (const data of companyData) {
            const plan = plans[Math.floor(Math.random() * plans.length)];
            const status = statuses[Math.floor(Math.random() * statuses.length)];

            const company = await prisma.company.create({
                data: {
                    name: data.name,
                    website: data.website,
                    subscriptionStatus: status,
                    employeeLimit: data.size === 'Small' ? 20 : data.size === 'Medium' ? 100 : 500,
                    createdAt: new Date(Date.now() - Math.random() * 90 * 24 * 60 * 60 * 1000),
                    updatedAt: new Date()
                }
            });

            // Add a subscription
            await prisma.subscription.create({
                data: {
                    companyId: company.id,
                    plan: plan,
                    status: status === 'ACTIVE' ? 'ACTIVE' : 'INACTIVE',
                    startDate: company.createdAt,
                    endDate: new Date(company.createdAt.getTime() + 365 * 24 * 60 * 60 * 1000),
                    updatedAt: new Date()
                }
            });

            // Add some random users to each company to make userCount real
            const userCount = Math.floor(Math.random() * 15) + 1;
            for (let i = 0; i < userCount; i++) {
                await prisma.user.create({
                    data: {
                        email: `user${i}-${company.id.slice(0, 5)}@${data.website}`, // Ensure unique email
                        passwordHash: 'hashed_password',
                        name: `User ${i} from ${data.name}`,
                        role: i === 0 ? 'ADMIN' : 'EMPLOYEE',
                        companyId: company.id,
                        status: 'ACTIVE',
                        updatedAt: new Date()
                    }
                });
            }
        }

        console.log('--- Companies History Seed Completed ---');
    } catch (error) {
        console.error('Companies Seed Error:', error);
        process.exit(1);
    }
}

seedCompanies().finally(async () => await prisma.$disconnect());
