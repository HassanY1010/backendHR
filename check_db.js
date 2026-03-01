import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    try {
        const columns = await prisma.$queryRaw`SHOW COLUMNS FROM User`;
        console.log('Columns in User table:', JSON.stringify(columns, null, 2));

        console.log('Attempting prisma.user.findFirst()...');
        const user = await prisma.user.findFirst();
        console.log('Successfully fetched user:', user ? user.email : 'No users found');
    } catch (error) {
        console.error('Error during diagnostic:', error);
    } finally {
        await prisma.$disconnect();
    }
}

main();
