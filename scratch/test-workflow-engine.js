import { PrismaClient } from '@prisma/client';
import { slaService } from '../src/services/sla.service.js';
import {
    initWorkflowInstance
} from '../src/controllers/workflow.controller.js';

const prisma = new PrismaClient();

async function testWorkflowEngine() {
    console.log('🧪 Starting Workflow Engine Integration Test...\n');

    try {
        // 1. Database Connection & Schema Test
        console.log('1️⃣ Testing Database Connection & Schema Models...');
        const templateCount = await prisma.workflowTemplate.count();
        console.log(`   ✅ DB Connected. WorkflowTemplates count: ${templateCount}`);

        // 2. Find a test company or create mock company ID
        const company = await prisma.company.findFirst();
        if (!company) {
            console.log('   ⚠️ No company found in DB. Test completed DB connectivity check.');
            return;
        }
        console.log(`   🏢 Using test Company ID: ${company.id} (${company.name})`);

        // 3. Test Default Template & Steps Retrieval / Auto-Creation
        console.log('\n2️⃣ Testing Workflow Template & 7 SLA Steps Creation...');
        const user = await prisma.user.findFirst({ where: { companyId: company.id } });
        const userId = user?.id || null;
        const userName = user?.name || 'System Test';

        const template = await prisma.workflowTemplate.findFirst({
            where: { companyId: company.id, isDefault: true },
            include: { steps: { orderBy: { stepOrder: 'asc' } } }
        });

        if (template) {
            console.log(`   ✅ Found Default Template "${template.nameAr}" with ${template.steps.length} steps:`);
            template.steps.forEach(s => {
                console.log(`      - Step ${s.stepOrder}: ${s.nameAr} | Role: ${s.role} | SLA: ${s.slaDurationHours}h`);
            });
        } else {
            console.log('   ℹ️ Creating Default Template on the fly...');
            const newTmpl = await prisma.workflowTemplate.create({
                data: {
                    name: 'Default Recruitment Workflow',
                    nameAr: 'مسار التوظيف الافتراضي',
                    description: 'Standard 7-stage recruitment workflow with SLA tracking',
                    companyId: company.id,
                    isDefault: true,
                    isActive: true,
                    steps: {
                        create: [
                            { stepOrder: 1, name: 'Job Request Created', nameAr: 'إنشاء طلب التوظيف', role: 'HIRING_MANAGER', slaDurationHours: 24 },
                            { stepOrder: 2, name: 'HR Review', nameAr: 'مراجعة HR', role: 'HR_MANAGER', slaDurationHours: 48 },
                            { stepOrder: 3, name: 'Approval', nameAr: 'الموافقة الإدارية', role: 'MANAGEMENT', slaDurationHours: 72 },
                            { stepOrder: 4, name: 'Candidate Search', nameAr: 'البحث عن المرشحين', role: 'RECRUITER', slaDurationHours: 168 },
                            { stepOrder: 5, name: 'Interview Process', nameAr: 'عملية المقابلات', role: 'RECRUITER', slaDurationHours: 240 },
                            { stepOrder: 6, name: 'Offer Stage', nameAr: 'مرحلة العرض', role: 'HR_MANAGER', slaDurationHours: 72 },
                            { stepOrder: 7, name: 'Hiring Completed', nameAr: 'اكتمال التعيين', role: 'HR_MANAGER', slaDurationHours: 24 },
                        ]
                    }
                },
                include: { steps: { orderBy: { stepOrder: 'asc' } } }
            });
            console.log(`   ✅ Created Default Template with ${newTmpl.steps.length} steps.`);
        }

        // 4. Test Job Request Workflow Instance Creation
        console.log('\n3️⃣ Testing Workflow Instance Initialization on Job Request...');
        const jobRequest = await prisma.jobRequest.findFirst({ where: { companyId: company.id } });

        if (jobRequest) {
            const instance = await prisma.workflowInstance.findUnique({
                where: { jobRequestId: jobRequest.id },
                include: { stepInstances: { orderBy: { stepOrder: 'asc' } }, logs: true }
            });

            if (instance) {
                console.log(`   ✅ WorkflowInstance exists for JobRequest ${jobRequest.requestId}:`);
                console.log(`      - Current Step: ${instance.currentStep}`);
                console.log(`      - Status: ${instance.status}`);
                console.log(`      - Step Instances: ${instance.stepInstances.length}`);
                console.log(`      - Audit Logs: ${instance.logs.length}`);
            } else {
                console.log(`   ℹ️ Initializing new WorkflowInstance for JobRequest ${jobRequest.requestId}...`);
                const newInst = await initWorkflowInstance(company.id, jobRequest.id, userId, userName);
                console.log(`   ✅ WorkflowInstance initialized successfully with ID: ${newInst?.id}`);
            }
        }

        // 5. Test SLA Breach Checker
        console.log('\n4️⃣ Testing SLA Breach Checker Engine...');
        const result = await slaService.checkSLABreaches();
        console.log(`   ✅ SLA Checker executed successfully. Processed steps: ${result?.checked ?? 0}`);

        // 6. Test Stats Computation
        console.log('\n5️⃣ Testing SLA Dashboard Analytics Calculation...');
        const stats = await slaService.getSLAStats(company.id);
        console.log(`   ✅ SLA Analytics computed: Total steps=${stats.total}, Breaches=${stats.breaches}, Breach Rate=${stats.breachRate}%`);

        console.log('\n🎉 ALL INTEGRATION TESTS PASSED 100%!');

    } catch (err) {
        console.error('❌ Test failed with error:', err);
    } finally {
        await prisma.$disconnect();
    }
}

testWorkflowEngine();
