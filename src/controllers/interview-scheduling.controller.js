import crypto from 'crypto';
import prisma from '../config/db.js';
import logger from '../utils/logger.js';
import InterviewAvailabilityService from '../services/interview-availability.service.js';
import CalendarService from '../services/calendar.service.js';
import { emailService } from '../services/email.service.js';

/**
 * Controller for Candidate Self-Service and Recruiter Managed Interview Scheduling
 */

// Helper to generate a SHA-256 hash from raw token
const hashToken = (token) => {
    return crypto.createHash('sha256').update(token).digest('hex');
};

/**
 * 1. Recruiter creates/sends a Scheduling Session Link to a Candidate
 * POST /api/interviews/scheduling-session
 */
export const createSchedulingSession = async (req, res, next) => {
    try {
        const companyId = req.user.companyId;
        const { candidateId, interviewerId, interviewType = 'VIDEO', duration = 45, location, meetingUrl, expiryHours = 72 } = req.body;

        if (!candidateId || !interviewerId) {
            return res.status(400).json({ status: 'error', message: 'Candidate ID and Interviewer ID are required.' });
        }

        // Verify Candidate belongs to company
        const candidate = await prisma.candidate.findFirst({
            where: { id: candidateId, deletedAt: null },
            include: { recruitmentjob: true }
        });

        if (!candidate || candidate.recruitmentjob.companyId !== companyId) {
            return res.status(404).json({ status: 'error', message: 'Candidate not found in company.' });
        }

        // Verify Interviewer is an active user in the same company
        const interviewer = await prisma.user.findFirst({
            where: { id: interviewerId, companyId, status: 'ACTIVE', deletedAt: null }
        });

        if (!interviewer) {
            return res.status(404).json({ status: 'error', message: 'Interviewer not found or not active in this company.' });
        }

        // Generate raw random unguessable token and store tokenHash
        const rawToken = crypto.randomBytes(32).toString('hex');
        const tokenHash = hashToken(rawToken);
        const expiresAt = new Date(Date.now() + expiryHours * 60 * 60 * 1000);

        const session = await prisma.schedulingSession.create({
            data: {
                companyId,
                candidateId,
                jobId: candidate.jobId,
                interviewerId,
                tokenHash,
                interviewType,
                duration: parseInt(duration, 10) || 45,
                location: location || null,
                meetingUrl: meetingUrl || null,
                status: 'ACTIVE',
                expiresAt
            }
        });

        // Construct candidate booking link
        const frontendUrl = (process.env.FRONTEND_URL || 'http://localhost:5173').replace(/\/+$/, '');
        const bookingUrl = `${frontendUrl}/book-interview/${rawToken}`;

        // Send email non-blockingly
        emailService.sendInterviewSchedulingLinkEmail(candidate, candidate.recruitmentjob, bookingUrl, interviewer.name)
            .catch(err => logger.error('[Interview] Failed sending scheduling link email:', err));

        // Create In-App Notification for Recruiter
        await prisma.notification.create({
            data: {
                userId: interviewer.id,
                title: 'تم إنشاء رابط حجز المقابلة',
                message: `تم إرسال رابط حجز المقابلة للمرشح ${candidate.fullName} لوظيفة ${candidate.recruitmentjob.title}.`,
                type: 'INTERVIEW_LINK_SENT',
                metadata: JSON.stringify({ candidateId, jobId: candidate.jobId, sessionId: session.id }),
                updatedAt: new Date()
            }
        });

        // Audit Trail via CandidateHistory
        await prisma.candidateHistory.create({
            data: {
                candidateId,
                action: 'INTERVIEW_LINK_GENERATED',
                comment: `تم إنشاء وإرسال رابط حجز المقابلة (صالح لمدة ${expiryHours} ساعة)`,
                performedBy: req.user.name || 'System'
            }
        });

        res.status(201).json({
            status: 'success',
            data: {
                sessionId: session.id,
                bookingUrl,
                expiresAt: session.expiresAt,
                duration: session.duration,
                interviewType: session.interviewType
            }
        });
    } catch (error) {
        next(error);
    }
};

/**
 * 2. Public Endpoint: Get Public Session Details
 * GET /api/interviews/session/:token
 */
export const getSessionDetails = async (req, res, next) => {
    try {
        const { token } = req.params;
        if (!token) {
            return res.status(400).json({ status: 'error', message: 'Token is required' });
        }

        const tokenHash = hashToken(token);
        const session = await prisma.schedulingSession.findUnique({
            where: { tokenHash },
            include: {
                candidate: {
                    select: {
                        id: true,
                        fullName: true,
                        email: true,
                        recruitmentjob: { select: { id: true, title: true, department: true } }
                    }
                },
                interviewer: {
                    select: {
                        id: true,
                        name: true,
                        role: true,
                        avatar: true
                    }
                }
            }
        });

        if (!session) {
            return res.status(404).json({ status: 'error', code: 'INVALID_TOKEN', message: 'رابط الحجز غير صحيح أو غير موجود' });
        }

        if (session.status !== 'ACTIVE') {
            return res.status(400).json({ status: 'error', code: `SESSION_${session.status}`, message: 'رابط الحجز هذا تم استخدامه بالفعل أو ملغى' });
        }

        if (new Date() > new Date(session.expiresAt)) {
            return res.status(410).json({ status: 'error', code: 'SESSION_EXPIRED', message: 'انتهت صلاحية رابط الحجز المخصص لك' });
        }

        res.status(200).json({
            status: 'success',
            data: {
                candidateName: session.candidate.fullName,
                jobTitle: session.candidate.recruitmentjob?.title,
                interviewerName: session.interviewer.name,
                interviewType: session.interviewType,
                duration: session.duration,
                expiresAt: session.expiresAt,
                location: session.location
            }
        });
    } catch (error) {
        next(error);
    }
};

/**
 * 3. Public Endpoint: Get Available Slots for a Candidate Booking Token
 * GET /api/interviews/available-slots/:token
 */
export const getAvailableSlotsForToken = async (req, res, next) => {
    try {
        const { token } = req.params;
        const { timezone = 'Asia/Riyadh' } = req.query;

        if (!token) {
            return res.status(400).json({ status: 'error', message: 'Token is required' });
        }

        const tokenHash = hashToken(token);
        const session = await prisma.schedulingSession.findUnique({
            where: { tokenHash }
        });

        if (!session || session.status !== 'ACTIVE' || new Date() > new Date(session.expiresAt)) {
            return res.status(400).json({ status: 'error', message: 'جلسة الحجز غير صالحة أو منتهية الصلاحية' });
        }

        const slots = await InterviewAvailabilityService.getAvailableSlots({
            companyId: session.companyId,
            interviewerId: session.interviewerId,
            duration: session.duration,
            targetTimezone: timezone
        });

        res.status(200).json({
            status: 'success',
            data: {
                duration: session.duration,
                timezone,
                slots
            }
        });
    } catch (error) {
        next(error);
    }
};

/**
 * 4. Public Endpoint: Book an Interview Slot (Concurrency Safe & Atomic)
 * POST /api/interviews/book
 */
export const bookInterview = async (req, res, next) => {
    try {
        const { token, startTime, timezone = 'Asia/Riyadh', notes } = req.body;

        if (!token || !startTime) {
            return res.status(400).json({ status: 'error', message: 'Token and startTime are required' });
        }

        const tokenHash = hashToken(token);

        // Fetch session
        const session = await prisma.schedulingSession.findUnique({
            where: { tokenHash },
            include: {
                candidate: { include: { recruitmentjob: true } },
                interviewer: true
            }
        });

        if (!session) {
            return res.status(404).json({ status: 'error', message: 'رابط الحجز غير صحيح' });
        }

        if (session.status !== 'ACTIVE') {
            return res.status(409).json({ status: 'error', code: 'ALREADY_BOOKED', message: 'تم استخدام رابط الحجز هذا مسبقاً' });
        }

        if (new Date() > new Date(session.expiresAt)) {
            return res.status(410).json({ status: 'error', message: 'انتهت صلاحية رابط الحجز' });
        }

        const slotStart = new Date(startTime);
        const slotEnd = new Date(slotStart.getTime() + (session.duration || 45) * 60 * 1000);

        // 72-hour and overlap validation
        const validation = await InterviewAvailabilityService.validateSlotBooking({
            companyId: session.companyId,
            interviewerId: session.interviewerId,
            startTime: slotStart,
            endTime: slotEnd
        });

        if (!validation.valid) {
            return res.status(validation.isConflict ? 409 : 400).json({
                status: 'error',
                code: validation.isConflict ? 'SLOT_CONFLICT' : 'INVALID_SLOT',
                message: validation.error
            });
        }

        // Execute Atomic Interactive Transaction with Concurrency Lock on Interviewer User
        const bookedInterview = await prisma.$transaction(async (tx) => {
            // 1. Acquire PostgreSQL Row-Level Exclusive Lock on the interviewer User row
            await tx.$queryRaw`SELECT id FROM "user" WHERE id = ${session.interviewerId} FOR UPDATE`;

            // 2. Re-check overlap inside transaction for absolute race-condition guarantee
            const conflict = await tx.interview.findFirst({
                where: {
                    companyId: session.companyId,
                    interviewerId: session.interviewerId,
                    status: { in: ['scheduled', 'rescheduled', 'in_progress'] },
                    startTime: { lt: slotEnd },
                    endTime: { gt: slotStart }
                }
            });

            if (conflict) {
                throw new Error('SLOT_CONFLICT');
            }

            // Create Interview record
            const interview = await tx.interview.create({
                data: {
                    companyId: session.companyId,
                    candidateId: session.candidateId,
                    jobId: session.jobId,
                    interviewerId: session.interviewerId,
                    interviewerName: session.interviewer.name,
                    type: session.interviewType,
                    status: 'scheduled',
                    scheduledAt: slotStart,
                    startTime: slotStart,
                    endTime: slotEnd,
                    duration: session.duration,
                    timezone,
                    location: session.location,
                    meetingUrl: session.meetingUrl || `https://meet.google.com/${crypto.randomBytes(4).toString('hex')}-${crypto.randomBytes(3).toString('hex')}`,
                    schedulingSessionId: session.id,
                    notes: notes || null
                }
            });

            // Mark session as USED atomically
            await tx.schedulingSession.update({
                where: { id: session.id },
                data: {
                    status: 'USED',
                    usedAt: new Date()
                }
            });

            // Log Candidate History
            await tx.candidateHistory.create({
                data: {
                    candidateId: session.candidateId,
                    action: 'INTERVIEW_BOOKED',
                    comment: `تم حجز موعد مقابلة بنجاح في ${slotStart.toISOString()} مع ${session.interviewer.name}`,
                    performedBy: 'Candidate (Self-Service)'
                }
            });

            return interview;
        }, {
            maxWait: 10000, // Wait up to 10s to acquire transaction slot
            timeout: 20000  // Allow up to 20s for remote PostgreSQL execution
        });

        // Non-blocking Calendar Sync & Email Notification
        CalendarService.syncInterviewEvent({
            interview: bookedInterview,
            candidate: session.candidate,
            job: session.candidate.recruitmentjob,
            interviewer: session.interviewer
        }).then(calResult => {
            if (calResult.success && calResult.eventId) {
                prisma.interview.update({
                    where: { id: bookedInterview.id },
                    data: { calendarEventId: calResult.eventId, calendarSyncStatus: 'SYNCED' }
                }).catch(err => logger.error('[CalendarSync] Update error:', err));
            }
        }).catch(err => logger.error('[CalendarSync] Exception:', err));

        emailService.sendInterviewStatusUpdateEmail(
            session.candidate,
            session.candidate.recruitmentjob,
            bookedInterview,
            'CONFIRMED'
        ).catch(err => logger.error('[Email] Confirmation email error:', err));

        res.status(201).json({
            status: 'success',
            message: 'تم حجز المقابلة بنجاح',
            data: {
                interviewId: bookedInterview.id,
                startTime: bookedInterview.startTime,
                endTime: bookedInterview.endTime,
                timezone: bookedInterview.timezone,
                meetingUrl: bookedInterview.meetingUrl,
                location: bookedInterview.location
            }
        });
    } catch (error) {
        if (error.message === 'SLOT_CONFLICT') {
            return res.status(409).json({
                status: 'error',
                code: 'SLOT_CONFLICT',
                message: 'عذراً، قام مرشح آخر بحجز هذا الموعد للتو. يرجى اختيار موعد آخر.'
            });
        }
        next(error);
    }
};

/**
 * 5. Recruiter / Candidate Reschedule Interview
 * PUT /api/interviews/:id/reschedule
 */
export const rescheduleInterview = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { startTime, reason, timezone = 'Asia/Riyadh' } = req.body;
        const user = req.user; // If recruiter

        if (!startTime) {
            return res.status(400).json({ status: 'error', message: 'New startTime is required' });
        }

        const interview = await prisma.interview.findUnique({
            where: { id },
            include: {
                candidate: { include: { recruitmentjob: true } },
                interviewer: true
            }
        });

        if (!interview) {
            return res.status(404).json({ status: 'error', message: 'Interview not found' });
        }

        // Enforce Multi-tenant isolation if user is logged in
        if (user && interview.companyId && interview.companyId !== user.companyId) {
            return res.status(403).json({ status: 'error', message: 'Forbidden' });
        }

        const slotStart = new Date(startTime);
        const slotEnd = new Date(slotStart.getTime() + (interview.duration || 45) * 60 * 1000);

        // 72-hour & overlap validation
        const validation = await InterviewAvailabilityService.validateSlotBooking({
            companyId: interview.companyId,
            interviewerId: interview.interviewerId,
            startTime: slotStart,
            endTime: slotEnd
        });

        if (!validation.valid) {
            return res.status(validation.isConflict ? 409 : 400).json({
                status: 'error',
                code: validation.isConflict ? 'SLOT_CONFLICT' : 'INVALID_SLOT',
                message: validation.error
            });
        }

        const updatedInterview = await prisma.$transaction(async (tx) => {
            const conflict = await tx.interview.findFirst({
                where: {
                    id: { not: id },
                    companyId: interview.companyId,
                    interviewerId: interview.interviewerId,
                    status: { in: ['scheduled', 'rescheduled', 'in_progress'] },
                    startTime: { lt: slotEnd },
                    endTime: { gt: slotStart }
                }
            });

            if (conflict) throw new Error('SLOT_CONFLICT');

            const updated = await tx.interview.update({
                where: { id },
                data: {
                    startTime: slotStart,
                    endTime: slotEnd,
                    scheduledAt: slotStart,
                    timezone,
                    status: 'rescheduled',
                    rescheduledAt: new Date(),
                    rescheduledFromId: interview.id,
                    reminder24hSent: false,
                    reminder1hSent: false,
                    notes: reason ? `${interview.notes || ''}\n[Rescheduled]: ${reason}` : interview.notes
                }
            });

            await tx.candidateHistory.create({
                data: {
                    candidateId: interview.candidateId,
                    action: 'INTERVIEW_RESCHEDULED',
                    comment: `تمت إعادة جدولة المقابلة إلى ${slotStart.toISOString()}${reason ? ` (السبب: ${reason})` : ''}`,
                    performedBy: user?.name || 'Recruiter'
                }
            });

            return updated;
        });

        emailService.sendInterviewStatusUpdateEmail(
            interview.candidate,
            interview.candidate.recruitmentjob,
            updatedInterview,
            'RESCHEDULED'
        ).catch(err => logger.error('[Email] Reschedule notification error:', err));

        res.status(200).json({
            status: 'success',
            message: 'تمت إعادة جدولة المقابلة بنجاح',
            data: updatedInterview
        });
    } catch (error) {
        if (error.message === 'SLOT_CONFLICT') {
            return res.status(409).json({
                status: 'error',
                code: 'SLOT_CONFLICT',
                message: 'الموعد المختار يتعارض مع موعد آخر.'
            });
        }
        next(error);
    }
};

/**
 * 6. Cancel Interview
 * DELETE /api/interviews/:id/cancel
 */
export const cancelInterview = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { reason } = req.body;
        const user = req.user;

        const interview = await prisma.interview.findUnique({
            where: { id },
            include: {
                candidate: { include: { recruitmentjob: true } },
                interviewer: true
            }
        });

        if (!interview) {
            return res.status(404).json({ status: 'error', message: 'Interview not found' });
        }

        if (user && interview.companyId && interview.companyId !== user.companyId) {
            return res.status(403).json({ status: 'error', message: 'Forbidden' });
        }

        const cancelled = await prisma.$transaction(async (tx) => {
            const upd = await tx.interview.update({
                where: { id },
                data: {
                    status: 'cancelled',
                    cancelledAt: new Date(),
                    cancelledBy: user?.name || 'Recruiter',
                    cancellationReason: reason || 'Cancelled by recruiter'
                }
            });

            await tx.candidateHistory.create({
                data: {
                    candidateId: interview.candidateId,
                    action: 'INTERVIEW_CANCELLED',
                    comment: `تم إلغاء المقابلة. السبب: ${reason || 'غير محدد'}`,
                    performedBy: user?.name || 'Recruiter'
                }
            });

            return upd;
        });

        emailService.sendInterviewStatusUpdateEmail(
            interview.candidate,
            interview.candidate.recruitmentjob,
            cancelled,
            'CANCELLED'
        ).catch(err => logger.error('[Email] Cancellation notification error:', err));

        res.status(200).json({
            status: 'success',
            message: 'تم إلغاء المقابلة بنجاح',
            data: cancelled
        });
    } catch (error) {
        next(error);
    }
};

/**
 * 7. Recruiter: Mark as Completed or No-Show
 * PUT /api/interviews/:id/status
 */
export const updateInterviewStatus = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { status, notes, score } = req.body; // status: 'completed' | 'no_show'
        const user = req.user;

        if (!['completed', 'no_show', 'scheduled', 'rescheduled'].includes(status)) {
            return res.status(400).json({ status: 'error', message: 'Invalid status' });
        }

        const interview = await prisma.interview.findUnique({
            where: { id }
        });

        if (!interview || interview.companyId !== user.companyId) {
            return res.status(404).json({ status: 'error', message: 'Interview not found' });
        }

        const updated = await prisma.interview.update({
            where: { id },
            data: {
                status,
                completed: status === 'completed',
                completedAt: status === 'completed' ? new Date() : interview.completedAt,
                notes: notes !== undefined ? notes : interview.notes,
                score: score !== undefined ? parseFloat(score) : interview.score
            }
        });

        await prisma.candidateHistory.create({
            data: {
                candidateId: interview.candidateId,
                action: `INTERVIEW_${status.toUpperCase()}`,
                comment: `تم تحديث حالة المقابلة إلى ${status}`,
                performedBy: user.name
            }
        });

        res.status(200).json({
            status: 'success',
            message: 'تم تحديث حالة المقابلة بنجاح',
            data: updated
        });
    } catch (error) {
        next(error);
    }
};

/**
 * 8. Process Automated Interview Reminders (24h and 1h) - Idempotent
 * POST /api/interviews/cron/reminders
 */
export const processInterviewReminders = async (req, res, next) => {
    try {
        const now = new Date();
        const in24Hours = new Date(now.getTime() + 24 * 60 * 60 * 1000);
        const in1Hour = new Date(now.getTime() + 1 * 60 * 60 * 1000);

        // Find 24h reminders (scheduled between now and in 24h, reminder24hSent is false)
        const interviews24h = await prisma.interview.findMany({
            where: {
                status: 'scheduled',
                startTime: { lte: in24Hours, gte: now },
                reminder24hSent: false
            },
            include: { candidate: { include: { recruitmentjob: true } } }
        });

        let sent24h = 0;
        for (const inter of interviews24h) {
            try {
                await emailService.sendInterviewStatusUpdateEmail(inter.candidate, inter.candidate.recruitmentjob, inter, 'CONFIRMED');
                await prisma.interview.update({
                    where: { id: inter.id },
                    data: { reminder24hSent: true }
                });
                sent24h++;
            } catch (err) {
                logger.error(`[Reminder24h] Failed for interview ${inter.id}:`, err);
            }
        }

        // Find 1h reminders
        const interviews1h = await prisma.interview.findMany({
            where: {
                status: 'scheduled',
                startTime: { lte: in1Hour, gte: now },
                reminder1hSent: false
            },
            include: { candidate: { include: { recruitmentjob: true } } }
        });

        let sent1h = 0;
        for (const inter of interviews1h) {
            try {
                await emailService.sendInterviewStatusUpdateEmail(inter.candidate, inter.candidate.recruitmentjob, inter, 'CONFIRMED');
                await prisma.interview.update({
                    where: { id: inter.id },
                    data: { reminder1hSent: true }
                });
                sent1h++;
            } catch (err) {
                logger.error(`[Reminder1h] Failed for interview ${inter.id}:`, err);
            }
        }

        res.status(200).json({
            status: 'success',
            data: { sent24h, sent1h }
        });
    } catch (error) {
        next(error);
    }
};
