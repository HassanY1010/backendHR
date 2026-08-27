import assert from 'assert';
import request from 'supertest';
import app from '../src/app.js';

async function runHealthAndCronTests() {
    console.log('🧪 Starting Health, Readiness, and Cron Security Verification...\n');
    let passed = 0;
    let failed = 0;

    const test = async (name, fn) => {
        try {
            await fn();
            console.log(`✅ PASS: ${name}`);
            passed++;
        } catch (err) {
            console.error(`❌ FAIL: ${name}`);
            console.error(`   Error: ${err.message}`);
            failed++;
        }
    };

    // 1. Health Check Test without Auth
    await test('GET /health returns 200 without Authorization', async () => {
        const res = await request(app).get('/health');
        assert.strictEqual(res.status, 200, `Expected 200 but got ${res.status}`);
        assert.strictEqual(res.body.status, 'ok');
        assert.strictEqual(res.body.service, 'hr-backend');
        assert.ok(res.body.timestamp, 'Timestamp should be present');
    });

    // 2. Health Check Test with Auth header
    await test('GET /health returns 200 even with arbitrary Authorization header', async () => {
        const res = await request(app)
            .get('/health')
            .set('Authorization', 'Bearer dummy-invalid-token');
        assert.strictEqual(res.status, 200);
        assert.strictEqual(res.body.status, 'ok');
    });

    // 3. Health Check Test without Session/Cookies
    await test('GET /health does not require cookies/session', async () => {
        const res = await request(app)
            .get('/health')
            .set('Cookie', '');
        assert.strictEqual(res.status, 200);
        assert.strictEqual(res.body.status, 'ok');
    });

    // 4. Root Endpoint Test
    await test('GET / returns 200 with platform info', async () => {
        const res = await request(app).get('/');
        assert.strictEqual(res.status, 200);
        assert.ok(res.body.message.includes('AI HR Platform API'));
        assert.strictEqual(res.body.status, 'UP');
    });

    // 5. Readiness Probe Test
    await test('GET /ready returns 200 when database is accessible', async () => {
        const res = await request(app).get('/ready');
        assert.strictEqual(res.status, 200);
        assert.strictEqual(res.body.status, 'ok');
        assert.strictEqual(res.body.database, 'connected');
    });

    // 6. Cron Security: Reject Unauthenticated
    await test('POST /api/cron/trigger rejects unauthenticated request with 401', async () => {
        const res = await request(app).post('/api/cron/trigger');
        assert.strictEqual(res.status, 401);
        assert.strictEqual(res.body.status, 'error');
    });

    // 7. Cron Security: Reject Invalid Secret
    await test('POST /api/cron/trigger rejects invalid secret with 401', async () => {
        const res = await request(app)
            .post('/api/cron/trigger')
            .set('Authorization', 'Bearer invalid-wrong-secret');
        assert.strictEqual(res.status, 401);
    });

    // 8. Cron Security: Accept Valid Bearer Secret
    await test('POST /api/cron/trigger executes jobs with valid Bearer secret', async () => {
        process.env.CRON_SECRET = 'valid-test-cron-secret-2026';
        const res = await request(app)
            .post('/api/cron/trigger')
            .set('Authorization', 'Bearer valid-test-cron-secret-2026');
        assert.strictEqual(res.status, 200);
        assert.strictEqual(res.body.status, 'ok');
        assert.strictEqual(res.body.message, 'Cron tasks executed successfully');
        assert.ok(res.body.results, 'Results object should be present');
    });

    // 9. Cron Security: Accept Valid x-cron-secret Header
    await test('GET /api/cron/trigger executes jobs with valid x-cron-secret header', async () => {
        process.env.CRON_SECRET = 'valid-test-cron-secret-2026';
        const res = await request(app)
            .get('/api/cron/trigger')
            .set('x-cron-secret', 'valid-test-cron-secret-2026');
        assert.strictEqual(res.status, 200);
        assert.strictEqual(res.body.status, 'ok');
    });

    // 10. Regression Check: Regular Protected Routes Still Enforce 401
    await test('Regression: GET /api/users rejects unauthenticated access with 401', async () => {
        const res = await request(app).get('/api/users');
        assert.strictEqual(res.status, 401);
    });

    await test('Regression: GET /api/employees rejects unauthenticated access with 401', async () => {
        const res = await request(app).get('/api/employees');
        assert.strictEqual(res.status, 401);
    });

    await test('Regression: GET /api/admin/companies rejects unauthenticated access with 401', async () => {
        const res = await request(app).get('/api/admin/companies');
        assert.strictEqual(res.status, 401);
    });

    console.log(`\n📊 Test Summary: ${passed} passed, ${failed} failed`);
    if (failed > 0) {
        process.exit(1);
    } else {
        console.log('🎉 All health check and cron security tests passed successfully!\n');
        process.exit(0);
    }
}

runHealthAndCronTests();
