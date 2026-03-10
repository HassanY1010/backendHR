import jwt from 'jsonwebtoken';
import prisma from '../config/db.js';
import { memoryCache } from '../utils/cache.js';
import { auditService } from '../services/audit.service.js';

export const protect = async (req, res, next) => {
    try {
        let token = req.cookies.token;

        if (!token && req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
            token = req.headers.authorization.split(' ')[1];
        }

        if (!token) {
            const error = new Error('You are not logged in. Please log in to get access.');
            error.statusCode = 401;
            throw error;
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        // Check blacklist
        const isBlacklisted = await memoryCache.get(`bl_${token}`);
        if (isBlacklisted) {
            const error = new Error('Token is no longer valid (logged out).');
            error.statusCode = 401;
            throw error;
        }

        const cacheKey = `user_auth_${decoded.id}`;
        let user = await memoryCache.get(cacheKey);

        if (!user) {
            console.log(`[DEBUG-AUTH] Cache MISS for token ID: ${decoded.id}. Fetching from DB...`);
            user = await prisma.user.findUnique({
                where: { id: decoded.id },
                include: { company: true },
            });

            if (user) {
                console.log(`[DEBUG-AUTH] User ${user.email} found. Company: ${user.company?.name}, CoStatus: ${user.company?.status}`);
                await memoryCache.set(cacheKey, user, 60);
            } else {
                console.warn(`[DEBUG-AUTH] User ID ${decoded.id} NOT found in DB.`);
            }
        } else {
            console.log(`[DEBUG-AUTH] Cache HIT for user ${user.email}. CoStatus in cache: ${user.company?.status}`);
        }

        const isCompanyActive = user.company ? user.company.status === 'active' : true;

        if (!user || user.status !== 'ACTIVE' || !isCompanyActive) {
            console.error(`[DEBUG-AUTH] Access DENIED. User: ${user?.email}, UserStatus: ${user?.status}, CoStatus: ${user?.company?.status}`);
            const error = new Error('Your account or company is no longer active.');
            error.statusCode = 401;
            throw error;
        }

        // Grant access to protected route
        req.user = user;
        next();
    } catch (error) {
        console.error(`[DEBUG-AUTH] Middleware error: ${error.message}`);
        if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {

            // Log suspicious token usage if it fails signature but looks like a token
            if (error.name === 'JsonWebTokenError') {
                // Might be attack
            }

            error = new Error('Invalid or expired token. Please log in again.');
            error.statusCode = 401;
        }
        next(error);
    }
};

export const authorize = (...roles) => {
    return (req, res, next) => {
        // SUPER_ADMIN always has access
        if (req.user.role !== 'SUPER_ADMIN' && !roles.includes(req.user.role)) {

            auditService.log({
                userId: req.user.id,
                companyId: req.user.companyId,
                action: 'UNAUTHORIZED_ACCESS_ATTEMPT',
                actionType: 'SECURITY',
                severity: 'HIGH',
                target: req.originalUrl,
                status: 'FAILURE',
                ip: req.ip,
                details: { requiredRoles: roles, userRole: req.user.role }
            });

            const error = new Error('You do not have permission to perform this action');
            error.statusCode = 403;
            throw error;
        }
        next();
    };
};
