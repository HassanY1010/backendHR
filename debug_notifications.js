
import prisma from './src/config/db.js';

async function main() {
    console.log('--- Checking Employees ---');
    const employees = await prisma.employee.findMany({
        include: { user: { select: { name: true, email: true } } }
    });
    employees.forEach(e => {
        console.log(`Employee ID: ${e.id}, User ID: ${e.userId}, Name: ${e.user.name}, Email: ${e.user.email}`);
    });

    console.log('\n--- Checking Notifications ---');
    const notifications = await prisma.notification.findMany({
        orderBy: { createdAt: 'desc' },
        take: 10
    });
    if (notifications.length === 0) {
        console.log('No notifications found in the database.');
    } else {
        notifications.forEach(n => {
            console.log(`ID: ${n.id}, EmployeeId: ${n.employeeId}, Title: ${n.title}, Type: ${n.type}, Created: ${n.createdAt}`);
        });
    }

    console.log('\n--- Checking Tasks ---');
    const tasks = await prisma.task.findMany({
        orderBy: { createdAt: 'desc' },
        take: 5
    });
    tasks.forEach(t => {
        console.log(`Task ID: ${t.id}, EmployeeId: ${t.employeeId}, Title: ${t.title}`);
    });

    console.log('\n--- Checking Training Assignments ---');
    const trainings = await prisma.employeeTraining.findMany({
        include: { training: true },
        orderBy: { createdAt: 'desc' },
        take: 5
    });
    trainings.forEach(et => {
        console.log(`Enrollment ID: ${et.id}, EmployeeId: ${et.employeeId}, Training: ${et.training.title}`);
    });
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
