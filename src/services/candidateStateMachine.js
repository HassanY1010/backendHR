/**
 * Candidate Pipeline State Machine
 * Defines valid lifecycle transitions, guards, and status metadata.
 */

export const CANDIDATE_STATUS = {
    NEW: 'NEW',
    APPLIED: 'APPLIED',
    SCREENING: 'SCREENING',
    AI_REVIEW: 'AI_REVIEW',
    SHORTLISTED: 'SHORTLISTED',
    INTERVIEW_SCHEDULED: 'INTERVIEW_SCHEDULED',
    INTERVIEW_SENT: 'INTERVIEW_SENT',
    INTERVIEWING: 'INTERVIEWING',
    INTERVIEW_COMPLETED: 'INTERVIEW_COMPLETED',
    OFFER_SENT: 'OFFER_SENT',
    OFFERED: 'OFFERED',
    PRE_ACCEPTED: 'PRE_ACCEPTED',
    ACCEPTED: 'ACCEPTED',
    HIRED: 'HIRED',
    REJECTED: 'REJECTED',
    WITHDRAWN: 'WITHDRAWN',
    NO_RESPONSE: 'NO_RESPONSE'
};

// Map equivalent/alias statuses for interoperability
export const NORMALIZE_STATUS = (rawStatus) => {
    if (!rawStatus) return rawStatus;
    const upper = String(rawStatus).trim().toUpperCase();
    if (upper === 'OFFER_EXTENDED') return CANDIDATE_STATUS.OFFER_SENT;
    return upper;
};

/**
 * Strict Allowed Transitions Mapping.
 * Every candidate status can transition to:
 * - Specific logical next steps
 * - REJECTED (disqualified at any stage)
 * - WITHDRAWN (candidate withdrew at any stage)
 * - NO_RESPONSE (candidate became unreachable)
 */
export const ALLOWED_CANDIDATE_TRANSITIONS = {
    // Initial application states
    [CANDIDATE_STATUS.NEW]: [
        CANDIDATE_STATUS.APPLIED,
        CANDIDATE_STATUS.SCREENING,
        CANDIDATE_STATUS.AI_REVIEW,
        CANDIDATE_STATUS.REJECTED,
        CANDIDATE_STATUS.WITHDRAWN,
        CANDIDATE_STATUS.NO_RESPONSE
    ],
    [CANDIDATE_STATUS.APPLIED]: [
        CANDIDATE_STATUS.SCREENING,
        CANDIDATE_STATUS.AI_REVIEW,
        CANDIDATE_STATUS.SHORTLISTED,
        CANDIDATE_STATUS.REJECTED,
        CANDIDATE_STATUS.WITHDRAWN,
        CANDIDATE_STATUS.NO_RESPONSE
    ],

    // Review & Shortlist
    [CANDIDATE_STATUS.SCREENING]: [
        CANDIDATE_STATUS.AI_REVIEW,
        CANDIDATE_STATUS.SHORTLISTED,
        CANDIDATE_STATUS.INTERVIEW_SCHEDULED,
        CANDIDATE_STATUS.INTERVIEW_SENT,
        CANDIDATE_STATUS.REJECTED,
        CANDIDATE_STATUS.WITHDRAWN,
        CANDIDATE_STATUS.NO_RESPONSE
    ],
    [CANDIDATE_STATUS.AI_REVIEW]: [
        CANDIDATE_STATUS.SCREENING,
        CANDIDATE_STATUS.SHORTLISTED,
        CANDIDATE_STATUS.INTERVIEW_SCHEDULED,
        CANDIDATE_STATUS.INTERVIEW_SENT,
        CANDIDATE_STATUS.REJECTED,
        CANDIDATE_STATUS.WITHDRAWN,
        CANDIDATE_STATUS.NO_RESPONSE
    ],
    [CANDIDATE_STATUS.SHORTLISTED]: [
        CANDIDATE_STATUS.INTERVIEW_SCHEDULED,
        CANDIDATE_STATUS.INTERVIEW_SENT,
        CANDIDATE_STATUS.INTERVIEWING,
        CANDIDATE_STATUS.OFFER_SENT,
        CANDIDATE_STATUS.OFFERED,
        CANDIDATE_STATUS.REJECTED,
        CANDIDATE_STATUS.WITHDRAWN,
        CANDIDATE_STATUS.NO_RESPONSE
    ],

    // Interview Stages
    [CANDIDATE_STATUS.INTERVIEW_SCHEDULED]: [
        CANDIDATE_STATUS.INTERVIEW_SENT,
        CANDIDATE_STATUS.INTERVIEWING,
        CANDIDATE_STATUS.INTERVIEW_COMPLETED,
        CANDIDATE_STATUS.SHORTLISTED, // allow rescheduling or returning to pool
        CANDIDATE_STATUS.REJECTED,
        CANDIDATE_STATUS.WITHDRAWN,
        CANDIDATE_STATUS.NO_RESPONSE
    ],
    [CANDIDATE_STATUS.INTERVIEW_SENT]: [
        CANDIDATE_STATUS.INTERVIEW_SCHEDULED,
        CANDIDATE_STATUS.INTERVIEWING,
        CANDIDATE_STATUS.INTERVIEW_COMPLETED,
        CANDIDATE_STATUS.REJECTED,
        CANDIDATE_STATUS.WITHDRAWN,
        CANDIDATE_STATUS.NO_RESPONSE
    ],
    [CANDIDATE_STATUS.INTERVIEWING]: [
        CANDIDATE_STATUS.INTERVIEW_COMPLETED,
        CANDIDATE_STATUS.INTERVIEW_SCHEDULED, // multiple rounds
        CANDIDATE_STATUS.SHORTLISTED,
        CANDIDATE_STATUS.OFFER_SENT,
        CANDIDATE_STATUS.OFFERED,
        CANDIDATE_STATUS.REJECTED,
        CANDIDATE_STATUS.WITHDRAWN,
        CANDIDATE_STATUS.NO_RESPONSE
    ],
    [CANDIDATE_STATUS.INTERVIEW_COMPLETED]: [
        CANDIDATE_STATUS.SHORTLISTED, // passed to subsequent round
        CANDIDATE_STATUS.INTERVIEW_SCHEDULED, // second round interview
        CANDIDATE_STATUS.OFFER_SENT,
        CANDIDATE_STATUS.OFFERED,
        CANDIDATE_STATUS.REJECTED,
        CANDIDATE_STATUS.WITHDRAWN,
        CANDIDATE_STATUS.NO_RESPONSE
    ],

    // Offer Stages
    [CANDIDATE_STATUS.OFFER_SENT]: [
        CANDIDATE_STATUS.OFFERED,
        CANDIDATE_STATUS.PRE_ACCEPTED,
        CANDIDATE_STATUS.ACCEPTED,
        CANDIDATE_STATUS.HIRED,
        CANDIDATE_STATUS.REJECTED,
        CANDIDATE_STATUS.WITHDRAWN,
        CANDIDATE_STATUS.NO_RESPONSE
    ],
    [CANDIDATE_STATUS.OFFERED]: [
        CANDIDATE_STATUS.OFFER_SENT,
        CANDIDATE_STATUS.PRE_ACCEPTED,
        CANDIDATE_STATUS.ACCEPTED,
        CANDIDATE_STATUS.HIRED,
        CANDIDATE_STATUS.REJECTED,
        CANDIDATE_STATUS.WITHDRAWN,
        CANDIDATE_STATUS.NO_RESPONSE
    ],
    [CANDIDATE_STATUS.PRE_ACCEPTED]: [
        CANDIDATE_STATUS.ACCEPTED,
        CANDIDATE_STATUS.HIRED,
        CANDIDATE_STATUS.REJECTED,
        CANDIDATE_STATUS.WITHDRAWN
    ],
    [CANDIDATE_STATUS.ACCEPTED]: [
        CANDIDATE_STATUS.HIRED,
        CANDIDATE_STATUS.WITHDRAWN,
        CANDIDATE_STATUS.REJECTED
    ],

    // Terminal State 1: Hired (Cannot transition backwards unless explicit administrative reactivate)
    [CANDIDATE_STATUS.HIRED]: [],

    // Disqualification / Inactive States (Can be reactivated to SCREENING or APPLIED with explicit review comment)
    [CANDIDATE_STATUS.REJECTED]: [
        CANDIDATE_STATUS.SCREENING,
        CANDIDATE_STATUS.APPLIED
    ],
    [CANDIDATE_STATUS.WITHDRAWN]: [
        CANDIDATE_STATUS.SCREENING,
        CANDIDATE_STATUS.APPLIED
    ],
    [CANDIDATE_STATUS.NO_RESPONSE]: [
        CANDIDATE_STATUS.SCREENING,
        CANDIDATE_STATUS.APPLIED
    ]
};

export class CandidateStateMachine {
    /**
     * Check if status transition is valid
     */
    static canTransition(currentStatus, targetStatus) {
        if (!currentStatus || !targetStatus) return false;
        const normalizedCurrent = NORMALIZE_STATUS(currentStatus);
        const normalizedTarget = NORMALIZE_STATUS(targetStatus);

        // Same status is a no-op
        if (normalizedCurrent === normalizedTarget) return true;

        const allowed = ALLOWED_CANDIDATE_TRANSITIONS[normalizedCurrent];
        if (!allowed) return false;

        return allowed.includes(normalizedTarget);
    }

    /**
     * Validate transition with detailed Arabic error message and guards
     */
    static validateTransition(currentStatus, targetStatus, { comment } = {}) {
        const normalizedCurrent = NORMALIZE_STATUS(currentStatus);
        const normalizedTarget = NORMALIZE_STATUS(targetStatus);

        if (!Object.values(CANDIDATE_STATUS).includes(normalizedTarget)) {
            const error = new Error(`حالة المرشح المستهدفة "${targetStatus}" غير معتمدة في النظام.`);
            error.statusCode = 400;
            throw error;
        }

        if (normalizedCurrent === normalizedTarget) {
            return true;
        }

        // Guard against modifications to already HIRED candidates
        if (normalizedCurrent === CANDIDATE_STATUS.HIRED) {
            const error = new Error('المرشح معين ومقبول بالفعل (HIRED). لا يمكن تغيير مرحلته.');
            error.statusCode = 400;
            throw error;
        }

        const allowed = ALLOWED_CANDIDATE_TRANSITIONS[normalizedCurrent] || [];
        if (!allowed.includes(normalizedTarget)) {
            const error = new Error(
                `انتقال غير مسموح به في مسار المرشح: لا يمكن الانتقال من حالة "${normalizedCurrent}" إلى حالة "${normalizedTarget}".`
            );
            error.statusCode = 400;
            throw error;
        }

        // Guard: Reactivating rejected/withdrawn candidates requires a reason/comment
        if (
            [CANDIDATE_STATUS.REJECTED, CANDIDATE_STATUS.WITHDRAWN, CANDIDATE_STATUS.NO_RESPONSE].includes(normalizedCurrent) &&
            [CANDIDATE_STATUS.SCREENING, CANDIDATE_STATUS.APPLIED].includes(normalizedTarget)
        ) {
            if (!comment || String(comment).trim().length < 5) {
                const error = new Error('إعادة تنشيط مرشح مستبعد تتطلب كتابة سبب أو ملاحظة توضيحية (5 أحرف على الأقل).');
                error.statusCode = 400;
                throw error;
            }
        }

        return true;
    }
}
