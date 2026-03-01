import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import dotenv from 'dotenv';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { globalLimiter, authLimiter } from './middlewares/rate-limit.middleware.js';
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
import { errorHandler } from './middlewares/error.middleware.js';
import { checkKillSwitch } from './middlewares/governance.middleware.js';


const app = express();

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

const allowedOrigins = process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : [];

const corsOptions = {
    origin: function (origin, callback) {
        // Allow requests with no origin (like mobile apps or curl requests)
        if (!origin) return callback(null, true);

        // In production, block all localhost origins
        if (process.env.NODE_ENV === 'production' && /^http:\/\/localhost:\d+$/.test(origin)) {
            return callback(new Error('Not allowed by CORS'));
        }

        // Check if origin is in allowed list or matches localhost regex (dev only)
        if (allowedOrigins.indexOf(origin) !== -1 ||
            (process.env.NODE_ENV !== 'production' && /^http:\/\/localhost:\d+$/.test(origin))) {
            callback(null, true);
        } else {
            // Security: Don't log blocked origins in production to avoid log pollution
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    exposedHeaders: ['X-RateLimit-Limit', 'X-RateLimit-Remaining', 'X-RateLimit-Reset']
};
app.use(cors(corsOptions));
app.use(cookieParser());

app.use(express.json({ limit: '10mb' })); // Increased limit for heavy AI analysis tasks
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Use shared rate limiters
app.use('/api/', globalLimiter);

// Serve static files from uploads directory
import path from 'path';
import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
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

// Health check
app.get('/health', (req, res) => {
    res.status(200).json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Error handling
app.use(errorHandler);

export default app;
