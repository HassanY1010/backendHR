import prisma from '../src/config/db.js';
import fs from 'fs';
import path from 'path';

async function phase1Check() {
    console.log('--- PHASE 1: MIGRATION HISTORY & FOLDERS VERIFICATION ---');

    // 1. Verify _prisma_migrations existence
    const tableCheck = await prisma.$queryRawUnsafe(`
        SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name='_prisma_migrations';
    `);
    const tableExists = Array.isArray(tableCheck) && tableCheck.length > 0;
    console.log(`_prisma_migrations table exists: ${tableExists}`);

    // 2. Verify all 16 migration folders
    const migrationsDir = path.resolve('prisma/migrations');
    const actualFolders = fs.readdirSync(migrationsDir)
        .filter(f => fs.statSync(path.join(migrationsDir, f)).isDirectory())
        .sort();

    const expectedFolders = [
        '20251226062947_init',
        '20251230055209_enable_task_cascade_delete',
        '20251230130024_add_training_feedback_fields',
        '20251231054228_add_interview_candidate_fields',
        '20260101052554_add_check_in_question_bank',
        '20260104045814_add_subscription_code',
        '20260105053637_add_attachments',
        '20260105175422_add_user_to_notification',
        '20260108043721_smart_training_manual',
        '20260108045159_add_training_details',
        '20260301073050_init_ats_pro_v1',
        '20260302124716_add_department_table_and_description',
        '20260310083007_add_company_status',
        '20260616154455_add_initial_password',
        '20260616155808_add_user_initial_password',
        '20260822120000_add_ai_job_description_table'
    ];

    console.log(`Total Migration Folders Found: ${actualFolders.length} (Expected: 16)`);
    const isMatching = actualFolders.length === 16 && expectedFolders.every((f, i) => actualFolders[i] === f);
    console.log(`Migration Folders Exactly Match Expected List: ${isMatching}`);

    // Snapshot key tables row counts before baseline
    const companyCount = await prisma.company.count();
    const userCount = await prisma.user.count();
    const jobReqCount = await prisma.jobRequest.count();
    const aiJdCount = await prisma.aIJobDescription.count();

    console.log('\n--- PRE-BASELINE ROW COUNTS (DATA SAFETY BENCHMARK) ---');
    console.log(`Company count: ${companyCount}`);
    console.log(`User count: ${userCount}`);
    console.log(`JobRequest count: ${jobReqCount}`);
    console.log(`AIJobDescription count: ${aiJdCount}`);

    await prisma.$disconnect();
}

phase1Check().catch(console.error);
