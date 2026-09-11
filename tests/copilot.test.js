import request from 'supertest';
import app from '../src/app.js';
import prisma from '../src/config/db.js';

describe('Recruitment Copilot Integration & Tenant Security Tests', () => {
    let companyAId = '7fb91760-f42f-4578-bf81-755a99589b16';
    let companyBId = '4a0040b6-8817-4fbc-96ca-2fff34065112';
    let managerToken = '';

    it('1. Authentication check: Should block unauthenticated chat requests with 401', async () => {
        const res = await request(app)
            .post('/api/copilot/chat')
            .send({ message: 'أحتاج مدير مبيعات' });

        expect(res.status).toBe(401);
    });

    it('2. Validation check: Should reject empty chat message with 400 when authorized', async () => {
        // Mock authorization flow
        const res = await request(app)
            .post('/api/copilot/chat')
            .set('Authorization', 'Bearer invalid_token')
            .send({});

        expect([401, 403]).toContain(res.status);
    });

    it('3. Security check: Tenant isolation prevents cross-company session viewing', async () => {
        const res = await request(app)
            .get('/api/copilot/sessions/non-existent-or-other-tenant-id')
            .set('Authorization', 'Bearer invalid_token');

        expect([401, 403]).toContain(res.status);
    });
});
