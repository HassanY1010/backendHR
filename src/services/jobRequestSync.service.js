import prisma from '../config/db.js';
import logger from '../utils/logger.js';
import { JOB_REQUEST_STATUS } from './jobRequestStateMachine.js';

/**
 * Service to synchronize JobRequest and HiringPlan status based on Candidate status changes and vacancies.
 */
export const jobRequestSyncService = {
    /**
     * Synchronize JobRequest and HiringPlan when a candidate status changes.
     * Can be executed within an existing Prisma transaction or standalone.
     * 
     * @param {Object} params
     * @param {string} params.candidateId - Candidate ID
     * @param {string} params.newCandidateStatus - Target status for candidate
     * @param {string} [params.oldCandidateStatus] - Previous status
     * @param {string} [params.performedBy] - User ID performing the action
     * @param {Object} [params.tx] - Optional Prisma transaction client
     */
    syncOnCandidateStatusChange: async ({
        candidateId,
        newCandidateStatus,
        oldCandidateStatus,
        performedBy = 'SYSTEM',
        tx
    }) => {
        const client = tx || prisma;

        try {
            // 1. Fetch Candidate with RecruitmentJob
            const candidate = await client.candidate.findUnique({
                where: { id: candidateId },
                include: {
                    recruitmentjob: {
                        include: {
                            candidates: {
                                where: { deletedAt: null }
                            }
                        }
                    }
                }
            });

            if (!candidate || !candidate.recruitmentjob) {
                return { success: false, reason: 'Candidate or associated job not found' };
            }

            const recJob = candidate.recruitmentjob;
            const companyId = recJob.companyId;

            // 2. Find corresponding JobRequest (by matching company and job title or department)
            const jobReq = await client.jobRequest.findFirst({
                where: {
                    companyId,
                    jobTitle: recJob.title,
                    deletedAt: null
                },
                orderBy: { createdAt: 'desc' }
            });

            if (!jobReq) {
                logger.info(`[JobRequestSync] No active JobRequest found matching job title: "${recJob.title}" for company: ${companyId}`);
            }

            // 3. Count candidates in various statuses for this job
            const allJobCandidates = recJob.candidates || [];
            
            // If updating in-memory before DB commit, account for the new status
            const candidatesWithNewStatus = allJobCandidates.map(c => 
                c.id === candidateId ? { ...c, status: newCandidateStatus } : c
            );

            const hiredCandidates = candidatesWithNewStatus.filter(c => c.status === 'HIRED');
            const offeredCandidates = candidatesWithNewStatus.filter(c => ['OFFER_EXTENDED', 'OFFER_SENT', 'OFFERED', 'PRE_ACCEPTED', 'ACCEPTED'].includes(c.status));
            const interviewingCandidates = candidatesWithNewStatus.filter(c => ['INTERVIEWING', 'INTERVIEW_SCHEDULED', 'INTERVIEW_SENT', 'INTERVIEW_COMPLETED', 'SCREENING', 'SHORTLISTED'].includes(c.status));

            const hiredCount = hiredCandidates.length;
            const totalVacancies = jobReq ? (jobReq.vacancies || 1) : 1;
            const remainingVacancies = Math.max(0, totalVacancies - hiredCount);

            logger.info(`[JobRequestSync] Candidate ${candidate.fullName} -> ${newCandidateStatus}. Job: "${recJob.title}", Total Vacancies: ${totalVacancies}, Hired: ${hiredCount}, Remaining: ${remainingVacancies}`);

            // 4. Update JobRequest status if JobRequest exists
            if (jobReq && !['CLOSED', 'CANCELLED', 'REJECTED'].includes(jobReq.status)) {
                let targetJobReqStatus = null;
                let actionText = '';
                let commentText = '';

                // Business Rule: Check if all vacancies are filled
                if (hiredCount >= totalVacancies && totalVacancies > 0) {
                    targetJobReqStatus = JOB_REQUEST_STATUS.HIRED;
                    actionText = 'اكتمال التوظيف وتعيين كافة الشواغر';
                    commentText = `تم تعيين المرشح (${candidate.fullName}) واكتمال جميع الشواغر المطلوبة للطلب (${hiredCount} من أصل ${totalVacancies} شواغر).`;
                } else if (hiredCount > 0 && hiredCount < totalVacancies) {
                    // Partially filled: Still recruiting remaining vacancies
                    if (offeredCandidates.length > 0) {
                        targetJobReqStatus = JOB_REQUEST_STATUS.OFFER_STAGE;
                        actionText = 'مرحلة تقديم العروض للشواغر المتبقية';
                        commentText = `تم تعيين (${hiredCount}/${totalVacancies}) شواغر، ويجري تقديم عروض للشواغر المتبقية.`;
                    } else {
                        targetJobReqStatus = JOB_REQUEST_STATUS.RECRUITMENT_STARTED;
                        actionText = 'استمرار التوظيف للشواغر المتبقية';
                        commentText = `تم تعيين (${hiredCount} من أصل ${totalVacancies} شواغر). جاري استكمال المقابلات والفرز للشواغر المتبقية (${remainingVacancies}).`;
                    }
                } else if (hiredCount === 0) {
                    // No candidates hired yet
                    if (offeredCandidates.length > 0) {
                        targetJobReqStatus = JOB_REQUEST_STATUS.OFFER_STAGE;
                        actionText = 'الانتقال إلى مرحلة العروض الوظيفية';
                        commentText = `انتقال المرشح (${candidate.fullName}) إلى مرحلة تقديم العرض.`;
                    } else if (interviewingCandidates.length > 0) {
                        targetJobReqStatus = JOB_REQUEST_STATUS.INTERVIEW_PROCESS;
                        actionText = 'بدء المقابلات وفرز المرشحين';
                        commentText = `تقدم المرشح (${candidate.fullName}) إلى مرحلة (${newCandidateStatus}).`;
                    } else if (['APPLIED', 'NEW'].includes(newCandidateStatus)) {
                        targetJobReqStatus = JOB_REQUEST_STATUS.RECRUITMENT_STARTED;
                        actionText = 'استقبال طلبات التوظيف';
                        commentText = `تم تسجيل تقديم المرشح (${candidate.fullName}) على الوظيفة.`;
                    }
                }

                // Apply update if status changed or comment needed
                if (targetJobReqStatus && targetJobReqStatus !== jobReq.status) {
                    logger.info(`[JobRequestSync] Transitioning JobRequest (${jobReq.requestId}) from ${jobReq.status} -> ${targetJobReqStatus}`);
                    
                    await client.jobRequest.update({
                        where: { id: jobReq.id },
                        data: {
                            status: targetJobReqStatus,
                            updatedAt: new Date()
                        }
                    });

                    // Ensure performedBy is a valid user UUID for FK constraint
                    let validUserId = performedBy;
                    if (!validUserId || validUserId === 'SYSTEM' || validUserId.includes('_')) {
                        validUserId = jobReq.createdBy;
                    }

                    await client.jobRequestHistory.create({
                        data: {
                            jobRequestId: jobReq.id,
                            action: actionText,
                            oldStatus: jobReq.status,
                            newStatus: targetJobReqStatus,
                            comment: commentText,
                            performedBy: validUserId
                        }
                    });
                }
            }

            // 5. Update RecruitmentJob status if all vacancies filled
            if (hiredCount >= totalVacancies && totalVacancies > 0 && recJob.status === 'OPEN') {
                await client.recruitmentJob.update({
                    where: { id: recJob.id },
                    data: {
                        status: 'CLOSED',
                        updatedAt: new Date()
                    }
                });
                logger.info(`[JobRequestSync] Closed recruitment job "${recJob.title}" (${recJob.id}) as all ${totalVacancies} vacancies were filled.`);
            } else if (hiredCount < totalVacancies && recJob.status === 'CLOSED') {
                // If candidate was un-hired or status changed back from HIRED
                await client.recruitmentJob.update({
                    where: { id: recJob.id },
                    data: {
                        status: 'OPEN',
                        updatedAt: new Date()
                    }
                });
                logger.info(`[JobRequestSync] Re-opened recruitment job "${recJob.title}" (${recJob.id}) as remaining vacancies exist.`);
            }

            // 6. Synchronize HiringPlan fulfilled count
            const plan = await client.hiringPlan.findFirst({
                where: {
                    companyId,
                    position: { contains: recJob.title, mode: 'insensitive' }
                },
                orderBy: { createdAt: 'desc' }
            });

            if (plan) {
                // Count all HIRED candidates across all jobs matching this position
                const allMatchingHired = await client.candidate.count({
                    where: {
                        status: 'HIRED',
                        deletedAt: null,
                        recruitmentjob: {
                            companyId,
                            title: { contains: recJob.title, mode: 'insensitive' },
                            deletedAt: null
                        }
                    }
                });

                await client.hiringPlan.update({
                    where: { id: plan.id },
                    data: {
                        fulfilledCount: allMatchingHired,
                        status: allMatchingHired >= plan.quantity ? 'FULFILLED' : (allMatchingHired > 0 ? 'IN_PROGRESS' : 'PLANNED')
                    }
                });
            }

            return {
                success: true,
                jobRequestId: jobReq?.id,
                jobRequestStatus: jobReq?.status,
                hiredCount,
                totalVacancies,
                remainingVacancies
            };

        } catch (error) {
            logger.error('[JobRequestSync] Error syncing candidate status change:', error.message);
            throw error;
        }
    }
};

export default jobRequestSyncService;
