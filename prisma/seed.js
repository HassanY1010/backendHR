import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Cleaning up existing data...');
  await prisma.auditLog.deleteMany();
  await prisma.task.deleteMany();
  await prisma.employee.deleteMany();
  await prisma.user.deleteMany();
  await prisma.dailyQuestion.deleteMany();

  console.log('Seeding database with new admin account...');

  // 1. Create Default Company
  const companyName = 'Tech Corp';
  let company = await prisma.company.findFirst({ where: { name: companyName } });

  if (!company) {
    company = await prisma.company.create({
      data: {
        name: companyName,
        subscriptionStatus: 'ACTIVE',
        subscriptionExpiry: new Date(new Date().setFullYear(new Date().getFullYear() + 1)),
        updatedAt: new Date()
      }
    });
    console.log('Created Company:', company.id);
  }

  // 2. Create Admin User
  const adminEmail = 'admin@admin.com';
  const adminPassword = 'admin123';
  const hashedPassword = await bcrypt.hash(adminPassword, 10);

  const adminUser = await prisma.user.create({
    data: {
      email: adminEmail,
      name: 'Admin User',
      passwordHash: hashedPassword,
      role: 'SUPER_ADMIN',
      companyId: company.id,
      status: 'ACTIVE',
      updatedAt: new Date()
    }
  });
  console.log('Created Admin User:', adminEmail);

  // 3. Create Daily Questions (30x3 methodology)
  await prisma.dailyQuestion.createMany({
    data: [
      {
        companyId: company.id,
        question: 'كيف تقيم حالتك المزاجية اليوم؟',
        type: 'rating-5'
      },
      {
        companyId: company.id,
        question: 'هل تشعر بضغط عمل زائد في الفترة الحالية؟',
        type: 'yes-no'
      },
      {
        companyId: company.id,
        question: 'ما هو الشيء الذي يمكن تحسينه في بيئة العمل اليوم؟',
        type: 'short-text'
      }
    ]
  });
  console.log('Created Daily Questions (30x3)');

  // 4. Create Initial Feature Flags
  await prisma.featureFlag.deleteMany();
  await prisma.featureFlag.createMany({
    data: [
      { id: 'ai-recruitment', name: 'التوظيف بالذكاء الاصطناعي', description: 'تفعيل ميزات تحليل السير الذاتية والمقابلات الآلية', enabled: true, risk: 'LOW', updatedAt: new Date() },
      { id: 'advanced-analytics', name: 'التحليلات المتقدمة', description: 'تفعيل لوحات تحكم 30x3 وتقارير التنبؤ', enabled: true, risk: 'MEDIUM', updatedAt: new Date() },
      { id: 'global-search', name: 'البحث الشامل', description: 'تفعيل البحث السريع عبر جميع الكيانات', enabled: false, risk: 'LOW', updatedAt: new Date() },
      { id: 'multi-currency', name: 'تعدد العملات', description: 'دعم الدفع والفوترة بعملات مختلفة', enabled: false, risk: 'HIGH', updatedAt: new Date() }
    ]
  });
  console.log('Created Initial Feature Flags');

  // 5. Create Audit Logs
  await prisma.auditLog.createMany({
    data: [
      {
        userId: adminUser.id,
        companyId: company.id,
        action: 'تعديل صلاحيات المستخدم',
        actionType: 'security',
        severity: 'high',
        target: 'System',
        status: 'success',
        ip: '192.168.1.1',
        timestamp: new Date(),
        details: JSON.stringify({ message: 'Initial setup completed' })
      },
      {
        userId: adminUser.id,
        companyId: company.id,
        action: 'تهيئة النظام والبيانات الأساسية',
        actionType: 'system',
        severity: 'low',
        target: 'نظام الإدارة',
        status: 'success',
        ip: '127.0.0.1',
        timestamp: new Date(),
        details: JSON.stringify({ seeded: true })
      }
    ]
  });
  console.log('Created Audit Logs');

  console.log('Seeding completed.');

}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
