import prisma from '../config/db.js';
import bcrypt from 'bcryptjs';
import logger from '../utils/logger.js';

export const getMe = async (req, res, next) => {
    try {
        const user = await prisma.user.findUnique({
            where: { id: req.user.id },
            include: { company: true }
        });

        if (!user) {
            return res.status(404).json({ status: 'error', message: 'User not found' });
        }

        // Remove sensitive data
        delete user.passwordHash;

        // Parse settings JSON
        if (user.settings && typeof user.settings === 'string') {
            try {
                user.settings = JSON.parse(user.settings);
            } catch (error) {
                logger.error('Failed to parse user settings', { error: error.message, userId: req.user.id });
                user.settings = {};
            }
        }

        res.status(200).json({ status: 'success', data: user });
    } catch (error) {
        next(error);
    }
};

export const updateMe = async (req, res, next) => {
    try {
        const { name, nameEn, email, phone, bio, avatar, location, settings, password, position, department } = req.body;
        const userId = req.user.id;

        const data = {
            ...(name && { name }),
            ...(nameEn !== undefined && { nameEn }),
            ...(email && { email }),
            ...(phone !== undefined && { phone }),
            ...(bio !== undefined && { bio }),
            ...(avatar !== undefined && { avatar }),
            ...(location !== undefined && { location }),
            ...(settings && { settings: typeof settings === 'object' ? JSON.stringify(settings) : settings }),
        };

        if (password) {
            data.passwordHash = await bcrypt.hash(password, 12);
        }

        // Update User and optionally Employee
        const updatePromises = [];

        updatePromises.push(prisma.user.update({
            where: { id: userId },
            data: {
                ...data,
                updatedAt: new Date()
            },
            include: {
                company: true,
                employee: true
            }
        }));

        if (position || department) {
            updatePromises.push(prisma.employee.updateMany({
                where: { userId },
                data: {
                    ...(position && { position }),
                    ...(department && { department }),
                    updatedAt: new Date()
                }
            }));
        }

        const results = await Promise.all(updatePromises);
        const updatedUser = results[0];

        delete updatedUser.passwordHash;

        res.status(200).json({ status: 'success', data: updatedUser });
    } catch (error) {
        next(error);
    }
};

export const getUsersByCompany = async (req, res, next) => {
    try {
        const { companyId } = req.params;

        const users = await prisma.user.findMany({
            where: {
                companyId,
                deletedAt: null
            },
            include: {
                employee: true
            },
            orderBy: {
                role: 'asc' // Managers likely first if ADMIN/MANAGER vs EMPLOYEE
            }
        });

        // Remove passwords
        const safeUsers = users.map(u => {
            const { passwordHash, ...safeUser } = u;
            return safeUser;
        });

        res.status(200).json({ status: 'success', data: { users: safeUsers } });
    } catch (error) {
        next(error);
    }
};
