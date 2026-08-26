import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import dotenv from 'dotenv';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { globalLimiter, authLimiter, clientLogLimiter } from './middlewares/rate-limit.middleware.js';
import cookieParser from 'cookie-parser';
import authRoutes from './routes/auth.routes.js';
import checkInRoutes from './routes/check-in.routes.js';
import companyRoutes from './routes/company.routes.js';
import employeeRoutes from './routes/employee.routes.js';
import recruitmentRoutes from './routes/recruitment.routes.js';
import questionRoutes from './routes/question.routes.js';
import trainingRoutes from './routes/training.routes.js';
import dashboardRoutes from './routes/dashboard.routes.js';
import analyticsRoutes from './routes/analytics.routes.js';
import alertRoutes from './routes/alert.routes.js';
import managerRoutes from './routes/manager.routes.js';
import adminRoutes from './routes/admin.routes.js';
import roadmapRoutes from './routes/roadmap.routes.js';
import aiQualityRoutes from './routes/ai-quality.routes.js';
import userRoutes from './routes/user.routes.js';
import projectsRoutes from './routes/projects.routes.js';
import tasksRoutes from './routes/tasks.routes.js';
import notificationRoutes from './routes/notification.routes.js';
import subscriptionCodeRoutes from './routes/subscription-code.routes.js';
import fileRoutes from './routes/file.routes.js';
import searchRoutes from './routes/search.routes.js';
import jobRequestRoutes from './routes/jobRequestRoutes.js';
import aiJdRoutes from './routes/ai-jd.routes.js';
import workflowRoutes from './routes/workflow.routes.js';
import hiringPlanRoutes from './routes/hiring-plan.routes.js';
import hiringReportsRoutes from './routes/hiring-reports.routes.js';
import atsCandidateRoutes from './routes/ats-candidate.routes.js';
import interviewSchedulingRoutes from './routes/interview-scheduling.routes.js';
import interviewPracticeRoutes from './routes/interview-practice.routes.js';
import { errorHandler } from './middlewares/error.middleware.js';
import { checkKillSwitch } from './middlewares/governance.middleware.js';
import logger from './utils/logger.js';


const app = express();

// Trust proxy settings for deployment platforms like Render/Vercel behind reverse proxies
app.set('trust proxy', 1);

// Middleware
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'"],
            styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
            imgSrc: ["'self'", "data:", "blob:", "https://*"],
            connectSrc: ["'self'", "https://api.openai.com"],
            fontSrc: ["'self'", "https://fonts.gstatic.com"],
            objectSrc: ["'none'"],
            upgradeInsecureRequests: [],
        },
    },
    crossOriginResourcePolicy: { policy: "cross-origin" },
}));

const ALLOWED_ORIGINS_ENV = process.env.ALLOWED_ORIGINS 
    ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim()).filter(Boolean) 
    : [];

const allowedExplicit = [
    'https://hr-manager-dashboard.onrender.com',
    'https://hr-landing-page.onrender.com',
    'http://localhost:3000',
    'http://localhost:3001',
    'http://localhost:5173',
    'http://localhost:8080'
];

const corsOptions = {
    origin: function (origin, callback) {
        // Allow requests with no origin (e.g. mobile apps, curl, server-to-server)
        if (!origin) return callback(null, true);

        // Check explicit list and environment whitelist
        if (allowedExplicit.includes(origin) || ALLOWED_ORIGINS_ENV.includes(origin)) {
            return callback(null, true);
        }

        // In non-production only, allow local development ports
        if (process.env.NODE_ENV !== 'production') {
            if (/^http:\/\/localhost:\d+$/.test(origin)) {
                return callback(null, true);
            }
        }

        // Reject all other origins
        logger.warn(`[CORS] Blocked unauthorized origin: ${origin}`);
        return callback(null, false);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin'],
    exposedHeaders: ['X-RateLimit-Limit', 'X-RateLimit-Remaining', 'X-RateLimit-Reset']
};
app.use(cors(corsOptions));
app.use(cookieParser());

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Client-side log ingestion — protected with dedicated rate limiter, body size limit, and PII/Secret sanitization
app.post('/api/logs', clientLogLimiter, express.json({ limit: '64kb' }), (req, res) => {
    try {
        const rawBody = req.body || {};
        // Strip sensitive fields from client-supplied logs
        const sanitized = JSON.parse(JSON.stringify(rawBody, (key, value) => {
            const forbiddenKeys = ['password', 'passwordHash', 'token', 'authorization', 'secret', 'key', 'apiKey', 'cookie'];
            if (forbiddenKeys.some(f => key.toLowerCase().includes(f))) {
                return '[REDACTED]';
            }
            return value;
        }));
        logger.info('📝 [Client Log]', { body: sanitized });
    } catch (err) {
        // silently ignore logger failures
    }
    res.status(200).json({ status: 'ok' });
});

// Use shared rate limiters
app.use('/api/', globalLimiter);

// Protect /uploads/resumes from direct unauthenticated public access
import path from 'path';
import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Explicitly block unauthenticated direct browsing to resumes directory
app.use('/uploads/resumes', (req, res) => {
    res.status(403).json({ status: 'error', message: 'الوصول المباشر لملفات السير الذاتية محظور لأسباب أمنية. يرجى استخدام بوابة المرشح المصرحة.' });
});

// Serve public static files (avatars, logos, etc.)
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

if (process.env.NODE_ENV === 'development') {
    app.use(morgan('dev'));
}

// Global Governance Check
app.use(checkKillSwitch);


// Routes
app.get('/', (req, res) => {
    res.json({
        message: 'AI HR Platform API is running',
        version: '1.0.0',
        documentation: '/api/docs',
        status: 'UP',
        landingPage: process.env.LANDING_PAGE_URL || ''
    });
});

app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/check-in', checkInRoutes);
app.use('/api/companies', companyRoutes);
app.use('/api/employees', employeeRoutes);
app.use('/api/recruitment', recruitmentRoutes);
app.use('/api/questions', questionRoutes);
app.use('/api/training', trainingRoutes);
app.use('/api/trainings', trainingRoutes); // Fallback for plural if needed
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/alerts', alertRoutes);
app.use('/api/manager', managerRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/roadmap', roadmapRoutes);
app.use('/api/ai-quality', aiQualityRoutes);
app.use('/api/users', userRoutes);
app.use('/api/projects', projectsRoutes);
app.use('/api/tasks', tasksRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/subscription-codes', subscriptionCodeRoutes);
app.use('/api/files', fileRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/job-requests', jobRequestRoutes);
app.use('/api/ai-jd', aiJdRoutes);
app.use('/api/ai/job-description', aiJdRoutes);
app.use('/api/workflow', workflowRoutes);

app.use('/api/hiring-plans', hiringPlanRoutes);
app.use('/api/hiring-reports', hiringReportsRoutes);
app.use('/api/candidates', atsCandidateRoutes);
app.use('/api/interviews/practice', interviewPracticeRoutes);
app.use('/api/interviews', interviewSchedulingRoutes);

// Health check
app.get('/health', (req, res) => {
    res.status(200).json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Error handling
app.use(errorHandler);

export default app;
