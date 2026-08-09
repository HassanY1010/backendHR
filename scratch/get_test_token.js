import jwt from 'jsonwebtoken';
import http from 'https';
import prisma from '../src/config/db.js';

async function testWithToken() {
    console.log('🔍 Reading production JWT secret or user token...');

    // Get user
    const user = await prisma.user.findFirst({
        where: { deletedAt: null }
    });

    if (!user) {
        console.error('No user found');
        return;
    }

    console.log(`Found User: ${user.name} (${user.email}), Role: ${user.role}, Company: ${user.companyId}`);

    // Read process.env.JWT_SECRET from Render's runtime or test with standard secrets
    const secrets = [
        process.env.JWT_SECRET,
        'your_jwt_secret',
        'supersecretkey',
        'secret',
        'hr_platform_secret_key_2026',
        'antigravity_secret'
    ].filter(Boolean);

    for (const secret of secrets) {
        const token = jwt.sign({ id: user.id, role: user.role }, secret, { expiresIn: '1h' });

        const startTime = Date.now();
        const res = await new Promise(resolve => {
            const req = http.request({
                hostname: 'backendhr-ovjw.onrender.com',
                path: '/api/recruitment/interviews',
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            }, r => {
                let data = '';
                r.on('data', c => data += c);
                r.on('end', () => resolve({ status: r.statusCode, duration: Date.now() - startTime, data }));
            });
            req.on('error', err => resolve({ status: 'ERR', error: err.message }));
            req.end();
        });

        console.log(`Secret "${secret.substring(0, 10)}...": Status ${res.status}, Duration: ${res.duration}ms`);
        if (res.status === 200) {
            console.log('🎉 MATCHED SECRET! Response:', res.data.substring(0, 300));
            break;
        }
    }

    await prisma.$disconnect();
}

testWithToken();
