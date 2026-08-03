import { PrismaClient } from '@prisma/client';
import { JobRequestStateMachine, JOB_REQUEST_STATUS } from '../services/jobRequestStateMachine.js';

const prisma = new PrismaClient();

// Helper to generate request ID: JR-YYYYMMDD-XXXX
const generateRequestId = async (companyId) => {
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const count = await prisma.jobRequest.count({
    where: { companyId }
  });
  const seq = String(count + 1).padStart(4, '0');
  return `JR-${dateStr}-${seq}`;
};

// Helper: Notify users
const createNotification = async ({ userId, employeeId, title, message, type = 'info', priority = 'medium' }) => {
  try {
    await prisma.notification.create({
      data: {
        userId,
        employeeId,
        title,
        message,
        type,
        priority,
        updatedAt: new Date()
      }
    });
  } catch (err) {
    console.error('Failed to create notification:', err.message);
  }
};

// Helper: Audit log recording
const recordAuditLog = async ({ userId, companyId, action, oldStatus, newStatus, target, details }) => {
  try {
    await prisma.auditLog.create({
      data: {
        userId,
        companyId,
        action,
        actionType: 'JOB_REQUEST',
        target,
        status: 'success',
        details: JSON.stringify({ oldStatus, newStatus, ...details })
      }
    });
  } catch (err) {
    console.error('Failed to record audit log:', err.message);
  }
};

/**
 * Create a new Job Request
 * POST /api/job-requests
 */
export const createJobRequest = async (req, res) => {
  try {
    const { companyId, id: userId } = req.user;
    const {
      jobTitle,
      departmentId,
      hiringManagerId,
      location,
      employmentType,
      vacancies,
      jobSummary,
      requiredExperience,
      educationLevel,
      certifications,
      languages,
      responsibilities,
      salaryMin,
      salaryMax,
      budgetCode,
      costCenter,
      hiringReason,
      requiredDate,
      priority,
      skills = [],
      submitDirectly = false
    } = req.body;

    if (!jobTitle) {
      return res.status(400).json({ error: 'المسمى الوظيفي مطلوب' });
    }

    // Resolve or find valid department for company
    let validDepartmentId = departmentId;
    if (departmentId) {
      const existingDep = await prisma.department.findFirst({
        where: {
          companyId,
          OR: [{ id: departmentId }, { name: { contains: 'تكنولوجيا' } }, { name: { contains: 'الموارد' } }]
        }
      });
      if (existingDep) {
        validDepartmentId = existingDep.id;
      } else {
        // Find any existing department in company, or create a default one
        const anyDep = await prisma.department.findFirst({ where: { companyId } });
        if (anyDep) {
          validDepartmentId = anyDep.id;
        } else {
          const newDep = await prisma.department.create({
            data: {
              name: 'الإدارة العامة',
              companyId
            }
          });
          validDepartmentId = newDep.id;
        }
      }
    } else {
      const defaultDep = await prisma.department.findFirst({ where: { companyId } }) || 
        await prisma.department.create({ data: { name: 'الإدارة العامة', companyId } });
      validDepartmentId = defaultDep.id;
    }

    const requestId = await generateRequestId(companyId);
    const initialStatus = submitDirectly ? JOB_REQUEST_STATUS.SUBMITTED : JOB_REQUEST_STATUS.DRAFT;

    const jobRequest = await prisma.$transaction(async (tx) => {
      const created = await tx.jobRequest.create({
        data: {
          requestId,
          companyId,
          createdBy: userId,
          jobTitle,
          departmentId: validDepartmentId,
          hiringManagerId: hiringManagerId || userId,
          location: location || 'الرياض',
          employmentType: employmentType || 'FULL_TIME',
          vacancies: Number(vacancies) || 1,
          jobSummary,
          requiredExperience,
          educationLevel,
          certifications,
          languages,
          responsibilities,
          salaryMin: salaryMin ? parseFloat(salaryMin) : null,
          salaryMax: salaryMax ? parseFloat(salaryMax) : null,
          budgetCode,
          costCenter,
          hiringReason: hiringReason || 'NEW_POSITION',
          requiredDate: requiredDate ? new Date(requiredDate) : null,
          priority: priority || 'MEDIUM',
          status: initialStatus
        }
      });

      // Save Skills
      if (Array.isArray(skills) && skills.length > 0) {
        await tx.jobRequestSkill.createMany({
          data: skills.map((s) => ({
            jobRequestId: created.id,
            skillName: typeof s === 'string' ? s : s.skillName
          }))
        });
      }

      // History log
      await tx.jobRequestHistory.create({
        data: {
          jobRequestId: created.id,
          action: submitDirectly ? 'إنشاء وتقديم الطلب' : 'إنشاء مسودة الطلب',
          oldStatus: null,
          newStatus: initialStatus,
          performedBy: userId,
          comment: submitDirectly ? 'تم تقديم الطلب للمراجعة مباشرة عند الإنشاء' : 'تم حفظ مسودة الطلب'
        }
      });

      // If submitted, create initial HR Review approval step
      if (submitDirectly) {
        await tx.approvalRequest.create({
          data: {
            jobRequestId: created.id,
            approvalType: 'HR_REVIEW',
            stepOrder: 1,
            status: 'PENDING'
          }
        });
      }

      return created;
    });

    // Notify HR Managers if submitted directly
    if (submitDirectly) {
      const hrUsers = await prisma.user.findMany({
        where: { companyId, role: { in: ['ADMIN', 'SUPER_ADMIN', 'HR_MANAGER'] } }
      });
      for (const hr of hrUsers) {
        await createNotification({
          userId: hr.id,
          title: 'طلب توظيف جديد مقدم للمراجعة',
          message: `تم تقديم طلب توظيف جديد: ${jobTitle} (${requestId})`,
          type: 'job_request',
          priority: 'high'
        });
      }
    }

    await recordAuditLog({
      userId,
      companyId,
      action: 'CREATE_JOB_REQUEST',
      oldStatus: null,
      newStatus: initialStatus,
      target: jobRequest.id,
      details: { requestId, jobTitle }
    });

    const result = await prisma.jobRequest.findUnique({
      where: { id: jobRequest.id },
      include: {
        department: true,
        createdByUser: { select: { id: true, name: true, email: true } },
        hiringManager: { select: { id: true, name: true, email: true } },
        skills: true,
        approvals: true
      }
    });

    return res.status(201).json({ message: 'تم إنشاء طلب التوظيف بنجاح', data: result });
  } catch (err) {
    console.error('Error creating job request:', err);
    return res.status(500).json({ error: err.message || 'حدث خطأ أثناء إنشاء طلب التوظيف' });
  }
};

/**
 * Get List of Job Requests with stats & filters
 * GET /api/job-requests
 */
export const getJobRequests = async (req, res) => {
  try {
    const { companyId } = req.user;
    const { status, departmentId, priority, search, page = 1, limit = 20 } = req.query;

    const where = {
      companyId,
      deletedAt: null
    };

    if (status) where.status = status;
    if (departmentId) where.departmentId = departmentId;
    if (priority) where.priority = priority;

    if (search) {
      where.OR = [
        { jobTitle: { contains: search, mode: 'insensitive' } },
        { requestId: { contains: search, mode: 'insensitive' } },
        { budgetCode: { contains: search, mode: 'insensitive' } }
      ];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const take = parseInt(limit);

    const [total, requests] = await Promise.all([
      prisma.jobRequest.count({ where }),
      prisma.jobRequest.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: {
          department: true,
          createdByUser: { select: { id: true, name: true, email: true } },
          hiringManager: { select: { id: true, name: true, email: true } },
          skills: true,
          approvals: {
            include: { approver: { select: { id: true, name: true } } }
          }
        }
      })
    ]);

    return res.json({
      data: requests,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (err) {
    console.error('Error fetching job requests:', err);
    return res.status(500).json({ error: 'حدث خطأ أثناء جلب طلبات التوظيف' });
  }
};

/**
 * Get Job Requests Dashboard Metrics & Analytics
 * GET /api/job-requests/stats
 */
export const getJobRequestStats = async (req, res) => {
  try {
    const { companyId } = req.user;

    const allRequests = await prisma.jobRequest.findMany({
      where: { companyId, deletedAt: null },
      include: { department: true, history: true }
    });

    const totalRequests = allRequests.length;
    
    // Status counts
    const statusCounts = {};
    Object.values(JOB_REQUEST_STATUS).forEach(s => { statusCounts[s] = 0; });
    allRequests.forEach(r => {
      statusCounts[r.status] = (statusCounts[r.status] || 0) + 1;
    });

    // Overdue Requests (Pending or Submitted for > 5 days)
    const fiveDaysAgo = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000);
    const overdueCount = allRequests.filter(
      r => ['SUBMITTED', 'UNDER_REVIEW', 'PENDING_APPROVAL'].includes(r.status) && new Date(r.createdAt) < fiveDaysAgo
    ).length;

    // Department breakdown
    const departmentMap = {};
    allRequests.forEach(r => {
      const deptName = r.department?.name || 'غير محدد';
      departmentMap[deptName] = (departmentMap[deptName] || 0) + 1;
    });

    const topDepartments = Object.entries(departmentMap)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);

    // Calculate Average Approval Time (Hours from SUBMITTED to APPROVED)
    let totalApprovalHours = 0;
    let approvedCount = 0;

    allRequests.forEach(r => {
      if (r.status === 'APPROVED' || r.status === 'RECRUITMENT_STARTED' || r.status === 'HIRED' || r.status === 'CLOSED') {
        const submittedLog = r.history.find(h => h.newStatus === 'SUBMITTED');
        const approvedLog = r.history.find(h => h.newStatus === 'APPROVED');
        if (submittedLog && approvedLog) {
          const diffMs = new Date(approvedLog.createdAt) - new Date(submittedLog.createdAt);
          totalApprovalHours += diffMs / (1000 * 60 * 60);
          approvedCount++;
        }
      }
    });

    const avgApprovalTimeHours = approvedCount > 0 ? (totalApprovalHours / approvedCount).toFixed(1) : 0;

    // Open vs Closed
    const openJobs = statusCounts.APPROVED + statusCounts.RECRUITMENT_STARTED + statusCounts.INTERVIEW_PROCESS + statusCounts.OFFER_STAGE;
    const closedJobs = statusCounts.CLOSED + statusCounts.HIRED;

    return res.json({
      totalRequests,
      statusCounts,
      overdueCount,
      topDepartments,
      avgApprovalTimeHours: parseFloat(avgApprovalTimeHours),
      openJobs,
      closedJobs
    });
  } catch (err) {
    console.error('Error fetching job request stats:', err);
    return res.status(500).json({ error: 'حدث خطأ أثناء جلب إحصائيات الطلبات' });
  }
};

/**
 * Get single Job Request Details
 * GET /api/job-requests/:id
 */
export const getJobRequestById = async (req, res) => {
  try {
    const { companyId } = req.user;
    const { id } = req.params;

    const jobRequest = await prisma.jobRequest.findFirst({
      where: { id, companyId, deletedAt: null },
      include: {
        department: true,
        createdByUser: { select: { id: true, name: true, email: true, role: true } },
        hiringManager: { select: { id: true, name: true, email: true, role: true } },
        skills: true,
        approvals: {
          include: { approver: { select: { id: true, name: true, role: true } } },
          orderBy: { stepOrder: 'asc' }
        },
        history: {
          include: { performer: { select: { id: true, name: true, role: true } } },
          orderBy: { createdAt: 'desc' }
        }
      }
    });

    if (!jobRequest) {
      return res.status(404).json({ error: 'طلب التوظيف غير موجود' });
    }

    return res.json({ data: jobRequest });
  } catch (err) {
    console.error('Error fetching job request details:', err);
    return res.status(500).json({ error: 'حدث خطأ أثناء جلب تفاصيل طلب التوظيف' });
  }

/**
 * Soft Delete Job Request
 * DELETE /api/job-requests/:id
 */
export const deleteJobRequest = async (req, res) => {
  try {
    const { companyId, id: userId } = req.user;
    const { id } = req.params;

    const existing = await prisma.jobRequest.findFirst({
      where: { id, companyId, deletedAt: null }
    });

    if (!existing) {
      return res.status(404).json({ error: 'طلب التوظيف غير موجود' });
    }

    await prisma.jobRequest.update({
      where: { id },
      data: { deletedAt: new Date() }
    });

    await recordAuditLog({
      userId,
      companyId,
      action: 'DELETE_JOB_REQUEST',
      oldStatus: existing.status,
      newStatus: 'DELETED',
      target: id,
      details: { requestId: existing.requestId }
    });

    return res.json({ message: 'تم حذف طلب التوظيف بنجاح' });
  } catch (err) {
    console.error('Error deleting job request:', err);
    return res.status(500).json({ error: 'حدث خطأ أثناء حذف طلب التوظيف' });
  }
};

/**
 * Update Job Request Details
 * PUT /api/job-requests/:id
 */
export const updateJobRequest = async (req, res) => {
  try {
    const { companyId, id: userId } = req.user;
    const { id } = req.params;

    const existing = await prisma.jobRequest.findFirst({
      where: { id, companyId, deletedAt: null }
    });

    if (!existing) {
      return res.status(404).json({ error: 'طلب التوظيف غير موجود' });
    }

    if (!['DRAFT', 'REJECTED', 'UNDER_REVIEW'].includes(existing.status)) {
      return res.status(400).json({ error: `لا يمكن تعديل الطلب وهو في حالة "${existing.status}"` });
    }

    const {
      jobTitle,
      departmentId,
      hiringManagerId,
      location,
      employmentType,
      vacancies,
      jobSummary,
      requiredExperience,
      educationLevel,
      certifications,
      languages,
      responsibilities,
      salaryMin,
      salaryMax,
      budgetCode,
      costCenter,
      hiringReason,
      requiredDate,
      priority,
      skills
    } = req.body;

    const updated = await prisma.$transaction(async (tx) => {
      const result = await tx.jobRequest.update({
        where: { id },
        data: {
          jobTitle: jobTitle || existing.jobTitle,
          departmentId: departmentId || existing.departmentId,
          hiringManagerId: hiringManagerId || existing.hiringManagerId,
          location: location || existing.location,
          employmentType: employmentType || existing.employmentType,
          vacancies: vacancies !== undefined ? Number(vacancies) : existing.vacancies,
          jobSummary: jobSummary !== undefined ? jobSummary : existing.jobSummary,
          requiredExperience: requiredExperience !== undefined ? requiredExperience : existing.requiredExperience,
          educationLevel: educationLevel !== undefined ? educationLevel : existing.educationLevel,
          certifications: certifications !== undefined ? certifications : existing.certifications,
          languages: languages !== undefined ? languages : existing.languages,
          responsibilities: responsibilities !== undefined ? responsibilities : existing.responsibilities,
          salaryMin: salaryMin !== undefined ? (salaryMin ? parseFloat(salaryMin) : null) : existing.salaryMin,
          salaryMax: salaryMax !== undefined ? (salaryMax ? parseFloat(salaryMax) : null) : existing.salaryMax,
          budgetCode: budgetCode !== undefined ? budgetCode : existing.budgetCode,
          costCenter: costCenter !== undefined ? costCenter : existing.costCenter,
          hiringReason: hiringReason || existing.hiringReason,
          requiredDate: requiredDate ? new Date(requiredDate) : existing.requiredDate,
          priority: priority || existing.priority
        }
      });

      if (Array.isArray(skills)) {
        await tx.jobRequestSkill.deleteMany({ where: { jobRequestId: id } });
        if (skills.length > 0) {
          await tx.jobRequestSkill.createMany({
            data: skills.map((s) => ({
              jobRequestId: id,
              skillName: typeof s === 'string' ? s : s.skillName
            }))
          });
        }
      }

      await tx.jobRequestHistory.create({
        data: {
          jobRequestId: id,
          action: 'تحديث بيانات الطلب',
          oldStatus: existing.status,
          newStatus: existing.status,
          performedBy: userId,
          comment: 'تم إجراء تعديلات على بيانات الطلب'
        }
      });

      return result;
    });

    await recordAuditLog({
      userId,
      companyId,
      action: 'UPDATE_JOB_REQUEST',
      oldStatus: existing.status,
      newStatus: existing.status,
      target: id,
      details: { requestId: existing.requestId }
    });

    return res.json({ message: 'تم تحديث طلب التوظيف بنجاح', data: updated });
  } catch (err) {
    console.error('Error updating job request:', err);
    return res.status(500).json({ error: 'حدث خطأ أثناء تعديل طلب التوظيف' });
  }
};

/**
 * Submit Job Request for Review/Approval
 * POST /api/job-requests/:id/submit
 */
export const submitJobRequest = async (req, res) => {
  try {
    const { companyId, id: userId } = req.user;
    const { id } = req.params;

    const jobRequest = await prisma.jobRequest.findFirst({
      where: { id, companyId, deletedAt: null }
    });

    if (!jobRequest) {
      return res.status(404).json({ error: 'طلب التوظيف غير موجود' });
    }

    // Validate state machine
    JobRequestStateMachine.validateTransition(jobRequest, JOB_REQUEST_STATUS.SUBMITTED);

    await prisma.$transaction(async (tx) => {
      await tx.jobRequest.update({
        where: { id },
        data: { status: JOB_REQUEST_STATUS.SUBMITTED }
      });

      await tx.jobRequestHistory.create({
        data: {
          jobRequestId: id,
          action: 'تقديم الطلب للمراجعة',
          oldStatus: jobRequest.status,
          newStatus: JOB_REQUEST_STATUS.SUBMITTED,
          performedBy: userId,
          comment: 'تم تقديم الطلب لبدء دورة الموافقة الرسمية'
        }
      });

      // Clear old approvals and setup 3-tier approval chain (HR -> Finance -> Executive if high cost)
      await tx.approvalRequest.deleteMany({ where: { jobRequestId: id } });

      const approvalChain = [
        { approvalType: 'HR_REVIEW', stepOrder: 1 }
      ];

      if (jobRequest.salaryMin || jobRequest.salaryMax || jobRequest.budgetCode) {
        approvalChain.push({ approvalType: 'FINANCE_APPROVAL', stepOrder: 2 });
      }

      if (jobRequest.priority === 'URGENT' || (jobRequest.vacancies && jobRequest.vacancies > 3)) {
        approvalChain.push({ approvalType: 'EXECUTIVE_APPROVAL', stepOrder: 3 });
      }

      for (const step of approvalChain) {
        await tx.approvalRequest.create({
          data: {
            jobRequestId: id,
            approvalType: step.approvalType,
            stepOrder: step.stepOrder,
            status: 'PENDING'
          }
        });
      }
    });

    // Send notifications to HR Managers
    const hrUsers = await prisma.user.findMany({
      where: { companyId, role: { in: ['ADMIN', 'SUPER_ADMIN', 'HR_MANAGER'] } }
    });
    for (const hr of hrUsers) {
      await createNotification({
        userId: hr.id,
        title: 'طلب توظيف بحاجة لمراجعة HR',
        message: `تم إرسال طلب التوظيف ${jobRequest.jobTitle} (${jobRequest.requestId}) للمراجعة.`,
        type: 'job_request_approval',
        priority: 'high'
      });
    }

    await recordAuditLog({
      userId,
      companyId,
      action: 'SUBMIT_JOB_REQUEST',
      oldStatus: jobRequest.status,
      newStatus: JOB_REQUEST_STATUS.SUBMITTED,
      target: id,
      details: { requestId: jobRequest.requestId }
    });

    return res.json({ message: 'تم إرسال الطلب للمراجعة بنجاح' });
  } catch (err) {
    console.error('Error submitting job request:', err);
    return res.status(400).json({ error: err.message || 'حدث خطأ أثناء تقديم طلب التوظيف' });
  }
};

/**
 * Approve Job Request (Multi-tier approval)
 * POST /api/job-requests/:id/approve
 */
export const approveJobRequest = async (req, res) => {
  try {
    const { companyId, id: userId, role } = req.user;
    const { id } = req.params;
    const { comment } = req.body;

    const jobRequest = await prisma.jobRequest.findFirst({
      where: { id, companyId, deletedAt: null },
      include: { approvals: { orderBy: { stepOrder: 'asc' } } }
    });

    if (!jobRequest) {
      return res.status(404).json({ error: 'طلب التوظيف غير موجود' });
    }

    // Find pending approval step
    const pendingStep = jobRequest.approvals.find((a) => a.status === 'PENDING');

    if (!pendingStep) {
      if (jobRequest.status === JOB_REQUEST_STATUS.APPROVED) {
        return res.status(400).json({ error: 'الطلب معتمد بالفعل سابقاً' });
      }
    }

    // Role check for pending step
    if (pendingStep) {
      if (pendingStep.approvalType === 'HR_REVIEW' && !['ADMIN', 'SUPER_ADMIN', 'HR_MANAGER', 'MANAGER'].includes(role)) {
        return res.status(403).json({ error: 'غير مصرح لك بمراجعة طلبات HR' });
      }
      if (pendingStep.approvalType === 'FINANCE_APPROVAL' && !['ADMIN', 'SUPER_ADMIN', 'FINANCE_MANAGER'].includes(role)) {
        return res.status(403).json({ error: 'غير مصرح لك باكتفاء واعتمد الميزانية المالية' });
      }
      if (pendingStep.approvalType === 'EXECUTIVE_APPROVAL' && !['ADMIN', 'SUPER_ADMIN', 'CEO_EXECUTIVE'].includes(role)) {
        return res.status(403).json({ error: 'غير مصرح لك بالموافقة التنفيذية النهائية' });
      }
    }

    await prisma.$transaction(async (tx) => {
      if (pendingStep) {
        await tx.approvalRequest.update({
          where: { id: pendingStep.id },
          data: {
            status: 'APPROVED',
            approverId: userId,
            comment: comment || 'تمت الموافقة',
            approvedAt: new Date()
          }
        });
      }

      // Check remaining approvals
      const remainingPending = await tx.approvalRequest.count({
        where: { jobRequestId: id, status: 'PENDING' }
      });

      let nextStatus = jobRequest.status;
      if (remainingPending === 0) {
        nextStatus = JOB_REQUEST_STATUS.APPROVED;
        JobRequestStateMachine.validateTransition(jobRequest, nextStatus);

        await tx.jobRequest.update({
          where: { id },
          data: { status: nextStatus }
        });
      } else {
        nextStatus = JOB_REQUEST_STATUS.PENDING_APPROVAL;
        await tx.jobRequest.update({
          where: { id },
          data: { status: nextStatus }
        });
      }

      await tx.jobRequestHistory.create({
        data: {
          jobRequestId: id,
          action: remainingPending === 0 ? 'اعتماد الطلب بالكامل' : `موافقة مرحلية (${pendingStep?.approvalType || 'موافقة'})`,
          oldStatus: jobRequest.status,
          newStatus: nextStatus,
          performedBy: userId,
          comment: comment || 'تمت الموافقة'
        }
      });
    });

    // Notifications logic
    if (jobRequest.createdBy) {
      await createNotification({
        userId: jobRequest.createdBy,
        title: 'تحديث على طلب التوظيف',
        message: `تمت الموافقة على طلب التوظيف ${jobRequest.jobTitle} (${jobRequest.requestId})`,
        type: 'job_request_status',
        priority: 'medium'
      });
    }

    // Notify recruiters if fully approved
    const recruiters = await prisma.user.findMany({
      where: { companyId, role: { in: ['ADMIN', 'SUPER_ADMIN', 'RECRUITER', 'HR_MANAGER'] } }
    });
    for (const rec of recruiters) {
      await createNotification({
        userId: rec.id,
        title: 'طلب توظيف معتمد وجاهز للبدء',
        message: `تم اعتماد طلب التوظيف ${jobRequest.jobTitle} ويمكنك الآن إطلاق العملية التوظيفية.`,
        type: 'recruitment_ready',
        priority: 'high'
      });
    }

    await recordAuditLog({
      userId,
      companyId,
      action: 'APPROVE_JOB_REQUEST',
      oldStatus: jobRequest.status,
      newStatus: JOB_REQUEST_STATUS.APPROVED,
      target: id,
      details: { requestId: jobRequest.requestId, comment }
    });

    return res.json({ message: 'تم اعتماد طلب التوظيف بنجاح' });
  } catch (err) {
    console.error('Error approving job request:', err);
    return res.status(400).json({ error: err.message || 'حدث خطأ أثناء اعتماد طلب التوظيف' });
  }
};

/**
 * Reject Job Request
 * POST /api/job-requests/:id/reject
 */
export const rejectJobRequest = async (req, res) => {
  try {
    const { companyId, id: userId } = req.user;
    const { id } = req.params;
    const { comment } = req.body;

    if (!comment) {
      return res.status(400).json({ error: 'سبب الرفض مطلوب' });
    }

    const jobRequest = await prisma.jobRequest.findFirst({
      where: { id, companyId, deletedAt: null }
    });

    if (!jobRequest) {
      return res.status(404).json({ error: 'طلب التوظيف غير موجود' });
    }

    JobRequestStateMachine.validateTransition(jobRequest, JOB_REQUEST_STATUS.REJECTED);

    await prisma.$transaction(async (tx) => {
      await tx.jobRequest.update({
        where: { id },
        data: { status: JOB_REQUEST_STATUS.REJECTED }
      });

      await tx.approvalRequest.updateMany({
        where: { jobRequestId: id, status: 'PENDING' },
        data: { status: 'REJECTED', approverId: userId, comment }
      });

      await tx.jobRequestHistory.create({
        data: {
          jobRequestId: id,
          action: 'رفض طلب التوظيف',
          oldStatus: jobRequest.status,
          newStatus: JOB_REQUEST_STATUS.REJECTED,
          performedBy: userId,
          comment
        }
      });
    });

    if (jobRequest.createdBy) {
      await createNotification({
        userId: jobRequest.createdBy,
        title: 'تم رفض طلب التوظيف',
        message: `للأسف، تم رفض طلب التوظيف ${jobRequest.jobTitle}. السبب: ${comment}`,
        type: 'job_request_rejected',
        priority: 'high'
      });
    }

    await recordAuditLog({
      userId,
      companyId,
      action: 'REJECT_JOB_REQUEST',
      oldStatus: jobRequest.status,
      newStatus: JOB_REQUEST_STATUS.REJECTED,
      target: id,
      details: { requestId: jobRequest.requestId, comment }
    });

    return res.json({ message: 'تم رفض طلب التوظيف وتحديث حالته' });
  } catch (err) {
    console.error('Error rejecting job request:', err);
    return res.status(400).json({ error: err.message || 'حدث خطأ أثناء رفض طلب التوظيف' });
  }
};

/**
 * Custom State Transition (Recruitment Started, Interview Process, Offer Stage, Hired, Closed, On Hold)
 * POST /api/job-requests/:id/transition
 */
export const transitionState = async (req, res) => {
  try {
    const { companyId, id: userId } = req.user;
    const { id } = req.params;
    const { targetStatus, comment } = req.body;

    if (!targetStatus || !JOB_REQUEST_STATUS[targetStatus]) {
      return res.status(400).json({ error: 'الحالة المستهدفة غير صالحة' });
    }

    const jobRequest = await prisma.jobRequest.findFirst({
      where: { id, companyId, deletedAt: null }
    });

    if (!jobRequest) {
      return res.status(404).json({ error: 'طلب التوظيف غير موجود' });
    }

    JobRequestStateMachine.validateTransition(jobRequest, targetStatus);

    await prisma.$transaction(async (tx) => {
      await tx.jobRequest.update({
        where: { id },
        data: { status: targetStatus }
      });

      await tx.jobRequestHistory.create({
        data: {
          jobRequestId: id,
          action: `تغيير الحالة إلى ${targetStatus}`,
          oldStatus: jobRequest.status,
          newStatus: targetStatus,
          performedBy: userId,
          comment: comment || `تحديث حالة طلب التوظيف إلى ${targetStatus}`
        }
      });
    });

    await recordAuditLog({
      userId,
      companyId,
      action: `TRANSITION_${targetStatus}`,
      oldStatus: jobRequest.status,
      newStatus: targetStatus,
      target: id,
      details: { requestId: jobRequest.requestId, comment }
    });

    return res.json({ message: `تم تغيير حالة الطلب إلى ${targetStatus} بنجاح` });
  } catch (err) {
    console.error('Error transitioning job request state:', err);
    return res.status(400).json({ error: err.message || 'حدث خطأ أثناء تغيير حالة الطلب' });
  }
};

/**
 * Convert Approved Job Request to active Recruitment Job
 * POST /api/job-requests/:id/convert-to-job
 */
export const convertToRecruitmentJob = async (req, res) => {
  try {
    const { companyId, id: userId } = req.user;
    const { id } = req.params;

    const jobRequest = await prisma.jobRequest.findFirst({
      where: { id, companyId, deletedAt: null },
      include: { skills: true, department: true }
    });

    if (!jobRequest) {
      return res.status(404).json({ error: 'طلب التوظيف غير موجود' });
    }

    if (!['APPROVED', 'RECRUITMENT_STARTED'].includes(jobRequest.status)) {
      return res.status(400).json({ error: 'يجب أن يكون طلب التوظيف معتمداً تحويله إلى وظيفة نشطة' });
    }

    const createdJob = await prisma.$transaction(async (tx) => {
      const recruitmentJob = await tx.recruitmentJob.create({
        data: {
          companyId,
          departmentId: jobRequest.departmentId,
          title: jobRequest.jobTitle,
          department: jobRequest.department?.name,
          location: jobRequest.location,
          employmentType: jobRequest.employmentType === 'PART_TIME' ? 'PART_TIME' : jobRequest.employmentType === 'CONTRACT' ? 'CONTRACT' : 'FULL_TIME',
          workMode: jobRequest.employmentType === 'REMOTE' ? 'REMOTE' : jobRequest.employmentType === 'HYBRID' ? 'HYBRID' : 'ONSITE',
          salaryMin: jobRequest.salaryMin ? Math.round(jobRequest.salaryMin) : null,
          salaryMax: jobRequest.salaryMax ? Math.round(jobRequest.salaryMax) : null,
          description: jobRequest.jobSummary || jobRequest.jobTitle,
          requirements: jobRequest.requiredExperience,
          responsibilities: jobRequest.responsibilities,
          status: 'OPEN',
          createdBy: userId
        }
      });

      await tx.jobRequest.update({
        where: { id },
        data: { status: 'RECRUITMENT_STARTED' }
      });

      await tx.jobRequestHistory.create({
        data: {
          jobRequestId: id,
          action: 'تحويل الطلب إلى وظيفة توظيف نشطة',
          oldStatus: jobRequest.status,
          newStatus: 'RECRUITMENT_STARTED',
          performedBy: userId,
          comment: `تم إنشاء إعلان وظيفة برقم معرف ${recruitmentJob.id}`
        }
      });

      return recruitmentJob;
    });

    return res.status(201).json({
      message: 'تم تحويل طلب التوظيف بنجاح ونشر الوظيفة في قسم Recruitment',
      data: createdJob
    });
  } catch (err) {
    console.error('Error converting job request:', err);
    return res.status(500).json({ error: err.message || 'حدث خطأ أثناء تحويل طلب التوظيف' });
  }
};
