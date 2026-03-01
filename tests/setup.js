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
        ])
    }
}));

// Mock Email Service
jest.unstable_mockModule('../src/services/email.service.js', () => ({
    emailService: {
        sendInterviewInvitation: jest.fn().mockResolvedValue({ status: 'success' })
    }
}));

// Set environment variables for testing
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret';
process.env.RESEND_API_KEY = 'test-key';
