import prisma from '../src/config/db.js';
import fs from 'fs';
import path from 'path';

async function performBaselineAnalysis() {
    console.log('Starting Migration Baseline Analysis (Read-Only)...');
    const migrationsDir = path.resolve('prisma/migrations');
    const migrationFolders = fs.readdirSync(migrationsDir)
        .filter(f => fs.statSync(path.join(migrationsDir, f)).isDirectory())
        .sort();

    console.log(`Found ${migrationFolders.length} migration folders in total.`);

    // 1. Fetch current tables and columns in PostgreSQL public schema
    const tablesData = await prisma.$queryRawUnsafe(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        ORDER BY table_name;
    `);
    const dbTables = tablesData.map(t => t.table_name.toLowerCase());

    const columnsData = await prisma.$queryRawUnsafe(`
        SELECT table_name, column_name, data_type 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
        ORDER BY table_name, column_name;
    `);

    const dbColumnsMap = {};
    columnsData.forEach(c => {
        const tbl = c.table_name.toLowerCase();
        if (!dbColumnsMap[tbl]) dbColumnsMap[tbl] = new Set();
        dbColumnsMap[tbl].add(c.column_name.toLowerCase());
    });

    const analysisReport = [];

    for (const folder of migrationFolders) {
        const migrationSqlPath = path.join(migrationsDir, folder, 'migration.sql');
        if (!fs.existsSync(migrationSqlPath)) {
            analysisReport.push({
                name: folder,
                status: 'UNKNOWN',
                details: 'Missing migration.sql file'
            });
            continue;
        }

        const sql = fs.readFileSync(migrationSqlPath, 'utf8');

        // Check key elements inside this migration against DB
        let isApplied = true;
        const reasons = [];

        // Check created tables
        const createTableMatches = [...sql.matchAll(/CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:public\.)?"?([a-zA-Z0-9_]+)"?/gi)];
        for (const match of createTableMatches) {
            const tblName = match[1].toLowerCase();
            if (!dbTables.includes(tblName)) {
                isApplied = false;
                reasons.push(`Table '${tblName}' does not exist in DB`);
            }
        }

        // Check added columns
        const addColumnMatches = [...sql.matchAll(/ALTER\s+TABLE\s+(?:public\.)?"?([a-zA-Z0-9_]+)"?\s+ADD\s+COLUMN\s+(?:IF\s+NOT\s+EXISTS\s+)?"?([a-zA-Z0-9_]+)"?/gi)];
        for (const match of addColumnMatches) {
            const tblName = match[1].toLowerCase();
            const colName = match[2].toLowerCase();
            if (!dbColumnsMap[tblName] || !dbColumnsMap[tblName].has(colName)) {
                isApplied = false;
                reasons.push(`Column '${colName}' on table '${tblName}' does not exist in DB`);
            }
        }

        analysisReport.push({
            name: folder,
            status: isApplied ? 'APPLIED' : 'NOT APPLIED',
            details: isApplied ? 'All DDL objects exist in active DB' : reasons.join('; ')
        });
    }

    console.log('\n================================================================================');
    console.log('📋 BASELINE ANALYSIS RESULTS (READ-ONLY)');
    console.log('================================================================================\n');
    console.table(analysisReport);
    console.log(`\nTotal DB Tables in PostgreSQL public schema: ${dbTables.length}`);

    await prisma.$disconnect();
}

performBaselineAnalysis().catch(err => {
    console.error('Error during analysis:', err);
    process.exit(1);
});
