import dotenv from 'dotenv';
dotenv.config();

function verifyTargetDb() {
    const urlStr = process.env.DATABASE_URL;
    if (!urlStr) {
        console.error('DATABASE_URL is not set!');
        process.exit(1);
    }

    try {
        const url = new URL(urlStr);
        console.log('--- TARGET DATABASE VERIFICATION (SAFE & MASKED) ---');
        console.log(`Host: ${url.hostname}`);
        console.log(`Port: ${url.port}`);
        console.log(`Database Name: ${url.pathname.replace('/', '')}`);
        console.log(`Schema: ${url.searchParams.get('schema') || 'public'}`);
        console.log(`Environment: ${process.env.NODE_ENV || 'production'}`);
        console.log(`Protocol: ${url.protocol}`);
        console.log('Verified: YES');
    } catch (e) {
        console.error('Error parsing DATABASE_URL:', e.message);
        process.exit(1);
    }
}

verifyTargetDb();
