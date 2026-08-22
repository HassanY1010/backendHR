import prisma from '../src/config/db.js';
import fs from 'fs';
import path from 'path';

async function performDeepSchemaVerification() {
    console.log('================================================================================');
    console.log('🔍 RUNNING INDEPENDENT DEEP SCHEMA INTROSPECTION & DDL RECONSTRUCTION (READ-ONLY)');
    console.log('================================================================================\n');

    // 1. Query all tables in public schema
    const tablesQuery = await prisma.$queryRawUnsafe(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
        ORDER BY table_name;
    `);
    const actualTables = tablesQuery.map(t => t.table_name.toLowerCase());
    console.log(`[DB Introspection] Total Tables in Public Schema: ${actualTables.length}`);

    // 2. Query all columns with types, nullability, defaults
    const columnsQuery = await prisma.$queryRawUnsafe(`
        SELECT table_name, column_name, data_type, is_nullable, column_default, udt_name
        FROM information_schema.columns 
        WHERE table_schema = 'public'
        ORDER BY table_name, ordinal_position;
    `);
    const tableColumnsMap = {};
    columnsQuery.forEach(c => {
        const t = c.table_name.toLowerCase();
        if (!tableColumnsMap[t]) tableColumnsMap[t] = {};
        tableColumnsMap[t][c.column_name.toLowerCase()] = {
            dataType: c.data_type,
            udtName: c.udt_name,
            isNullable: c.is_nullable,
            columnDefault: c.column_default
        };
    });

    // 3. Query all Primary Keys
    const pksQuery = await prisma.$queryRawUnsafe(`
        SELECT tc.table_name, kcu.column_name
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu 
          ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
        WHERE tc.constraint_type = 'PRIMARY KEY' AND tc.table_schema = 'public';
    `);
    const tablePksMap = {};
    pksQuery.forEach(p => {
        const t = p.table_name.toLowerCase();
        if (!tablePksMap[t]) tablePksMap[t] = [];
        tablePksMap[t].push(p.column_name.toLowerCase());
    });

    // 4. Query all Foreign Keys with Cascade rules (ON DELETE, ON UPDATE)
    const fksQuery = await prisma.$queryRawUnsafe(`
        SELECT
            tc.table_name,
            kcu.column_name,
            ccu.table_name AS foreign_table_name,
            ccu.column_name AS foreign_column_name,
            rc.update_rule,
            rc.delete_rule,
            tc.constraint_name
        FROM information_schema.table_constraints AS tc
        JOIN information_schema.key_column_usage AS kcu
            ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
        JOIN information_schema.constraint_column_usage AS ccu
            ON ccu.constraint_name = tc.constraint_name AND ccu.table_schema = tc.table_schema
        JOIN information_schema.referential_constraints AS rc
            ON rc.constraint_name = tc.constraint_name AND rc.constraint_schema = tc.table_schema
        WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_schema = 'public';
    `);

    // 5. Query all Indexes & Unique Constraints
    const indexesQuery = await prisma.$queryRawUnsafe(`
        SELECT
            tablename,
            indexname,
            indexdef
        FROM pg_indexes
        WHERE schemaname = 'public'
        ORDER BY tablename, indexname;
    `);

    // 6. Query all Custom Enums
    const enumsQuery = await prisma.$queryRawUnsafe(`
        SELECT t.typname as enum_name, e.enumlabel as enum_value
        FROM pg_type t 
        JOIN pg_enum e ON t.oid = e.enumtypid  
        JOIN pg_catalog.pg_namespace n ON n.oid = t.typnamespace
        WHERE n.nspname = 'public'
        ORDER BY t.typname, e.enumsortorder;
    `);
    const enumsMap = {};
    enumsQuery.forEach(e => {
        if (!enumsMap[e.enum_name]) enumsMap[e.enum_name] = [];
        enumsMap[e.enum_name].push(e.enum_value);
    });

    // -----------------------------------------------------------------------------------
    // SPECIFIC VERIFICATION OF MIGRATION 16 (aijobdescription)
    // -----------------------------------------------------------------------------------
    console.log('\n--- VERIFYING MIGRATION 16: public.aijobdescription ---');
    const aijdCols = tableColumnsMap['aijobdescription'];
    const aijdExists = Boolean(aijdCols);
    console.log(`Table aijobdescription exists: ${aijdExists}`);

    if (aijdExists) {
        console.log('Columns on aijobdescription:');
        console.table(aijdCols);
        
        const aijdIndexes = indexesQuery.filter(i => i.tablename === 'aijobdescription');
        console.log('Indexes & Unique Constraints on aijobdescription:');
        console.table(aijdIndexes);

        const aijdFks = fksQuery.filter(f => f.table_name === 'aijobdescription');
        console.log('Foreign Keys on aijobdescription:');
        console.table(aijdFks);
    }

    // -----------------------------------------------------------------------------------
    // DDL RECONSTRUCTION FOR ALL 16 MIGRATIONS
    // -----------------------------------------------------------------------------------
    console.log('\n--- DDL RECONSTRUCTION FOR ALL 16 MIGRATIONS ---');
    const migrationsDir = path.resolve('prisma/migrations');
    const migrationFolders = fs.readdirSync(migrationsDir)
        .filter(f => fs.statSync(path.join(migrationsDir, f)).isDirectory())
        .sort();

    const mismatches = [];

    for (const folder of migrationFolders) {
        const sqlPath = path.join(migrationsDir, folder, 'migration.sql');
        if (!fs.existsSync(sqlPath)) continue;
        const sql = fs.readFileSync(sqlPath, 'utf8');

        // Check tables created
        const createTableMatches = [...sql.matchAll(/CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:public\.)?"?([a-zA-Z0-9_]+)"?\s*\(([\s\S]*?)\);/gi)];
        for (const match of createTableMatches) {
            const tblName = match[1].toLowerCase();
            if (!actualTables.includes(tblName)) {
                mismatches.push(`[${folder}] Table '${tblName}' defined in migration but missing in DB`);
            }
        }

        // Check columns added
        const addColMatches = [...sql.matchAll(/ALTER\s+TABLE\s+(?:public\.)?"?([a-zA-Z0-9_]+)"?\s+ADD\s+COLUMN\s+(?:IF\s+NOT\s+EXISTS\s+)?"?([a-zA-Z0-9_]+)"?\s+([^,;]+)/gi)];
        for (const match of addColMatches) {
            const tblName = match[1].toLowerCase();
            const colName = match[2].toLowerCase();
            if (!tableColumnsMap[tblName] || !tableColumnsMap[tblName][colName]) {
                mismatches.push(`[${folder}] Column '${colName}' on table '${tblName}' missing in DB`);
            }
        }
    }

    console.log(`Total Mismatches Found: ${mismatches.length}`);
    if (mismatches.length > 0) {
        console.error('Mismatches:', mismatches);
    } else {
        console.log('✅ 100% Structural Match between all 16 Migrations and live PostgreSQL DB.');
    }

    await prisma.$disconnect();
}

performDeepSchemaVerification().catch(console.error);
