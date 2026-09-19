import prisma from '../src/config/db.js';
import app from '../src/app.js';

test('direct upsert company in jest', async () => {
    const compA = await prisma.company.upsert({
        where: { id: 'phase3-test-company-a' },
        update: {},
        create: {
            id: 'phase3-test-company-a',
            name: 'شركة المرحلة الثالثة A',
            subscriptionStatus: 'ACTIVE',
            status: 'active'
        }
    });
    console.log('UPSERT RESULT:', compA.id);
    expect(compA.id).toBe('phase3-test-company-a');
}, 30000);
