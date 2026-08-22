import prisma from '../src/config/db.js';
import crypto from 'crypto';

async function testPersist() {
    try {
        const comp = await prisma.company.create({ data: { name: 'TestPersist_' + Date.now(), status: 'ACTIVE' } });
        const user = await prisma.user.create({ data: { email: 'tp_' + Date.now() + '@test.com', name: 'TP', passwordHash: 'h', role: 'RECRUITER', status: 'ACTIVE', companyId: comp.id } });
        
        console.log('Testing create:');
        const res = await prisma.aIJobDescription.create({
            data: {
                id: crypto.randomUUID(),
                companyId: comp.id,
                jobTitle: 'Developer',
                generatedContent: { test: 1 },
                marketAnalysis: {},
                version: 1,
                createdBy: user.id
            }
        });
        console.log('✅ Created:', res.id);

        await prisma.aIJobDescription.delete({ where: { id: res.id } });
        await prisma.user.delete({ where: { id: user.id } });
        await prisma.company.delete({ where: { id: comp.id } });
    } catch (e) {
        console.error('Create error:', e);
    } finally {
        await prisma.$disconnect();
    }
}
testPersist();
