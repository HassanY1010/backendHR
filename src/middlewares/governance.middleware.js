import jwt from 'jsonwebtoken';
import prisma from '../config/db.js';
import { memoryCache } from '../utils/cache.js';

export const checkKillSwitch = async (req, res, next) => {
    try {
        let killSwitchValue = memoryCache.get('PLATFORM_KILL_SWITCH');

        if (killSwitchValue === null) {
            const killSwitch = await prisma.systemsetting.findUnique({
                where: { key: 'PLATFORM_KILL_SWITCH' }
            });
            killSwitchValue = killSwitch ? killSwitch.value : 'false';
            memoryCache.set('PLATFORM_KILL_SWITCH', killSwitchValue, 300); // Cache for 5 minutes
        }

        if (killSwitchValue === 'true') {
            // Check if the request is from a SUPER_ADMIN to allow bypass
            let isSuperAdmin = false;

            let token;
            if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
                token = req.headers.authorization.split(' ')[1];
            }

            if (token) {
                try {
                    const decoded = jwt.verify(token, process.env.JWT_SECRET);
                    const user = await prisma.user.findUnique({
                        where: { id: decoded.id }
                    });
                    if (user && user.role === 'SUPER_ADMIN') {
                        isSuperAdmin = true;
                    }
                } catch (err) {
                    // Invalid token, treat as non-admin
                }
            }

            if (!isSuperAdmin) {
                const error = new Error('The platform is currently under emergency maintenance. Please try again later.');
                error.statusCode = 503;
                return next(error);
            }
        }

        next();
    } catch (error) {
        next(error);
    }
};

