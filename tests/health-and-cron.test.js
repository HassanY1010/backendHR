import request from 'supertest';
import app from '../src/app.js';

describe('Health, Readiness, and Cron Security Endpoints', () => {
    describe('GET /health', () => {
        it('should return 200 OK with lightweight status without any authentication', async () => {
            const res = await request(app).get('/health');
            expect(res.status).toBe(200);
            expect(res.body.status).toBe('ok');
            expect(res.body.service).toBe('hr-backend');
            expect(res.body.timestamp).toBeDefined();
        });

        it('should return 200 OK even if dummy Authorization header is sent', async () => {
            const res = await request(app)
                .get('/health')
                .set('Authorization', 'Bearer invalid-dummy-token');
            expect(res.status).toBe(200);
            expect(res.body.status).toBe('ok');
        });

        it('should return 200 OK without any session/cookies', async () => {
            const res = await request(app)
                .get('/health')
                .set('Cookie', '');
            expect(res.status).toBe(200);
            expect(res.body.status).toBe('ok');
        });
    });

    describe('GET /ready (Readiness Probe)', () => {
        it('should return 200 OK when database is accessible', async () => {
            const res = await request(app).get('/ready');
            expect(res.status).toBe(200);
            expect(res.body.status).toBe('ok');
            expect(res.body.database).toBe('connected');
        });

        it('should also respond at /api/ready alias', async () => {
            const res = await request(app).get('/api/ready');
            expect(res.status).toBe(200);
            expect(res.body.database).toBe('connected');
        });
    });

    describe('GET / (Root endpoint)', () => {
        it('should return 200 with platform info', async () => {
            const res = await request(app).get('/');
            expect(res.status).toBe(200);
            expect(res.body.message).toContain('AI HR Platform API');
            expect(res.body.status).toBe('UP');
        });
    });

    describe('Protected Cron Endpoint Security (/api/cron/trigger)', () => {
        it('should reject unauthenticated request with 401', async () => {
            const res = await request(app).post('/api/cron/trigger');
            expect(res.status).toBe(401);
            expect(res.body.status).toBe('error');
            expect(res.body.message).toContain('Unauthorized');
        });

        it('should reject invalid cron secret with 401', async () => {
            const res = await request(app)
                .post('/api/cron/trigger')
                .set('Authorization', 'Bearer wrong-secret');
            expect(res.status).toBe(401);
            expect(res.body.status).toBe('error');
        });

        it('should succeed with valid Bearer secret header', async () => {
            const res = await request(app)
                .post('/api/cron/trigger')
                .set('Authorization', 'Bearer test-cron-secret-key-123');
            expect(res.status).toBe(200);
            expect(res.body.status).toBe('ok');
            expect(res.body.message).toBe('Cron tasks executed successfully');
            expect(res.body.results).toBeDefined();
        });

        it('should succeed with valid x-cron-secret header', async () => {
            const res = await request(app)
                .get('/api/cron/trigger')
                .set('x-cron-secret', 'test-cron-secret-key-123');
            expect(res.status).toBe(200);
            expect(res.body.status).toBe('ok');
        });
    });

    describe('Authentication & RBAC Regression Check', () => {
        it('should NOT allow unauthenticated access to protected user routes', async () => {
            const res = await request(app).get('/api/users');
            expect(res.status).toBe(401);
        });

        it('should NOT allow unauthenticated access to admin routes', async () => {
            const res = await request(app).get('/api/admin/companies');
            expect(res.status).toBe(401);
        });

        it('should NOT allow unauthenticated access to employee routes', async () => {
            const res = await request(app).get('/api/employees');
            expect(res.status).toBe(401);
        });
    });
});
