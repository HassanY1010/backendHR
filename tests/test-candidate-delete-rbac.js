import assert from 'assert';
import request from 'supertest';
import app from '../src/app.js';
import pkg from '@prisma/client';
const { PrismaClient } = pkg;
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
dotenv.config();

const prisma = new PrismaClient();

const generateAuthToken = (user) => {
    return jwt.sign(
        { id: user.id, email: user.email, role: user.role, companyId: user.companyId },
        process.env.JWT_SECRET || 'secretKey',
        { expiresIn: '1h' }
    );
};

async function runCandidateRBACAndIsolationAudit() {
    console.log('🌟 =================================================================');
    console.log('🌟 CANDIDATE DELETE RBAC & MULTI-TENANT ISOLATION AUDIT SUITE');
    console.log('🌟 =================================================================\n');

    // 1. Setup Tenant A and Tenant B
    let companyA = await prisma.company.findFirst({ where: { name: 'Test Tenant A - ATS Audit' } });
    if (!companyA) {
        companyA = await prisma.company.create({
            data: { name: 'Test Tenant A - ATS Audit', status: 'active' }
        });
    }

    let companyB = await prisma.company.findFirst({ where: { name: 'Test Tenant B - ATS Audit' } });
    if (!companyB) {
        companyB = await prisma.company.create({
            data: { name: 'Test Tenant B - ATS Audit', status: 'active' }
        });
    }

    // Create Job for Tenant A
    let jobA = await prisma.recruitmentJob.findFirst({ where: { companyId: companyA.id, title: 'Engineer A' } });
    if (!jobA) {
        jobA = await prisma.recruitmentJob.create({
            data: {
                companyId: companyA.id,
                title: 'Engineer A',
                description: 'Engineering Role A',
                status: 'OPEN'
            }
        });
    }

    // Create Candidate for Tenant A
    const candidateA = await prisma.candidate.create({
        data: {
            jobId: jobA.id,
            fullName: 'Candidate Under Test A',
            email: `candidate_a_${Date.now()}@example.com`,
            interviewCode: `TEST${Date.now().toString().slice(-4)}`,
            status: 'NEW'
        }
    });

    // Helper to get or create user with role
    async function getOrCreateUser(companyId, role, emailPrefix) {
        const email = `${emailPrefix}_${companyId.slice(0, 6)}@test-audit.com`;
        let user = await prisma.user.findFirst({ where: { email } });
        if (!user) {
            user = await prisma.user.create({
                data: {
                    companyId,
                    email,
                    name: `Test ${role}`,
                    role,
                    status: 'ACTIVE',
                    passwordHash: 'hashed_test_password'
                }
            });
        } else if (user.role !== role || user.status !== 'ACTIVE') {
            user = await prisma.user.update({
                where: { id: user.id },
                data: { role, status: 'ACTIVE' }
            });
        }
        return user;
    }

    const superAdminUser = await getOrCreateUser(companyA.id, 'SUPER_ADMIN', 'superadmin');
    const adminUserA = await getOrCreateUser(companyA.id, 'ADMIN', 'admin');
    const hrManagerUserA = await getOrCreateUser(companyA.id, 'HR_MANAGER', 'hrmanager');
    const recruiterUserA = await getOrCreateUser(companyA.id, 'RECRUITER', 'recruiter');
    const managerUserA = await getOrCreateUser(companyA.id, 'MANAGER', 'manager');
    const employeeUserA = await getOrCreateUser(companyA.id, 'EMPLOYEE', 'employee');

    const adminUserB = await getOrCreateUser(companyB.id, 'ADMIN', 'admin_b');
    const hrManagerUserB = await getOrCreateUser(companyB.id, 'HR_MANAGER', 'hrmanager_b');

    try {
        console.log('--- TEST 1: RECRUITER trying DELETE /api/candidates/:id ---');
        const tokenRecruiter = generateAuthToken(recruiterUserA);
        const resRecruiter = await request(app)
            .delete(`/api/candidates/${candidateA.id}`)
            .set('Authorization', `Bearer ${tokenRecruiter}`);

        console.log(`Recruiter Delete -> Status: ${resRecruiter.status}`, resRecruiter.body);
        assert.strictEqual(resRecruiter.status, 200, 'RECRUITER must be authorized with 200');

        // Create new candidate for MANAGER test
        const candidateForManager = await prisma.candidate.create({
            data: {
                jobId: jobA.id,
                fullName: 'Candidate For Manager Test',
                email: `cand_mgr_${Date.now()}@example.com`,
                interviewCode: `MGR${Date.now().toString().slice(-4)}`,
                status: 'NEW'
            }
        });

        console.log('\n--- TEST 2: MANAGER trying DELETE /api/candidates/:id ---');
        const tokenManager = generateAuthToken(managerUserA);
        const resManager = await request(app)
            .delete(`/api/candidates/${candidateForManager.id}`)
            .set('Authorization', `Bearer ${tokenManager}`);

        console.log(`Manager Delete -> Status: ${resManager.status}`, resManager.body);
        assert.strictEqual(resManager.status, 200, 'MANAGER must be authorized with 200');

        // Create new candidate for HR_MANAGER test
        const candidateForHR = await prisma.candidate.create({
            data: {
                jobId: jobA.id,
                fullName: 'Candidate For HR Test',
                email: `cand_hr_${Date.now()}@example.com`,
                interviewCode: `HR${Date.now().toString().slice(-4)}`,
                status: 'NEW'
            }
        });

        console.log('\n--- TEST 3: HR_MANAGER trying DELETE /api/candidates/:id ---');
        const tokenHR = generateAuthToken(hrManagerUserA);
        const resHR = await request(app)
            .delete(`/api/candidates/${candidateForHR.id}`)
            .set('Authorization', `Bearer ${tokenHR}`);

        console.log(`HR_MANAGER Delete -> Status: ${resHR.status}`, resHR.body);
        assert.strictEqual(resHR.status, 200, 'HR_MANAGER must be authorized with 200');

        // Create new candidate for Cross-Tenant and Unauthorized tests
        const candidateActiveA = await prisma.candidate.create({
            data: {
                jobId: jobA.id,
                fullName: 'Candidate Tenant A Active',
                email: `cand_active_${Date.now()}@example.com`,
                interviewCode: `ACT${Date.now().toString().slice(-4)}`,
                status: 'NEW'
            }
        });

        console.log('\n--- TEST 4: EMPLOYEE trying DELETE /api/candidates/:id (UNAUTHORIZED) ---');
        const tokenEmployee = generateAuthToken(employeeUserA);
        const resEmployee = await request(app)
            .delete(`/api/candidates/${candidateActiveA.id}`)
            .set('Authorization', `Bearer ${tokenEmployee}`);

        console.log(`EMPLOYEE Delete -> Status: ${resEmployee.status}`, resEmployee.body);
        assert.strictEqual(resEmployee.status, 403, 'EMPLOYEE must be strictly rejected with 403 Forbidden');

        console.log('\n--- TEST 5: Tenant B HR_MANAGER trying DELETE Tenant A candidate (CROSS-TENANT ISOLATION) ---');
        const tokenHR_B = generateAuthToken(hrManagerUserB);
        const resCrossTenant = await request(app)
            .delete(`/api/candidates/${candidateActiveA.id}`)
            .set('Authorization', `Bearer ${tokenHR_B}`);

        console.log(`Cross-Tenant Delete -> Status: ${resCrossTenant.status}`, resCrossTenant.body);
        assert.strictEqual(resCrossTenant.status, 404, 'Cross-tenant candidate deletion must be safely rejected with 404');

        console.log('\n--- TEST 6: Invalid Candidate ID ---');
        const resInvalidId = await request(app)
            .delete('/api/candidates/00000000-0000-0000-0000-000000000000')
            .set('Authorization', `Bearer ${tokenHR}`);

        console.log(`Invalid ID Delete -> Status: ${resInvalidId.status}`, resInvalidId.body);
        assert.strictEqual(resInvalidId.status, 404, 'Non-existent candidate must return 404');

        // Verify Audit Log was recorded
        const auditRecord = await prisma.auditLog.findFirst({
            where: {
                companyId: companyA.id,
                action: 'DELETE_CANDIDATE'
            },
            orderBy: { timestamp: 'desc' }
        });
        console.log('\n--- TEST 7: Audit Logging Check ---');
        console.log('Latest Audit Record:', auditRecord ? { action: auditRecord.action, status: auditRecord.status, target: auditRecord.target } : 'NOT FOUND');
        assert(auditRecord, 'Audit log entry for candidate deletion must exist');

        console.log('\n=================================================================');
        console.log('🏆 ALL RBAC, ISOLATION, AND IDOR AUDIT TESTS PASSED (100%)');
        console.log('=================================================================');

    } finally {
        // Cleanup test candidates
        await prisma.candidateHistory.deleteMany({
            where: { candidate: { jobId: jobA.id } }
        });
        await prisma.candidateSkill.deleteMany({
            where: { candidate: { jobId: jobA.id } }
        });
        await prisma.candidate.deleteMany({
            where: { jobId: jobA.id }
        });
        await prisma.$disconnect();
    }
}

runCandidateRBACAndIsolationAudit();
