import prisma from '../src/config/db.js';

async function checkMigrationHistory() {
    console.log('--- 1. Checking _prisma_migrations table existence ---');
    try {
        const tableCheck = await prisma.$queryRawUnsafe(`
            SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name='_prisma_migrations';
        `);
        console.log('Result for _prisma_migrations existence:', JSON.stringify(tableCheck));

        if (Array.isArray(tableCheck) && tableCheck.length > 0) {
            console.log('--- 2. Fetching records from _prisma_migrations ---');
            const records = await prisma.$queryRawUnsafe(`
                SELECT id, migration_name, finished_at, applied_steps_count, rolled_back_at FROM public._prisma_migrations ORDER BY started_at DESC LIMIT 15;
            `);
            console.log('Recent migrations in DB:', JSON.stringify(records, null, 2));
        } else {
            console.log('STATUS: _prisma_migrations table does NOT exist in public schema.');
        }

        // Also check if it exists in any other schema (e.g. prisma, supabase_migrations)
        const allSchemasCheck = await prisma.$queryRawUnsafe(`
            SELECT table_schema, table_name FROM information_schema.tables WHERE table_name LIKE '%migration%';
        `);
        console.log('All migration tables across schemas:', JSON.stringify(allSchemasCheck, null, 2));

    } catch (err) {
        console.error('Error querying migration history:', err.message);
    } finally {
        await prisma.$disconnect();
    }
}

checkMigrationHistory();
