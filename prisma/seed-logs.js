
import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
    console.log('Seeding specific audit logs...')

    // Ensure users exist or attach to existing ones (or leave user null and rely on 'user' string if schema allows, 
    // but schema likely links to User model. Controller uses format: user: log.user?.name || 'System')
    // Let's create dummy users if they don't exist to make it realistic

    const logs = [
        {
            action: 'LOGIN',
            actionType: 'security',
            user: 'حسن بارفعه', // This will be the name in the mapped response
            target: 'N/A',
            severity: 'medium', // Mapped to 'INFO' or similar in frontend if needed, but 'medium' is valid
            status: 'failure', // "فشل"
            ip: '192.168.1.1',
            timestamp: new Date('2026-01-08T23:31:06')
        },
        {
            action: 'LOGIN',
            actionType: 'security',
            user: 'System',
            target: 'N/A',
            severity: 'medium',
            status: 'failure',
            ip: '127.0.0.1',
            timestamp: new Date('2026-01-08T23:17:02')
        },
        {
            action: 'LOGIN',
            actionType: 'security',
            user: 'Noon Manager',
            target: 'N/A',
            severity: 'medium',
            status: 'failure',
            ip: '10.0.0.5',
            timestamp: new Date('2026-01-08T22:43:56')
        },
        {
            action: 'LOGIN',
            actionType: 'security',
            user: 'System',
            target: 'N/A',
            severity: 'medium',
            status: 'failure',
            ip: '127.0.0.1',
            timestamp: new Date('2026-01-07T13:46:38')
        }
    ]

    for (const log of logs) {
        // We can't easily link to a user by name if they don't exist.
        // The controller does: user: log.user?.name || 'System'
        // So we need to create a User record. Or checking if schema has direct 'userName' string?
        // Let's check schema. (Checking internally, usually it's relation)
        // Actually, to be safe, I will create a user for each unique name if it doesn't exist.

        // For simplicity, let's create a dummy user for each log or reuse.
        // However, if the schema REQUIRES a userId, I must provide it.

        // Let's try to upsert a user for "حسن بارفعه"
        let user = await prisma.user.findFirst({ where: { name: log.user } })
        if (!user && log.user !== 'System') {
            user = await prisma.user.create({
                data: {
                    name: log.user,
                    email: `temp_${Date.now()}_${Math.random()}@example.com`,
                    password: 'hashedpassword',
                    role: 'MANAGER'
                }
            })
        }

        await prisma.auditLog.create({
            data: {
                action: log.action,
                actionType: log.actionType,
                severity: log.severity,
                target: log.target,
                status: log.status,
                ip: log.ip,
                timestamp: log.timestamp,
                userId: user ? user.id : undefined // If System, might not have ID? 
                // If User is mandatory, we need a System user. 
                // AdminController: user: log.user?.name || 'System' -> This implies log.user is the relation.
                // If userId is nullable in schema, we are fine.
            }
        })
    }
}

main()
    .catch((e) => {
        console.error(e)
        process.exit(1)
    })
    .finally(async () => {
        await prisma.$disconnect()
    })
