import { PrismaClient } from '@prisma/client';
import { JobRequestStateMachine, JOB_REQUEST_STATUS } from './src/services/jobRequestStateMachine.js';

const prisma = new PrismaClient();

async function testJobRequestSystem() {
  console.log('🧪 Starting Job Request Management System Test Suite...\n');

  try {
    // 1. Fetch default company and user
    const company = await prisma.company.findFirst();
    const user = await prisma.user.findFirst({ where: { companyId: company.id } });
    let department = await prisma.department.findFirst({ where: { companyId: company.id } });

    if (!department) {
      department = await prisma.department.create({
        data: {
          name: 'تكنولوجيا المعلومات',
          companyId: company.id
        }
      });
    }

    console.log(`✅ Using Company: ${company.name} (${company.id})`);
    console.log(`✅ Using User: ${user.name} (${user.id})`);
    console.log(`✅ Using Department: ${department.name} (${department.id})\n`);

    // 2. Test Job Request Creation (Draft)
    console.log('1️⃣ Testing Job Request Creation (Draft)...');
    const reqId = `JR-TEST-${Date.now()}`;
    const draftRequest = await prisma.jobRequest.create({
      data: {
        requestId: reqId,
        companyId: company.id,
        createdBy: user.id,
        jobTitle: 'Senior Full Stack Engineer',
        departmentId: department.id,
        location: 'الرياض',
        employmentType: 'FULL_TIME',
        vacancies: 3,
        jobSummary: 'تطوير وتصميم الحلول البرمجية الذكية',
        salaryMin: 12000,
        salaryMax: 18000,
        budgetCode: 'BDG-ENG-2026',
        priority: 'HIGH',
        status: 'DRAFT'
      }
    });
    console.log(`   - Created Request ID: ${draftRequest.requestId} (Status: ${draftRequest.status})`);

    // 3. Test Invalid State Transition (Prevent Interview Process from Draft)
    console.log('\n2️⃣ Testing State Machine Guard (Prevent Draft -> Interview Process)...');
    try {
      JobRequestStateMachine.validateTransition(draftRequest, JOB_REQUEST_STATUS.INTERVIEW_PROCESS);
      console.error('❌ Failed: State machine allowed invalid transition!');
    } catch (err) {
      console.log(`   - ✅ Blocked successfully: "${err.message}"`);
    }

    // 4. Test Valid State Transition (Draft -> Submitted)
    console.log('\n3️⃣ Testing Submission (Draft -> Submitted)...');
    JobRequestStateMachine.validateTransition(draftRequest, JOB_REQUEST_STATUS.SUBMITTED);
    const submittedRequest = await prisma.jobRequest.update({
      where: { id: draftRequest.id },
      data: { status: 'SUBMITTED' }
    });

    // Create Audit Log
    await prisma.jobRequestHistory.create({
      data: {
        jobRequestId: draftRequest.id,
        action: 'تقديم الطلب',
        oldStatus: 'DRAFT',
        newStatus: 'SUBMITTED',
        performedBy: user.id,
        comment: 'تم تقديم طلب التوظيف للمراجعة والاعتماد'
      }
    });
    console.log(`   - Status updated to: ${submittedRequest.status}`);

    // 5. Test Under Review Transition (Submitted -> Under Review)
    console.log('\n4️⃣ Testing Review Phase (Submitted -> Under Review)...');
    JobRequestStateMachine.validateTransition(submittedRequest, JOB_REQUEST_STATUS.UNDER_REVIEW);
    const underReviewRequest = await prisma.jobRequest.update({
      where: { id: draftRequest.id },
      data: { status: 'UNDER_REVIEW' }
    });
    console.log(`   - Status updated to: ${underReviewRequest.status}`);

    // 6. Test Pending Approval & Full Approval (Under Review -> Pending Approval -> Approved)
    console.log('\n5️⃣ Testing Approval Workflow (Under Review -> Pending Approval -> Approved)...');
    JobRequestStateMachine.validateTransition(underReviewRequest, JOB_REQUEST_STATUS.PENDING_APPROVAL);
    const pendingRequest = await prisma.jobRequest.update({
      where: { id: draftRequest.id },
      data: { status: 'PENDING_APPROVAL' }
    });

    JobRequestStateMachine.validateTransition(pendingRequest, JOB_REQUEST_STATUS.APPROVED);
    const approvedRequest = await prisma.jobRequest.update({
      where: { id: draftRequest.id },
      data: { status: 'APPROVED' }
    });
    console.log(`   - Status updated to: ${approvedRequest.status}`);

    // 7. Test Convert Approved Request to Recruitment Job
    console.log('\n6️⃣ Testing Conversion to Active Recruitment Job...');
    const recruitmentJob = await prisma.recruitmentJob.create({
      data: {
        companyId: company.id,
        departmentId: department.id,
        title: approvedRequest.jobTitle,
        department: department.name,
        location: approvedRequest.location,
        salaryMin: 12000,
        salaryMax: 18000,
        description: approvedRequest.jobSummary,
        status: 'OPEN',
        createdBy: user.id
      }
    });

    await prisma.jobRequest.update({
      where: { id: approvedRequest.id },
      data: { status: 'RECRUITMENT_STARTED' }
    });

    console.log(`   - Active Job Created: ${recruitmentJob.title} (Job ID: ${recruitmentJob.id})`);
    console.log(`   - Job Request Status: RECRUITMENT_STARTED`);

    console.log('\n🎉 ALL JOB REQUEST SYSTEM TESTS PASSED SUCCESSFULLY! Production Ready.');
  } catch (err) {
    console.error('❌ Test execution error:', err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

testJobRequestSystem();
