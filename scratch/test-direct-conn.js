import dotenv from 'dotenv';
import pkg from 'pg';
const { Client } = pkg;

dotenv.config();

async function testDirectConnection() {
    console.log('--- TESTING SUPABASE DIRECT POSTGRESQL CONNECTION (READ-ONLY) ---');
    
    // In Supabase, the direct connection host is db.<project-ref>.supabase.co:5432 or aws-0-ap-southeast-1.pooler.supabase.com:5432 (session mode)
    const poolerUrl = process.env.DATABASE_URL;
    const parsed = new URL(poolerUrl);

    // Derive direct hosts to test:
    // Option A: Session mode on Supabase pooler (Port 5432 instead of 6543)
    const sessionModeUrl = poolerUrl.replace(':6543', ':5432').replace('pgbouncer=true', 'pgbouncer=false');
    
    // Option B: Direct DB domain db.gmlikzttxibbfelpmzeo.supabase.co:5432
    const projectRef = 'gmlikzttxibbfelpmzeo';
    const directDomainUrl = `postgresql://${parsed.username}:${parsed.password}@db.${projectRef}.supabase.co:5432/postgres?schema=public&sslmode=require`;

    console.log(`Target Database: ${parsed.pathname.replace('/', '')}`);
    console.log(`Project Ref: ${projectRef}`);

    // Test Option A: Session Mode on Pooler (:5432)
    console.log('\n[Test 1] Testing Pooler Session Mode (:5432)...');
    try {
        const client1 = new Client({ connectionString: sessionModeUrl, ssl: { rejectUnauthorized: false } });
        await client1.connect();
        const res1 = await client1.query('SELECT version(), current_user, current_database(), current_schema()');
        console.log('✅ Option A Connected Successfully!');
        console.log(`Server: ${res1.rows[0].version.split(' ')[0]} ${res1.rows[0].version.split(' ')[1]}`);
        console.log(`Current User: ${res1.rows[0].current_user}`);
        console.log(`Database: ${res1.rows[0].current_database}`);
        console.log(`Schema: ${res1.rows[0].current_schema}`);
        await client1.end();
    } catch (err) {
        console.log('❌ Option A Failed:', err.message);
    }

    // Test Option B: Direct Domain (:5432)
    console.log('\n[Test 2] Testing Direct DB Domain (db.project-ref.supabase.co:5432)...');
    try {
        const client2 = new Client({ connectionString: directDomainUrl, ssl: { rejectUnauthorized: false } });
        await client2.connect();
        const res2 = await client2.query('SELECT version(), current_user, current_database(), current_schema()');
        console.log('✅ Option B Connected Successfully!');
        console.log(`Server: ${res2.rows[0].version.split(' ')[0]} ${res2.rows[0].version.split(' ')[1]}`);
        console.log(`Current User: ${res2.rows[0].current_user}`);
        console.log(`Database: ${res2.rows[0].current_database}`);
        console.log(`Schema: ${res2.rows[0].current_schema}`);
        await client2.end();
    } catch (err) {
        console.log('❌ Option B Failed (likely IPv6 direct or restricted):', err.message);
    }
}

testDirectConnection();
