import { jest } from '@jest/globals';

// Mock AI Service globally for tests
jest.unstable_mockModule('../src/ai/ai-service.js', () => ({
    aiService: {
        evaluateInterview: jest.fn().mockResolvedValue({
            score: 85,
            strengths: ['Communication', 'Positive Attitude'],
            weaknesses: ['Technical Depth'],
            decision: 'HIRE',
            summary: 'Excellent candidate with great potential.'
        }),
        generateInterviewQuestions: jest.fn().mockResolvedValue([
            'What are your strengths?',
            'Tell us about a challenge you faced.',
            'Where do you see yourself in 5 years?'
        ]),
        analyzeTrainingNeeds: jest.fn().mockResolvedValue({
            needs: ['القيادة المتقدمة', 'إدارة الوقت'],
            gapSummary: 'يحتاج الموظف إلى تعزيز مهارات القيادة'
        }),
        matchTrainingCourses: jest.fn().mockImplementation((needs, courses) => ({
            matches: courses.slice(0, 2).map(c => ({
                courseId: c.id,
                reason: 'دورة مناسبة لتطوير المهارات',
                priority: 'high'
            }))
        })),
        analyzeTrainingImpact: jest.fn().mockResolvedValue({
            impactScore: 92,
            impactAnalysis: 'أظهر الموظف تحسناً ملحوظاً في كفاءة إنجاز المهام بعد التدريب.'
        }),
        generateTrainingPlan: jest.fn().mockResolvedValue({
            weeks: [
                { week: 1, topic: 'أساسيات القيادة', tasks: ['قراءة المواد', 'تطبيق عملي'] },
                { week: 2, topic: 'إدارة الفرق', tasks: ['ورشة عمل'] }
            ]
        }),
        generateQuiz: jest.fn().mockResolvedValue({
            questions: [
                { question: 'ما هو المفهوم الأساسي للقيادة؟', options: ['أ', 'ب', 'ج', 'د'], correctAnswer: 0 }
            ]
        }),
        embedText: jest.fn().mockImplementation(async (text) => {
            if (!text) return null;
            // Generate deterministic mock vector of length 10
            const hash = Array.from(text).reduce((acc, char) => acc + char.charCodeAt(0), 0);
            return Array.from({ length: 10 }, (_, i) => Math.sin(hash + i));
        }),
        cosineSimilarity: jest.fn().mockImplementation((vecA, vecB) => {
            if (!vecA || !vecB) return 0;
            const dot = vecA.reduce((sum, a, i) => sum + a * (vecB[i] || 0), 0);
            const magA = Math.sqrt(vecA.reduce((sum, a) => sum + a * a, 0));
            const magB = Math.sqrt(vecB.reduce((sum, b) => sum + b * b, 0));
            if (!magA || !magB) return 0;
            return dot / (magA * magB);
        }),
        generateFullStrategicReport: jest.fn().mockResolvedValue({
            executive_summary: 'تقرير استراتيجي شامل للأداء والموارد البشرية',
            strengths: ['استقرار الكادر', 'معدل تدريب مرتفع'],
            strategic_risks: ['نقص المهارات التقنية في بعض الأقسام'],
            recommendations: ['تكثيف التدريب القيادي']
        }),
        checkHealth: jest.fn().mockResolvedValue({
            status: 'healthy',
            latency: 120
        })
    }
}));

// Mock Email Service
jest.unstable_mockModule('../src/services/email.service.js', () => ({
    emailService: {
        sendInterviewInvitation: jest.fn().mockResolvedValue({ status: 'success' }),
        sendInterviewSchedulingLinkEmail: jest.fn().mockResolvedValue({ status: 'success' }),
        sendInterviewStatusUpdateEmail: jest.fn().mockResolvedValue({ status: 'success' })
    }
}));

// Set environment variables for testing
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret';
process.env.RESEND_API_KEY = 'test-key';
process.env.CRON_SECRET = 'test-cron-secret-key-123';
