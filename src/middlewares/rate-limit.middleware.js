import rateLimit from 'express-rate-limit';

// Global limit for standard API calls
export const globalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 200,
    message: { status: 'error', message: 'Too many requests, please try again later' }
});

// Strict rate limiter for authentication endpoints
export const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5,
    skipSuccessfulRequests: true,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        status: 'error',
        message: 'عدد كبير جداً من محاولات تسجيل الدخول. يرجى المحاولة بعد 15 دقيقة'
    }
});

// Recruitment public limiter (10 requests per 15 minutes for candidate-facing routes)
export const recruitmentPublicLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        status: 'error',
        message: 'لقد تجاوزت حد الطلبات المسموح به للمقابلات. يرجى المحاولة لاحقاً'
    }
});
