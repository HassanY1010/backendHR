import prisma from '../config/db.js';
import { aiService } from '../ai/ai-service.js';

export const getRoadmapData = async (req, res, next) => {
    try {
        const [roadmapItems, milestones, features] = await Promise.all([
            prisma.roadmapItem.findMany({ orderBy: { startDate: 'asc' } }),
            prisma.milestone.findMany({ orderBy: { targetDate: 'asc' } }),
            prisma.platformFeature.findMany({ orderBy: { votes: 'desc' } })
        ]);

        res.status(200).json({
            status: 'success',
            data: {
                roadmapItems,
                milestones,
                features
            }
        });
    } catch (error) {
        next(error);
    }
};

export const createRoadmapItem = async (req, res, next) => {
    try {
        const item = await prisma.roadmapItem.create({
            data: {
                ...req.body,
                updatedAt: new Date()
            }
        });
        res.status(201).json({ status: 'success', data: item });
    } catch (error) {
        next(error);
    }
};

export const createMilestone = async (req, res, next) => {
    try {
        const milestone = await prisma.milestone.create({
            data: {
                ...req.body,
                updatedAt: new Date()
            }
        });
        res.status(201).json({ status: 'success', data: milestone });
    } catch (error) {
        next(error);
    }
};

export const updateRoadmapItem = async (req, res, next) => {
    try {
        const { id } = req.params;
        const item = await prisma.roadmapItem.update({
            where: { id },
            data: {
                ...req.body,
                updatedAt: new Date()
            }
        });
        res.status(200).json({ status: 'success', data: item });
    } catch (error) {
        next(error);
    }
};

export const analyzeRoadmap = async (req, res, next) => {
    try {
        const [items, milestones] = await Promise.all([
            prisma.roadmapItem.findMany(),
            prisma.milestone.findMany()
        ]);

        const analysis = await aiService.analyzeRoadmap({ items, milestones });
        res.status(200).json({ status: 'success', data: analysis });
    } catch (error) {
        next(error);
    }
};
