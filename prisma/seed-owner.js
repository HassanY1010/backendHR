import pkg from '@prisma/client';
import bcrypt from 'bcryptjs';

const { PrismaClient } = pkg;

const prisma = new PrismaClient();

async function main() {
    console.log('--- Seeding Owner Account ---');

    const email = 'admin1010@adminhr.com';
    const password = 'hhaall112233$';

    // تشفير كلمة المرور
    const passwordHash = await bcrypt.hash(password, 12);

    const user = await prisma.user.upsert({
        where: { email: email },
        update: {
            passwordHash: passwordHash,
            role: 'SUPER_ADMIN',
            status: 'ACTIVE',
            updatedAt: new Date()
        },
        create: {
            email: email,
            passwordHash: passwordHash,
            name: 'Project Owner',
            role: 'SUPER_ADMIN',
            status: 'ACTIVE',
            updatedAt: new Date()
        }
    });

    console.log(`✅ Success: Created/Updated Owner Account: ${user.email}`);
    console.log('--- Seed Completed ---');
}

main()
    .catch((e) => {
        console.error('❌ Error seeding owner account:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });