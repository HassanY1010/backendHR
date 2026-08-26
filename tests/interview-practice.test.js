import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import prisma from '../src/config/db.js';
import { aiService } from '../src/ai/ai-service.js';
import { PRACTICE_QUESTIONS_BANK } from '../src/controllers/interview-practice.controller.js';

describe('AI Interview Practice Suite', () => {
    let candidateId;
    let companyId;

    beforeAll(async () => {
        const company = await prisma.company.findFirst();
        companyId = company?.id;
        const candidate = await prisma.candidate.findFirst({
            where: { recruitmentjob: { companyId } }
        });
        candidateId = candidate?.id;
    });

    it('1. Strict Separation: Practice Questions must NOT use Real Job Questions', () => {
        expect(PRACTICE_QUESTIONS_BANK.length).toBeGreaterThanOrEqual(4);
        PRACTICE_QUESTIONS_BANK.forEach(q => {
            expect(q.category).toBeDefined();
            expect(q.question).toBeDefined();
            expect(q.tip).toBeDefined();
            // Ensure no specific job leak
            expect(q.question).not.toContain('محاسب');
            expect(q.question).not.toContain('كود');
        });
    });

    it('2. AI Evaluation Engine calculates truthful dynamic scores from audio/video telemetry', async () => {
        const evalResult = await aiService.evaluatePracticeSession({
            answers: [
                {
                    questionId: 'pq-1',
                    question: 'عرفنا بنفسك باختصار',
                    transcript: 'مرحباً، أنا مهندس برمجيات متخصص في تطوير الواجهات وبناء المنصات السحابية.'
                }
            ],
            audioMetrics: { avgVolume: 60, speakingSpeedWpm: 125, pauseCount: 2 },
            videoMetrics: { faceVisibilityPct: 90, lightingQuality: 'GOOD', eyeContactPct: 85 },
            durationSeconds: 90,
            companyId
        });

        expect(evalResult.isEvaluated).toBe(true);
        expect(evalResult.overallScore).toBeGreaterThanOrEqual(50);
        expect(evalResult.voiceScore).toBeGreaterThanOrEqual(50);
        expect(evalResult.visualScore).toBeGreaterThanOrEqual(50);
        expect(evalResult.feedback.strengths.length).toBeGreaterThan(0);
        expect(evalResult.feedback.improvements.length).toBeGreaterThan(0);
        expect(evalResult.feedback.coachTip).toBeDefined();
    });
});
