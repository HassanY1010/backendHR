import prisma from '../config/db.js';

export const getCompetitors = async (req, res, next) => {
    try {
        const competitors = await prisma.competitor.findMany({
            orderBy: { marketShare: 'desc' }
        });
        res.status(200).json({ status: 'success', data: competitors });
    } catch (error) {
        next(error);
    }
};

export const createCompetitor = async (req, res, next) => {
    try {
        const { name, marketShare, growthRate, strengths, weaknesses, color } = req.body;
        const competitor = await prisma.competitor.create({
            data: {
                name,
                marketShare: parseFloat(marketShare),
                growthRate: parseFloat(growthRate),
                strengths,
                weaknesses,
                color
            }
        });
        res.status(201).json({ status: 'success', data: competitor });
    } catch (error) {
        next(error);
    }
};

export const updateCompetitor = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { name, marketShare, growthRate, strengths, weaknesses, color } = req.body;
        const competitor = await prisma.competitor.update({
            where: { id },
            data: {
                name,
                marketShare: marketShare ? parseFloat(marketShare) : undefined,
                growthRate: growthRate ? parseFloat(growthRate) : undefined,
                strengths,
                weaknesses,
                color
            }
        });
        res.status(200).json({ status: 'success', data: competitor });
    } catch (error) {
        next(error);
    }
};

export const deleteCompetitor = async (req, res, next) => {
    try {
        const { id } = req.params;
        await prisma.competitor.delete({ where: { id } });
        res.status(204).json({ status: 'success', data: null });
    } catch (error) {
        next(error);
    }
};
