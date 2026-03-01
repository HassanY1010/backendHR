import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database with plain text passwords...');

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

  // 1.5 Create Noon Company
  const noonCompanyName = 'Noon Corp';
  let noonCompany = await prisma.company.findFirst({ where: { name: noonCompanyName } });

  if (!noonCompany) {
    noonCompany = await prisma.company.create({
      data: {
        name: noonCompanyName,
        subscriptionStatus: 'ACTIVE',
        subscriptionExpiry: new Date(new Date().setFullYear(new Date().getFullYear() + 1)),
        updatedAt: new Date()
      }
    });
    console.log('Created Noon Company:', noonCompany.id);
  }

  // 2. Create Admin User
  const adminEmail = 'admin@techcorp.com';
  const adminPassword = 'admin123';

  await prisma.user.upsert({
    where: { email: adminEmail },
    update: { passwordHash: adminPassword },
    create: {
      email: adminEmail,
      name: 'Admin User',
      passwordHash: adminPassword,
      role: 'SUPER_ADMIN',
      companyId: company.id,
      status: 'ACTIVE',
      updatedAt: new Date()
    }
  });
  console.log('Created Admin User:', adminEmail);

  // 3. Create Manager User
  const managerEmail = 'manager@techcorp.com';
  const managerPassword = 'manager123';

  await prisma.user.upsert({
    where: { email: managerEmail },
    update: { passwordHash: managerPassword },
    create: {
      email: managerEmail,
      name: 'Manager User',
      passwordHash: managerPassword,
      role: 'MANAGER',
      companyId: company.id,
      status: 'ACTIVE',
      updatedAt: new Date()
    }
  });
  console.log('Created Manager User:', managerEmail);

  // 3.5 Create Noon Manager
  const noonEmail = 'Noon@noon.com';
  const noonPassword = 'hhaall112233$';

  await prisma.user.upsert({
    where: { email: noonEmail },
    update: { passwordHash: noonPassword },
    create: {
      email: noonEmail,
      name: 'Noon Manager',
      passwordHash: noonPassword,
      role: 'MANAGER',
      companyId: noonCompany.id,
      status: 'ACTIVE',
      updatedAt: new Date()
    }
  });
  console.log('Created Noon Manager User:', noonEmail);

  // 4. Create Employee User & Profile
  const empEmail = 'employee@techcorp.com';
  const empPassword = 'employee123';

  const empUser = await prisma.user.upsert({
    where: { email: empEmail },
    update: { passwordHash: empPassword },
    create: {
      email: empEmail,
      name: 'John Doe',
      passwordHash: empPassword,
      role: 'EMPLOYEE',
      companyId: company.id,
      status: 'ACTIVE',
      updatedAt: new Date()
    }
  });

  const employeeProfile = await prisma.employee.upsert({
    where: { userId: empUser.id },
    update: {
      companyId: company.id, // Ensure companyId is updated
      updatedAt: new Date()
    },
    create: {
      userId: empUser.id,
      companyId: company.id,
      department: 'Engineering',
      position: 'Software Engineer',
      riskLevel: 0.2,
      performanceScore: 85,
      updatedAt: new Date()
    }
  });
  console.log('Created Employee:', empEmail);

  // 5. Create some Tasks for Employee
  await prisma.task.deleteMany({ where: { employeeId: employeeProfile.id } });
  await prisma.task.createMany({
    data: [
      {
        title: 'Complete Onboarding',
        description: 'Read the handbook and sign documents',
        priority: 'high',
        status: 'pending',
        employeeId: employeeProfile.id,
        dueDate: new Date(),
        updatedAt: new Date()
      },
      {
        title: 'Setup Dev Environment',
        description: 'Install VS Code, Node.js, etc.',
        priority: 'medium',
        status: 'completed',
        employeeId: employeeProfile.id,
        updatedAt: new Date()
      }
    ]
  });
  console.log('Created Tasks for Employee');

  // 6. Create Daily Questions (30x3 methodology)
  await prisma.dailyQuestion.deleteMany({ where: { companyId: company.id } });
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

  // 7. Create Initial Feature Flags
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

  // 8. Create Audit Logs
  await prisma.auditLog.deleteMany();
  await prisma.auditLog.createMany({
    data: [
      {
        userId: (await prisma.user.findFirst({ where: { role: 'SUPER_ADMIN' } }))?.id || empUser.id,
        companyId: company.id,
        action: 'تعديل صلاحيات المستخدم',
        actionType: 'security',
        severity: 'high',
        target: 'John Doe',
        status: 'success',
        ip: '192.168.1.1',
        timestamp: new Date(),
        details: JSON.stringify({ oldRole: 'EMPLOYEE', newRole: 'MANAGER' })
      },
      {
        userId: empUser.id,
        companyId: company.id,
        action: 'تصدير بيانات الرواتب',
        actionType: 'system',
        severity: 'medium',
        target: 'قسم المالية',
        status: 'warning',
        ip: '192.168.1.45',
        timestamp: new Date(Date.now() - 3600000 * 2), // 2 hours ago
        details: JSON.stringify({ format: 'PDF', records: 150 })
      },
      {
        userId: (await prisma.user.findFirst({ where: { role: 'MANAGER' } }))?.id || empUser.id,
        companyId: company.id,
        action: 'حذف سجل حضور',
        actionType: 'delete',
        severity: 'critical',
        target: 'سجل 2023-10-01',
        status: 'success',
        ip: '10.0.0.5',
        timestamp: new Date(Date.now() - 3600000 * 24), // 24 hours ago
        details: JSON.stringify({ reason: 'Duplicate entry' })
      },
      {
        userId: (await prisma.user.findFirst({ where: { role: 'SUPER_ADMIN' } }))?.id || empUser.id,
        companyId: company.id,
        action: 'محاولة دخول فاشلة',
        actionType: 'login',
        severity: 'high',
        target: 'نظام الإدارة',
        status: 'error',
        ip: '172.16.0.10',
        timestamp: new Date(Date.now() - 3600000 * 5), // 5 hours ago
        details: JSON.stringify({ attempts: 3, user: 'admin@techcorp.com' })
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
