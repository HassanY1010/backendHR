import prisma from '../config/db.js';
import logger from '../utils/logger.js';

export class InterviewAvailabilityService {
    /**
     * Compute available slots within the 72-hour booking window
     * @param {Object} params
     * @param {string} params.companyId - Tenant ID
     * @param {string} params.interviewerId - Recruiter / Interviewer User ID
     * @param {number} [params.duration=45] - Slot duration in minutes
     * @param {string} [params.targetTimezone='Asia/Riyadh'] - Target display timezone
     * @param {Date} [params.fromDate] - Start of search (defaults to now)
     * @returns {Promise<Array<{startTime: string, endTime: string, date: string, isAvailable: boolean}>>}
     */
    static async getAvailableSlots({
        companyId,
        interviewerId,
        duration = 45,
        targetTimezone = 'Asia/Riyadh',
        fromDate = new Date()
    }) {
        const now = new Date();
        const startWindow = fromDate > now ? fromDate : now;
        
        // Strict 72-hour booking window boundary in UTC
        const maxWindow = new Date(now.getTime() + 72 * 60 * 60 * 1000);

        if (startWindow >= maxWindow) {
            return [];
        }

        // 1. Fetch interviewer explicitly defined slots
        const definedSlots = await prisma.interviewSlot.findMany({
            where: {
                companyId,
                userId: interviewerId,
                isAvailable: true,
                startTime: {
                    gte: startWindow,
                    lte: maxWindow
                }
            },
            orderBy: { startTime: 'asc' }
        });

        // 2. Fetch existing scheduled or rescheduled interviews for the same interviewer
        const existingInterviews = await prisma.interview.findMany({
            where: {
                companyId,
                interviewerId,
                status: { in: ['scheduled', 'rescheduled', 'in_progress'] },
                startTime: {
                    gte: new Date(startWindow.getTime() - 24 * 60 * 60 * 1000),
                    lte: maxWindow
                }
            },
            select: {
                id: true,
                startTime: true,
                endTime: true,
                scheduledAt: true,
                duration: true
            }
        });

        // Helper to check if a proposed slot conflicts with any existing interview
        const hasOverlap = (slotStart, slotEnd) => {
            const sStart = new Date(slotStart).getTime();
            const sEnd = new Date(slotEnd).getTime();

            return existingInterviews.some(interview => {
                let iStart = interview.startTime ? new Date(interview.startTime).getTime() : (interview.scheduledAt ? new Date(interview.scheduledAt).getTime() : null);
                if (!iStart) return false;
                let iEnd = interview.endTime ? new Date(interview.endTime).getTime() : (iStart + (interview.duration || 45) * 60 * 1000);

                // Interval intersection: (StartA < EndB) and (EndA > StartB)
                return sStart < iEnd && sEnd > iStart;
            });
        };

        const availableSlots = [];

        // If interviewer has custom defined slots in interviewslot table
        if (definedSlots.length > 0) {
            for (const slot of definedSlots) {
                if (slot.startTime >= now && slot.startTime <= maxWindow && !hasOverlap(slot.startTime, slot.endTime)) {
                    availableSlots.push({
                        startTime: slot.startTime.toISOString(),
                        endTime: slot.endTime.toISOString(),
                        date: slot.date ? slot.date.toISOString().split('T')[0] : slot.startTime.toISOString().split('T')[0],
                        timezone: targetTimezone,
                        isAvailable: true
                    });
                }
            }
            return availableSlots;
        }

        // 3. Fallback / Standard Working Hours Engine:
        // Generate working hour slots for the next 3 days (09:00 to 17:00 local time)
        // Days: Today, Tomorrow, Day 3 (within 72h)
        for (let dayOffset = 0; dayOffset < 4; dayOffset++) {
            const currentDay = new Date(now.getTime() + dayOffset * 24 * 60 * 60 * 1000);
            
            // Standard work slots: 09:00, 10:00, 11:00, 13:00, 14:00, 15:00, 16:00
            const workHours = [9, 10, 11, 13, 14, 15, 16];

            for (const hour of workHours) {
                const candidateSlotStart = new Date(Date.UTC(
                    currentDay.getUTCFullYear(),
                    currentDay.getUTCMonth(),
                    currentDay.getUTCDate(),
                    hour,
                    0,
                    0
                ));

                const candidateSlotEnd = new Date(candidateSlotStart.getTime() + duration * 60 * 1000);

                // Ensure slot is strictly within [now + 1 hour buffer, now + 72 hours]
                const bufferNow = new Date(now.getTime() + 30 * 60 * 1000); // minimum 30 min in advance
                if (candidateSlotStart >= bufferNow && candidateSlotStart <= maxWindow) {
                    if (!hasOverlap(candidateSlotStart, candidateSlotEnd)) {
                        availableSlots.push({
                            startTime: candidateSlotStart.toISOString(),
                            endTime: candidateSlotEnd.toISOString(),
                            date: candidateSlotStart.toISOString().split('T')[0],
                            timezone: targetTimezone,
                            isAvailable: true
                        });
                    }
                }
            }
        }

        return availableSlots;
    }

    /**
     * Validate that a slot is within 72h window and does not overlap existing interviews
     */
    static async validateSlotBooking({ companyId, interviewerId, startTime, endTime }) {
        const now = new Date();
        const start = new Date(startTime);
        const end = new Date(endTime);
        const maxWindow = new Date(now.getTime() + 72 * 60 * 60 * 1000);

        if (isNaN(start.getTime()) || isNaN(end.getTime())) {
            return { valid: false, error: 'تنسيق التاريخ والوقت غير صالح' };
        }

        if (start < now) {
            return { valid: false, error: 'لا يمكن حجز موعد في الماضي' };
        }

        if (start > maxWindow) {
            return { valid: false, error: 'يجب أن يكون الموعد المختار ضمن نافذة 72 ساعة القادمة' };
        }

        if (end <= start) {
            return { valid: false, error: 'وقت انتهاء المقابلة يجب أن يكون بعد وقت البدء' };
        }

        // Check for overlap in database
        const overlapping = await prisma.interview.findFirst({
            where: {
                companyId,
                interviewerId,
                status: { in: ['scheduled', 'rescheduled', 'in_progress'] },
                OR: [
                    {
                        AND: [
                            { startTime: { lt: end } },
                            { endTime: { gt: start } }
                        ]
                    },
                    {
                        AND: [
                            { startTime: null },
                            { scheduledAt: { gte: new Date(start.getTime() - 45 * 60 * 1000), lte: end } }
                        ]
                    }
                ]
            }
        });

        if (overlapping) {
            return { valid: false, error: 'هذا الوقت محجوز بالفعل أو يتعارض مع مقابلة أخرى لنفس المقيم', isConflict: true };
        }

        return { valid: true };
    }
}

export default InterviewAvailabilityService;
