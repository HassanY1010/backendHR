/**
 * Job Request State Machine Service
 * Strictly enforces transitions and business rules.
 */

export const JOB_REQUEST_STATUS = {
  DRAFT: 'DRAFT',
  SUBMITTED: 'SUBMITTED',
  UNDER_REVIEW: 'UNDER_REVIEW',
  PENDING_APPROVAL: 'PENDING_APPROVAL',
  APPROVED: 'APPROVED',
  RECRUITMENT_STARTED: 'RECRUITMENT_STARTED',
  INTERVIEW_PROCESS: 'INTERVIEW_PROCESS',
  OFFER_STAGE: 'OFFER_STAGE',
  HIRED: 'HIRED',
  CLOSED: 'CLOSED',
  REJECTED: 'REJECTED',
  CANCELLED: 'CANCELLED',
  ON_HOLD: 'ON_HOLD'
};

export const ALLOWED_TRANSITIONS = {
  DRAFT: [JOB_REQUEST_STATUS.SUBMITTED, JOB_REQUEST_STATUS.CANCELLED],
  SUBMITTED: [JOB_REQUEST_STATUS.UNDER_REVIEW, JOB_REQUEST_STATUS.PENDING_APPROVAL, JOB_REQUEST_STATUS.REJECTED, JOB_REQUEST_STATUS.CANCELLED],
  UNDER_REVIEW: [JOB_REQUEST_STATUS.PENDING_APPROVAL, JOB_REQUEST_STATUS.REJECTED, JOB_REQUEST_STATUS.CANCELLED, JOB_REQUEST_STATUS.ON_HOLD],
  PENDING_APPROVAL: [JOB_REQUEST_STATUS.APPROVED, JOB_REQUEST_STATUS.REJECTED, JOB_REQUEST_STATUS.CANCELLED, JOB_REQUEST_STATUS.ON_HOLD],
  APPROVED: [JOB_REQUEST_STATUS.RECRUITMENT_STARTED, JOB_REQUEST_STATUS.ON_HOLD, JOB_REQUEST_STATUS.CANCELLED],
  RECRUITMENT_STARTED: [JOB_REQUEST_STATUS.INTERVIEW_PROCESS, JOB_REQUEST_STATUS.ON_HOLD, JOB_REQUEST_STATUS.CANCELLED],
  INTERVIEW_PROCESS: [JOB_REQUEST_STATUS.OFFER_STAGE, JOB_REQUEST_STATUS.ON_HOLD, JOB_REQUEST_STATUS.CANCELLED],
  OFFER_STAGE: [JOB_REQUEST_STATUS.HIRED, JOB_REQUEST_STATUS.ON_HOLD, JOB_REQUEST_STATUS.CANCELLED],
  HIRED: [JOB_REQUEST_STATUS.CLOSED],
  ON_HOLD: [JOB_REQUEST_STATUS.UNDER_REVIEW, JOB_REQUEST_STATUS.PENDING_APPROVAL, JOB_REQUEST_STATUS.RECRUITMENT_STARTED, JOB_REQUEST_STATUS.INTERVIEW_PROCESS, JOB_REQUEST_STATUS.OFFER_STAGE, JOB_REQUEST_STATUS.CANCELLED],
  REJECTED: [JOB_REQUEST_STATUS.DRAFT], // allow edit & resubmit
  CANCELLED: [],
  CLOSED: []
};

export class JobRequestStateMachine {
  static canTransition(currentStatus, targetStatus) {
    if (!currentStatus || !targetStatus) return false;
    if (currentStatus === targetStatus) return true;
    const allowed = ALLOWED_TRANSITIONS[currentStatus] || [];
    return allowed.includes(targetStatus);
  }

  static validateTransition(jobRequest, targetStatus) {
    const currentStatus = jobRequest.status;
    if (!this.canTransition(currentStatus, targetStatus)) {
      throw new Error(`انتقال غير مسموح به من حالة "${currentStatus}" إلى حالة "${targetStatus}".`);
    }

    // Guard rule 1: Mandatory job title & department
    if (!jobRequest.jobTitle) {
      throw new Error('لا يمكن معالجة الطلب بدون المسمى الوظيفي (Job Title).');
    }
    if (!jobRequest.departmentId) {
      throw new Error('لا يمكن إرسال أو اعتماد طلب بدون اختيار القسم.');
    }

    // Guard rule 2: Budget validation for Approval
    if (targetStatus === JOB_REQUEST_STATUS.APPROVED || targetStatus === JOB_REQUEST_STATUS.PENDING_APPROVAL) {
      if ((jobRequest.salaryMin || jobRequest.salaryMax) && !jobRequest.budgetCode) {
        throw new Error('يلزم توفر كود الميزانية (Budget Code) قبل اعتماد الطلب المالي.');
      }
    }

    // Guard rule 3: Interview Process requires prior Approval / Recruitment Start
    if (targetStatus === JOB_REQUEST_STATUS.INTERVIEW_PROCESS) {
      if (![JOB_REQUEST_STATUS.APPROVED, JOB_REQUEST_STATUS.RECRUITMENT_STARTED, JOB_REQUEST_STATUS.ON_HOLD].includes(currentStatus)) {
        throw new Error('لا يمكن الانتقال إلى مرحلة المقابلات قبل اعتماد الطلب وبدء التوظيف رسمياً.');
      }
    }

    // Guard rule 4: Closing request requires completion
    if (targetStatus === JOB_REQUEST_STATUS.CLOSED && currentStatus !== JOB_REQUEST_STATUS.HIRED) {
      throw new Error('لا يمكن إغلاق الطلب إلا بعد إتمام عملية التوظيف (Hired) أو توثيق الإلغاء.');
    }

    return true;
  }
}
