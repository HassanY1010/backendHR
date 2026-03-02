// check_production_schema.js
import fs from 'fs';
import path from 'path';
import { PrismaClient } from '@prisma/client';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const prisma = new PrismaClient();
const MIGRATIONS_DIR = path.join(__dirname, 'prisma', 'migrations');

async function getMigrationTablesAndColumns() {
  const migrations = fs.readdirSync(MIGRATIONS_DIR).filter(f => fs.statSync(path.join(MIGRATIONS_DIR, f)).isDirectory());
  const tables = {};

  for (const migration of migrations) {
    const sqlPath = path.join(MIGRATIONS_DIR, migration, 'migration.sql');
    if (!fs.existsSync(sqlPath)) continue;
    const sql = fs.readFileSync(sqlPath, 'utf8');

    // استخراج أسماء الجداول والأعمدة فقط، تجاهل CREATE INDEX وغيرها
    const tableRegex = /CREATE TABLE `?(\w+)`?\s*\(([\s\S]*?)\);/g;
    let match;
    while ((match = tableRegex.exec(sql)) !== null) {
      const tableName = match[1];
      const columnsSql = match[2];
      const columnRegex = /`(\w+)`/g;
      const columns = [];
      let colMatch;
      while ((colMatch = columnRegex.exec(columnsSql)) !== null) {
        columns.push(colMatch[1]);
      }
      tables[tableName] = columns;
    }
  }

  return tables;
}

async function tableExists(table) {
  const result = await prisma.$queryRawUnsafe(
    `SELECT COUNT(*) as count FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = ?`,
    table
  );
  return result[0].count > 0;
}

async function columnExists(table, column) {
  const result = await prisma.$queryRawUnsafe(
    `SELECT COUNT(*) as count FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = ? AND column_name = ?`,
    table, column
  );
  return result[0].count > 0;
}

async function main() {
  console.log('⚡ بدء فحص قاعدة البيانات الإنتاجية...');
  const tables = await getMigrationTablesAndColumns();

  for (const [table, columns] of Object.entries(tables)) {
    if (await tableExists(table)) {
      console.log(`✅ Table ${table} exists`);
      for (const column of columns) {
        if (await columnExists(table, column)) {
          console.log(`✅ Column ${column} exists in ${table}`);
        } else {
          console.log(`❌ Column ${column} missing in ${table} (لم يتم إنشاؤه لتجنب SQL المعقد)`);
        }
      }
    } else {
      console.log(`❌ Table ${table} missing (لم يتم إنشاؤه لتجنب SQL المعقد)`);
    }
  }

  console.log('✅ جميع الجداول والأعمدة تم فحصها.');
  await prisma.$disconnect();
}

main().catch(e => {
  console.error(e);
  prisma.$disconnect();
  process.exit(1);
});