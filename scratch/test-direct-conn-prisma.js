import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';

dotenv.config();

async function testDirectConnectionWithPrisma() {
    console.log('--- TESTING SUPABASE DIRECT / SESSION MODE CONNECTION (READ-ONLY) ---');
    
    const poolerUrl = process.env.DATABASE_URL;
    const parsed = new URL(poolerUrl);
    const projectRef = 'gmlikzttxibbfelpmzeo';

    // Option A: Supabase Pooler in Session Mode (Port 5432)
    const sessionModeUrl = poolerUrl.replace(':6543', ':5432').replace('pgbouncer=true', 'pgbouncer=false');

    // Option B: Direct DB Domain (Port 5432)
    const directDomainUrl = `postgresql://${parsed.username}:${parsed.password}@db.${projectRef}.supabase.co:5432/postgres?schema=public&sslmode=require`;

    console.log(`[Target DB]: ${parsed.pathname.replace('/', '')}`);
    console.log(`[Project Ref]: ${projectRef}`);

    console.log('\n[Test 1] Testing Session Mode Connection (:5432 on pooler)...');
    try {
        const prismaA = new PrismaClient({
            datasources: { db: { url: sessionModeUrl } }
        });
        const resA = await prismaA.$queryRawUnsafe('SELECT version(), current_user, current_database(), current_schema()');
        console.log('✅ Option A (Pooler Session Mode :5432) CONNECTED SUCCESSFULLY!');
        console.log(`Server: ${resA[0].version.split(' ')[0]} ${resA[0].version.split(' ')[1]}`);
        console.log(`Current User: ${resA[0].current_user}`);
        console.log(`Database: ${resA[0].current_database}`);
        console.log(`Schema: ${resA[0].current_schema}`);
        await prismaA.$disconnect();
    } catch (err) {
        console.log('❌ Option A Failed:', err.message);
    }

    console.log('\n[Test 2] Testing Direct DB Domain (:5432 on db.project-ref)...');
    try {
        const prismaB = new PrismaClient({
            datasources: { db: { url: directDomainUrl } }
        });
        const resB = await prismaB.$queryRawUnsafe('SELECT version(), current_user, current_database(), current_schema()');
        console.log('✅ Option B (Direct Domain :5432) CONNECTED SUCCESSFULLY!');
        console.log(`Server: ${resB[0].version.split(' ')[0]} ${resB[0].version.split(' ')[1]}`);
        console.log(`Current User: ${resB[0].current_user}`);
        console.log(`Database: ${resB[0].current_database}`);
        console.log(`Schema: ${resB[0].current_schema}`);
        await prismaB.$disconnect();
    } catch (err) {
        console.log('❌ Option B Failed (IPv4/IPv6 direct restriction):', err.message);
    }
}

testDirectConnectionWithPrisma();
