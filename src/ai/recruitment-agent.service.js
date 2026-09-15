import prisma from '../config/db.js';
import logger from '../utils/logger.js';
import OpenAI from 'openai';

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY || 'mock-key'
});

/**
 * =========================================================================
 * RECRUITMENT AI AGENT SERVICE
 * Architecture: Planner + Decision Engine + Tools + Actions + Memory (DB)
 * Principles: Semi-Autonomous, Explainable, Permission-Gated, Multi-Tenant
 * =========================================================================
 */
class RecruitmentAgentService {

    /**
     * 1. MEMORY COMPONENT
     * Retrieves relevant context and past actions for a company to prevent duplicates.
     */
    async getAgentMemory(companyId, taskType) {
        // Last 10 completed or recommended tasks for this company & taskType
        const recentTasks = await prisma.agentTask.findMany({
            where: { companyId, taskType },
            orderBy: { createdAt: 'desc' },
            take: 10,
            include: { logs: { take: 5, orderBy: { timestamp: 'desc' } } }
        });

        // Get active recommendations that haven't expired or been executed yet
        const activeLogs = await prisma.agentLog.findMany({
            where: {
                companyId,
                actionStatus: { in: ['RECOMMENDED', 'APPROVED'] },
                timestamp: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
            },
            take: 20
        });

        return {
            recentTasks,
            activeActionIds: activeLogs.map(l => l.id),
            actionLogCount: activeLogs.length
        };
    }

    /**
     * 2. PLANNER COMPONENT
     * Dispatches autonomous evaluation modules.
     */
    async planSweep({ companyId, requestedTaskType = 'ALL', userId }) {
        logger.info(`[Agent-Planner] Initiating plan for company: ${companyId}, taskType: ${requestedTaskType}`);

        const tasksToRun = [];
        if (requestedTaskType === 'ALL' || requestedTaskType === 'STALLED_JOBS') {
            tasksToRun.push('STALLED_JOBS');
        }
        if (requestedTaskType === 'ALL' || requestedTaskType === 'CANDIDATE_FOLLOWUP') {
            tasksToRun.push('CANDIDATE_FOLLOWUP');
        }
        if (requestedTaskType === 'ALL' || requestedTaskType === 'WEEKLY_REPORT') {
            tasksToRun.push('WEEKLY_REPORT');
        }
        if (requestedTaskType === 'ALL' || requestedTaskType === 'TOP_CANDIDATES') {
            tasksToRun.push('TOP_CANDIDATES');
        }

        const results = [];

        for (const tType of tasksToRun) {
            try {
                const res = await this.executeSubTask({ companyId, taskType: tType, userId });
                results.push(res);
            } catch (err) {
                logger.error(`[Agent-Planner] Error in subtask ${tType}:`, err.message);
                results.push({
                    taskType: tType,
                    status: 'FAILED',
                    error: err.message
                });
            }
        }

        return {
            companyId,
            plannedTasks: tasksToRun,
            executedCount: results.length,
            results
        };
    }

    /**
     * Execute a specific sub-task with full lifecycle state management:
     * PENDING -> RUNNING -> COMPLETED / FAILED
     */
    async executeSubTask({ companyId, taskType, userId }) {
        const todayDate = new Date().toISOString().slice(0, 10);
        const idempotencyKey = `${taskType}-${todayDate}`;

        // 8. Idempotency & Duplicate Action Prevention
        const existingTask = await prisma.agentTask.findUnique({
            where: {
                companyId_idempotencyKey: {
                    companyId,
                    idempotencyKey
                }
            },
            include: { logs: true }
        });

        if (existingTask && existingTask.status === 'COMPLETED') {
            logger.info(`[Agent-Memory] Task ${taskType} already ran today for company ${companyId}. Returning cached results.`);
            return existingTask;
        }

        // Initialize Task in PENDING state
        let task = await prisma.agentTask.create({
            data: {
                companyId,
                agentType: 'RECRUITMENT',
                taskType,
                title: this.getTaskTitle(taskType),
                status: 'RUNNING',
                idempotencyKey,
                priority: taskType === 'STALLED_JOBS' ? 'HIGH' : 'MEDIUM'
            }
        });

        try {
            let taskResult = null;

            // Route to specific autonomous tool
            switch (taskType) {
                case 'STALLED_JOBS':
                    taskResult = await this.monitorStalledJobsTool(companyId, task.id, userId);
                    break;
                case 'CANDIDATE_FOLLOWUP':
                    taskResult = await this.trackCandidateFollowupsTool(companyId, task.id, userId);
                    break;
                case 'WEEKLY_REPORT':
                    taskResult = await this.generateWeeklyHiringReportTool(companyId, task.id, userId);
                    break;
                case 'TOP_CANDIDATES':
                    taskResult = await this.proposeTopCandidatesTool(companyId, task.id, userId);
                    break;
                default:
                    throw new Error(`نوع المهمة غير مدعوم: ${taskType}`);
            }

            // Update Task to COMPLETED
            const updatedTask = await prisma.agentTask.update({
                where: { id: task.id },
                data: {
                    status: 'COMPLETED',
                    result: taskResult,
                    completedAt: new Date()
                },
                include: { logs: true }
            });

            return updatedTask;
        } catch (error) {
            logger.error(`[Agent-Lifecycle] Task ${task.id} (${taskType}) failed:`, error.message);

            // Record failure in AgentLog
            await prisma.agentLog.create({
                data: {
                    companyId,
                    taskId: task.id,
                    action: taskType,
                    actionStatus: 'FAILED',
                    errorMessage: error.message,
                    performedBy: userId || 'SYSTEM_AGENT'
                }
            });

            // Update Task to FAILED
            const failedTask = await prisma.agentTask.update({
                where: { id: task.id },
                data: {
                    status: 'FAILED',
                    errorReason: error.message,
                    completedAt: new Date()
                }
            });

            return failedTask;
        }
    }

    /**
     * Helper to get human-readable task titles
     */
    getTaskTitle(taskType) {
        switch (taskType) {
            case 'STALLED_JOBS': return 'فحص ومراقبة الوظائف المتعثرة أو الخاملة';
            case 'CANDIDATE_FOLLOWUP': return 'متابعة المرشحين المتأخرين والعالقين في المراحل';
            case 'WEEKLY_REPORT': return 'توليد تقرير التوظيف الأسبوعي المعتمد على البيانات';
            case 'TOP_CANDIDATES': return 'تحديد وترشيح أفضل 5 مرشحين جاهزين للمقابلة';
            default: return 'مهمة وكيل التوظيف الآلي';
        }
    }

    /**
     * 3. TOOL 1: Job Monitoring (Stalled Jobs)
     * Detects jobs with 0 candidates or inactive for > 7 days.
     */
    async monitorStalledJobsTool(companyId, taskId, userId) {
        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

        // Fetch open recruitment jobs
        const openJobs = await prisma.recruitmentJob.findMany({
            where: {
                companyId,
                status: 'OPEN',
                deletedAt: null
            },
            include: {
                candidates: {
                    select: { id: true, createdAt: true, status: true }
                }
            }
        });

        const stalledJobs = [];
        const createdLogs = [];

        for (const job of openJobs) {
            const hasRecentCandidates = job.candidates.some(c => c.createdAt >= sevenDaysAgo);
            const isOldJob = job.createdAt <= sevenDaysAgo;
            const zeroCandidates = job.candidates.length === 0;

            if (isOldJob && (!hasRecentCandidates || zeroCandidates)) {
                // Stalled detected! Formulate concrete explainable remediation
                const reason = zeroCandidates
                    ? `الوظيفة مفتوحة منذ أكثر من 7 أيام (${Math.round((Date.now() - job.createdAt.getTime()) / (1000 * 3600 * 24))} يوماً) بدون أي متقدمين.`
                    : `لم يتم استلام أي طلبات تقديم جديدة على الوظيفة خلال آخر 7 أيام متواصلة.`;

                const recommendedActions = [
                    {
                        actionType: 'UPDATE_SALARY_RANGE',
                        label: 'رفع الحد الأدنى للراتب بنسبة 10-15%',
                        detail: `الراتب الحالي (${job.salaryMin ? `${job.salaryMin} - ${job.salaryMax}` : 'غير محدد'}) قد يكون أقل من المعايير التنافسية للسوق.`
                    },
                    {
                        actionType: 'OPTIMIZE_JOB_DESCRIPTION',
                        label: 'إعادة صياغة المتطلبات وتخفيف القيود',
                        detail: `تحديث المسمى والمهارات لزيادة ظهور الإعلان أمام المرشحين المؤهلين.`
                    },
                    {
                        actionType: 'EXPAND_SOURCING_CHANNELS',
                        label: 'توسيع قنوات الاستقطاب الخارجي',
                        detail: `نشر الوظيفة على منصات توظيف إضافية وتفعيل البحث الآلي في قاعدة بيانات المنصة.`
                    }
                ];

                // Deduplication: check if an unresolved recommendation already exists for this job
                let log = await prisma.agentLog.findFirst({
                    where: {
                        companyId,
                        action: 'RECOMMEND_STALLED_JOB_FIX',
                        actionStatus: 'RECOMMENDED',
                        input: { path: ['jobId'], equals: job.id }
                    }
                });

                if (!log) {
                    log = await prisma.agentLog.create({
                        data: {
                            companyId,
                            taskId,
                            action: 'RECOMMEND_STALLED_JOB_FIX',
                            actionStatus: 'RECOMMENDED',
                            input: { jobId: job.id, jobTitle: job.title, createdAt: job.createdAt, candidateCount: job.candidates.length },
                            output: { recommendedActions },
                            evidence: {
                                reason,
                                daysOpen: Math.round((Date.now() - job.createdAt.getTime()) / (1000 * 3600 * 24)),
                                totalCandidates: job.candidates.length,
                                lastCandidateDate: job.candidates.length ? job.candidates[0].createdAt : null
                            },
                            performedBy: userId || 'SYSTEM_AGENT'
                        }
                    });
                }

                stalledJobs.push({
                    jobId: job.id,
                    jobTitle: job.title,
                    department: job.department,
                    candidateCount: job.candidates.length,
                    evidenceReason: reason,
                    recommendedActions,
                    logId: log.id
                });
                createdLogs.push(log);
            }
        }

        return {
            checkedJobsCount: openJobs.length,
            stalledJobsCount: stalledJobs.length,
            stalledJobs,
            summary: stalledJobs.length > 0
                ? `تم رصد ${stalledJobs.length} وظيفة متوقفة أو بدون متقدمين جدد لأكثر من 7 أيام.`
                : 'جميع الوظائف المفتوحة نشطة وتستقبل طلبات توظيف بشكل دوري.'
        };
    }

    /**
     * 4. TOOL 2: Candidate Bottleneck & Follow-up Tool
     * Scans active candidates stuck in stages > 5 days.
     */
    async trackCandidateFollowupsTool(companyId, taskId, userId) {
        const fiveDaysAgo = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000);

        // Fetch candidates for this company's jobs that haven't changed status recently
        const candidates = await prisma.candidate.findMany({
            where: {
                recruitmentjob: { companyId },
                deletedAt: null,
                status: { in: ['APPLIED', 'SCREENING', 'SHORTLISTED'] },
                updatedAt: { lte: fiveDaysAgo }
            },
            include: {
                recruitmentjob: { select: { id: true, title: true } },
                interviews: { orderBy: { createdAt: 'desc' }, take: 1 }
            },
            take: 20
        });

        const followups = [];

        for (const cand of candidates) {
            const daysStuck = Math.round((Date.now() - cand.updatedAt.getTime()) / (1000 * 3600 * 24));
            let followupReason = '';
            let proposedAction = '';

            if (cand.status === 'APPLIED') {
                followupReason = `المرشح في مرحلة التقديم الأولي منذ ${daysStuck} يوماً دون فحص أو انتقال لمرحلة الفرز.`;
                proposedAction = 'SEND_SCREENING_INVITATION';
            } else if (cand.status === 'SCREENING' || cand.status === 'SHORTLISTED') {
                followupReason = `المرشح مؤهل ومعلق في مرحلة ${cand.status} منذ ${daysStuck} يوماً دون تحديد موعد مقابلة.`;
                proposedAction = 'SCHEDULE_INTERVIEW_REMINDER';
            }

            // Deduplication: check if an unresolved recommendation already exists for this candidate & action
            let log = await prisma.agentLog.findFirst({
                where: {
                    companyId,
                    action: 'RECOMMEND_CANDIDATE_FOLLOWUP',
                    actionStatus: 'RECOMMENDED',
                    input: { path: ['candidateId'], equals: cand.id }
                }
            });

            if (!log) {
                log = await prisma.agentLog.create({
                    data: {
                        companyId,
                        taskId,
                        action: 'RECOMMEND_CANDIDATE_FOLLOWUP',
                        actionStatus: 'RECOMMENDED',
                        input: { candidateId: cand.id, candidateName: cand.fullName, currentStatus: cand.status },
                        output: { proposedAction, suggestedMessage: `مرحباً ${cand.fullName}، نود إعلامك بأن طلبك لوظيفة ${cand.recruitmentjob?.title} قيد المتابعة والاهتمام.` },
                        evidence: {
                            daysStuck,
                            lastUpdated: cand.updatedAt,
                            reason: followupReason
                        },
                        performedBy: userId || 'SYSTEM_AGENT'
                    }
                });
            }

            followups.push({
                candidateId: cand.id,
                candidateName: cand.fullName,
                email: cand.email,
                jobTitle: cand.recruitmentjob?.title,
                status: cand.status,
                daysStuck,
                followupReason,
                proposedAction,
                logId: log.id
            });
        }

        return {
            analyzedCandidatesCount: candidates.length,
            bottlenecksFoundCount: followups.length,
            followups,
            summary: followups.length > 0
                ? `تم رصد ${followups.length} مرشحاً متأخرين أو عالقين في مراحل التوظيف لأكثر من 5 أيام.`
                : 'لا يوجد مرشحون عالقون، سير إجراءات التوظيف منتظم تماماً.'
        };
    }

    /**
     * 5. TOOL 3: Weekly Hiring Report Tool
     * Generates report backed by real database metrics:
     * Applications, Interviews, Hires, Time-to-Hire + Strategic AI Analysis.
     */
    async generateWeeklyHiringReportTool(companyId, taskId, userId) {
        const now = new Date();
        const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

        // Fetch metrics directly from DB for company
        const [
            openJobsCount,
            weeklyApplicationsCount,
            weeklyInterviewsCount,
            weeklyHiresCount,
            allCandidates
        ] = await Promise.all([
            prisma.recruitmentJob.count({
                where: { companyId, status: 'OPEN', deletedAt: null }
            }),
            prisma.candidate.count({
                where: {
                    recruitmentjob: { companyId },
                    createdAt: { gte: sevenDaysAgo },
                    deletedAt: null
                }
            }),
            prisma.interview.count({
                where: {
                    candidate: { recruitmentjob: { companyId } },
                    createdAt: { gte: sevenDaysAgo }
                }
            }),
            prisma.candidate.count({
                where: {
                    recruitmentjob: { companyId },
                    status: 'HIRED',
                    updatedAt: { gte: sevenDaysAgo }
                }
            }),
            prisma.candidate.findMany({
                where: {
                    recruitmentjob: { companyId },
                    status: 'HIRED'
                },
                select: { createdAt: true, updatedAt: true },
                take: 50
            })
        ]);

        // Calculate avg Time-to-Hire in days
        let avgTimeToHireDays = 0;
        if (allCandidates.length > 0) {
            const totalDays = allCandidates.reduce((acc, c) => {
                const diff = (c.updatedAt.getTime() - c.createdAt.getTime()) / (1000 * 3600 * 24);
                return acc + Math.max(1, Math.round(diff));
            }, 0);
            avgTimeToHireDays = Math.round(totalDays / allCandidates.length);
        }

        // Generate dynamic explainable insights
        const bottlenecks = [];
        if (openJobsCount > 0 && weeklyApplicationsCount === 0) {
            bottlenecks.push('انخفاض معدل التقديم على الوظائف المفتوحة خلال الأسبوع الماضي');
        }
        if (weeklyApplicationsCount > 5 && weeklyInterviewsCount === 0) {
            bottlenecks.push('تأخر في جدولة المقابلات للمرشحين المتقدمين الجدد');
        }

        const reportData = {
            period: {
                from: sevenDaysAgo.toISOString(),
                to: now.toISOString()
            },
            metrics: {
                openJobsCount,
                weeklyApplicationsCount,
                weeklyInterviewsCount,
                weeklyHiresCount,
                avgTimeToHireDays
            },
            bottlenecks,
            recommendation: bottlenecks.length > 0
                ? 'يوصى بمراجعة وتحديث قنوات الاستقطاب وتسريع جدولة المقابلات لتفادي خسارة الكفاءات.'
                : 'أداء دورة التوظيف الأسبوعية يسير وفق المستهدف بمعدل تحويل ممتاز.'
        };

        const log = await prisma.agentLog.create({
            data: {
                companyId,
                taskId,
                action: 'GENERATE_WEEKLY_REPORT',
                actionStatus: 'EXECUTED',
                output: reportData,
                evidence: {
                    metricsSnapshot: reportData.metrics,
                    source: 'DATABASE_LIVE_AGGREGATION'
                },
                performedBy: userId || 'SYSTEM_AGENT'
            }
        });

        const metrics = {
            totalApplications: weeklyApplicationsCount,
            totalInterviews: weeklyInterviewsCount,
            totalHired: weeklyHiresCount,
            totalOpenJobs: openJobsCount,
            avgTimeToHireDays,
            throughputRate: weeklyApplicationsCount > 0 ? Math.round((weeklyInterviewsCount / weeklyApplicationsCount) * 100) : 0,
            ...reportData.metrics
        };

        return {
            report: reportData,
            reportTitle: `تقرير التوظيف الأسبوعي المعتمد — ${new Date().toLocaleDateString('ar-SA')}`,
            metrics,
            strategicSummary: reportData.recommendation,
            logId: log.id
        };
    }

    /**
     * 6. TOOL 4: Propose Top 5 Candidates
     * Selects top candidates using deterministic DB scoring + explainable reasoning.
     * NEVER rejects or alters status without human approval.
     */
    async proposeTopCandidatesTool(companyId, taskId, userId) {
        // Find active candidates across open jobs
        const activeCandidates = await prisma.candidate.findMany({
            where: {
                recruitmentjob: { companyId, status: 'OPEN' },
                deletedAt: null,
                status: { in: ['APPLIED', 'SCREENING', 'SHORTLISTED'] }
            },
            include: {
                recruitmentjob: { select: { id: true, title: true, location: true } },
                candidateSkills: true,
                candidateExperiences: true,
                interviews: { select: { score: true, status: true } }
            },
            take: 50
        });

        if (activeCandidates.length === 0) {
            return {
                candidatesCount: 0,
                topCandidates: [],
                summary: 'لا يوجد مرشحون نشطون مؤهلون حالياً لترشيحهم للمقابلات.'
            };
        }

        // Rank candidates using deterministic multi-factor criteria
        const scoredCandidates = activeCandidates.map(c => {
            let score = c.aiScore || 0;
            const reasons = [];

            // Factor 1: Skills richness
            if (c.candidateSkills && c.candidateSkills.length >= 3) {
                score = Math.max(score, 65) + Math.min(15, c.candidateSkills.length * 3);
                reasons.push(`يمتلك ${c.candidateSkills.length} مهارات تقنية أساسية مسجلة`);
            }

            // Factor 2: Experience
            const expYears = c.yearsOfExperience || (c.candidateExperiences?.length ? c.candidateExperiences.length * 1.5 : 0);
            if (expYears >= 3) {
                score += 10;
                reasons.push(`خبرة عملية مثبتة تبلغ ${Math.round(expYears)} سنوات`);
            }

            // Factor 3: Interview performance if already screened
            const latestInterview = c.interviews?.[0];
            if (latestInterview && latestInterview.score) {
                score = Math.round((score + latestInterview.score) / 2);
                reasons.push(`تقييم ممتاز في المقابلة الأولية بواقع ${latestInterview.score}%`);
            }

            score = Math.min(98, Math.max(40, Math.round(score)));

            return {
                candidateId: c.id,
                fullName: c.fullName,
                email: c.email,
                jobTitle: c.recruitmentjob?.title,
                jobId: c.recruitmentjob?.id,
                calculatedScore: score,
                explainableReasons: reasons.length > 0 ? reasons : ['ملف مهني مكتمل الشروط والمعايير الأساسية'],
                currentStatus: c.status
            };
        });

        // Sort desc and take Top 5
        scoredCandidates.sort((a, b) => b.calculatedScore - a.calculatedScore);
        const top5 = scoredCandidates.slice(0, 5);

        const createdLogs = [];
        for (const top of top5) {
            // Deduplication: check if an unresolved recommendation already exists for this candidate & action
            let log = await prisma.agentLog.findFirst({
                where: {
                    companyId,
                    action: 'PROPOSE_TOP_5_CANDIDATE',
                    actionStatus: 'RECOMMENDED',
                    input: { path: ['candidateId'], equals: top.candidateId }
                }
            });

            if (!log) {
                log = await prisma.agentLog.create({
                    data: {
                        companyId,
                        taskId,
                        action: 'PROPOSE_TOP_5_CANDIDATE',
                        actionStatus: 'RECOMMENDED',
                        input: { candidateId: top.candidateId, name: top.fullName, targetJob: top.jobTitle },
                        output: { recommendedAction: 'DISPATCH_INTERVIEW_OFFER', score: top.calculatedScore },
                        evidence: {
                            score: top.calculatedScore,
                            reasons: top.explainableReasons,
                            guarantee: 'يتطلب موافقة بشرية مسبقة قبل إرسال العرض أو الانتقال'
                        },
                        performedBy: userId || 'SYSTEM_AGENT'
                    }
                });
            }

            top.logId = log.id;
            createdLogs.push(log);
        }

        return {
            poolSize: activeCandidates.length,
            topCandidatesCount: top5.length,
            topCandidates: top5,
            summary: `تم فرز وترشيح أفضل ${top5.length} كفاءات جاهزة لإجراء المقابلة المباشرة مع بيان أسباب التفضيل.`
        };
    }

    /**
     * 7. ACTION EXECUTION & PERMISSION GATING
     * Approves and executes a recommended action (human-in-the-loop).
     */
    async executeAction({ companyId, logId, decision, userId, userRole }) {
        if (!['ADMIN', 'MANAGER', 'SUPER_ADMIN'].includes(userRole)) {
            const err = new Error('غير مصرح: ليس لديك الصلاحية لاعتماد أو تنفيذ إجراءات الوكيل الذكي');
            err.statusCode = 403;
            throw err;
        }

        const log = await prisma.agentLog.findFirst({
            where: { id: logId, companyId }
        });

        if (!log) {
            const err = new Error('الإجراء أو التوصية غير موجودة أو تابعة لمنشأة أخرى');
            err.statusCode = 404;
            throw err;
        }

        if (log.actionStatus === 'EXECUTED') {
            return {
                success: true,
                message: 'تم تنفيذ هذا الإجراء مسبقاً (Idempotent)',
                log
            };
        }

        let updatedStatus = 'APPROVED';
        let executionOutput = {};

        if (decision === 'REJECT') {
            updatedStatus = 'REJECTED';
            executionOutput = { rejectedAt: new Date().toISOString(), rejectedBy: userId };
        } else {
            updatedStatus = 'EXECUTED';
            // Perform actual database updates based on action type
            if (log.action === 'PROPOSE_TOP_5_CANDIDATE' && log.input?.candidateId) {
                // Update candidate status to SHORTLISTED
                await prisma.candidate.update({
                    where: { id: log.input.candidateId },
                    data: { status: 'SHORTLISTED', updatedAt: new Date() }
                });
                executionOutput = { statusChangedTo: 'SHORTLISTED', candidateId: log.input.candidateId };
            } else if (log.action === 'RECOMMEND_CANDIDATE_FOLLOWUP' && log.input?.candidateId) {
                // Add a CandidateNote
                await prisma.candidateNote.create({
                    data: {
                        candidateId: log.input.candidateId,
                        authorId: userId,
                        authorName: 'وكيل التوظيف الآلي (معتمد)',
                        content: `تم اعتماد إرسال متابعة للمرشح: ${log.output?.suggestedMessage || 'متابعة سير الطلب'}`
                    }
                });
                executionOutput = { noteAdded: true, candidateId: log.input.candidateId };
            } else if (log.action === 'RECOMMEND_STALLED_JOB_FIX' && log.input?.jobId) {
                // Apply remedy to stalled job: increase salary range by 15% and mark job updated
                const currentJob = await prisma.recruitmentJob.findUnique({
                    where: { id: log.input.jobId }
                });

                if (currentJob) {
                    const oldSalaryMin = currentJob.salaryMin || 0;
                    const oldSalaryMax = currentJob.salaryMax || 0;
                    const newSalaryMin = currentJob.salaryMin ? Math.round(currentJob.salaryMin * 1.15) : 9000;
                    const newSalaryMax = currentJob.salaryMax ? Math.round(currentJob.salaryMax * 1.15) : Math.round(newSalaryMin * 1.35);

                    await prisma.recruitmentJob.update({
                        where: { id: currentJob.id },
                        data: {
                            salaryMin: newSalaryMin,
                            salaryMax: newSalaryMax,
                            updatedAt: new Date()
                        }
                    });
                    executionOutput = {
                        jobUpdated: true,
                        jobId: currentJob.id,
                        oldSalary: { min: oldSalaryMin, max: oldSalaryMax },
                        newSalary: { min: newSalaryMin, max: newSalaryMax },
                        newSalaryRange: `${newSalaryMin} - ${newSalaryMax}`
                    };
                }
            } else {
                executionOutput = { applied: true, timestamp: new Date().toISOString() };
            }
        }

        const updatedLog = await prisma.agentLog.update({
            where: { id: log.id },
            data: {
                actionStatus: updatedStatus,
                performedBy: userId,
                output: { ...(typeof log.output === 'object' ? log.output : {}), ...executionOutput }
            }
        });

        return {
            success: true,
            status: updatedStatus,
            log: updatedLog
        };
    }
}

export const recruitmentAgentService = new RecruitmentAgentService();
