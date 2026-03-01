import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('--- Seeding Default Super Admin ---');

    const email = 'adminPro@adminPro.com';
    const password = 'hhaall112233$';

    // 1. Remove existing super admins to ensure uniqueness
    await prisma.user.deleteMany({
        where: {
            role: 'SUPER_ADMIN'
        }
    });

    // 2. Create the new super admin
    const admin = await prisma.user.create({
        data: {
            email: email,
            passwordHash: password, // Note: auth.controller uses plain text comparison
            name: 'System Super Admin',
            role: 'SUPER_ADMIN',
            status: 'ACTIVE',
            updatedAt: new Date()
        }
    });

    console.log(`Created Super Admin: ${admin.email}`);
    console.log('--- Seed Completed ---');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
