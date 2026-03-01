import crypto from 'crypto';
import prisma from '../config/db.js';

export const generateCode = async (req, res, next) => {
    try {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
        let code = '';
        let isUnique = false;

        while (!isUnique) {
            code = '';
            for (let i = 0; i < 10; i++) {
                code += chars.charAt(Math.floor(Math.random() * chars.length));
            }

            const existing = await prisma.subscriptionCode.findUnique({
                where: { code }
            });

            if (!existing) {
                isUnique = true;
            }
        }

        const newCode = await prisma.subscriptionCode.create({
            data: {
                code,
                status: 'UNUSED'
            }
        });

        res.status(201).json({
            status: 'success',
            data: newCode
        });
    } catch (error) {
        next(error);
    }
};

export const getAllCodes = async (req, res, next) => {
    try {
        const codes = await prisma.subscriptionCode.findMany({
            orderBy: { createdAt: 'desc' },
            include: {
                company: {
                    select: { name: true }
                }
            }
        });

        res.status(200).json({
            status: 'success',
            results: codes.length,
            data: codes
        });
    } catch (error) {
        next(error);
    }
};

export const updateSubscriptionCode = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { code, status } = req.body;

        const updated = await prisma.subscriptionCode.update({
            where: { id },
            data: {
                ...(code && { code }),
                ...(status && { status })
            }
        });

        res.status(200).json({
            status: 'success',
            data: updated
        });
    } catch (error) {
        next(error);
    }
};

export const deleteSubscriptionCode = async (req, res, next) => {
    try {
        const { id } = req.params;

        await prisma.subscriptionCode.delete({
            where: { id }
        });

        res.status(204).json({
            status: 'success',
            data: null
        });
    } catch (error) {
        next(error);
    }
};
