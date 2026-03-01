
import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

const flags = [
    {
        id: 'AI_RECRUITMENT_ENGINE',
        name: 'محرك التوظيف بالذكاء الاصطناعي',
        description: 'فحص وترتيب المرشحين تلقائياً باستخدام GPT-4 من OpenAI.',
        enabled: true,
        risk: 'HIGH'
    },
    {
        id: 'BETA_DASHBOARD_V2',
        name: 'لوحة التحكم الإصدار الثاني (تجريبي)',
        description: 'لوحة تحليلات جديدة مع تحديثات فورية عبر WebSocket.',
        enabled: false,
        risk: 'MEDIUM'
    },
    {
        id: 'GLOBAL_NOTIFICATIONS',
        name: 'مركز الإشعارات الموحد',
        description: 'مركز إشعارات مركزي لجميع أدوار المستخدمين.',
        enabled: true,
        risk: 'LOW'
    },
    {
        id: 'ADVANCED_ANALYTICS',
        name: 'مجموعة التحليلات التنبؤية',
        description: 'نماذج تنبؤية لمعدل دوران الموظفين والنمو المالي.',
        enabled: false,
        risk: 'MEDIUM'
    },
    {
        id: 'LEGACY_API_ACCESS',
        name: 'إيقاف واجهة برمجة التطبيقات القديمة',
        description: 'الحفاظ على التوافق العكسي لتطبيقات الجوال الإصدار الأول.',
        enabled: true,
        risk: 'HIGH'
    }
]

async function main() {
    console.log('Seeding Feature Flags...')

    for (const flag of flags) {
        await prisma.featureFlag.upsert({
            where: { id: flag.id },
            update: { ...flag, updatedAt: new Date() },
            create: { ...flag, updatedAt: new Date() }
        })
    }

    // Also ensure System Settings exist
    console.log('Seeding System Settings...')
    await prisma.systemSetting.upsert({
        where: { key: 'PLATFORM_KILL_SWITCH' },
        update: { updatedAt: new Date() },
        create: {
            key: 'PLATFORM_KILL_SWITCH',
            value: 'false',
            description: 'Master switch to disable platform access during security events',
            updatedAt: new Date()
        }
    })
}

main()
    .catch((e) => {
        console.error(e)
        process.exit(1)
    })
    .finally(async () => {
        await prisma.$disconnect()
    })
