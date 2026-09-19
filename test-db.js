import dotenv from 'dotenv';
dotenv.config();
import prisma from './src/config/db.js';

async function checkUser() {
    try {
        const u = await prisma.user.findUnique({
            where: { email: 'p4-man-a@test.com' },
            include: { company: true }
        });
        console.log('USER:', u);
    } catch (e) {
        console.error('ERR:', e.message);
    } finally {
        await prisma.$disconnect();
    }
}
checkUser();
