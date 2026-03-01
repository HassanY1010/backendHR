import prisma from '../config/db.js';
import { SearchService } from '../services/search.service.js';

export const smartSearch = async (req, res, next) => {
    try {
        const { query, limit } = req.body;
        const companyId = req.user.companyId;

        if (!query) {
            return res.status(400).json({ status: 'error', message: 'Query is required' });
        }

        const results = await SearchService.smartSearch({
            query,
            companyId,
            limit: limit || 5
        });

        res.status(200).json({ status: 'success', data: results });
    } catch (error) {
        next(error);
    }
};

export const reindexData = async (req, res, next) => {
    try {
        const companyId = req.user.companyId;

        // 1. Index Candidates
        const candidates = await prisma.candidate.findMany({
            where: { recruitmentjob: { companyId } },
            include: { recruitmentjob: true }
        });

        for (const candidate of candidates) {
            const content = `Candidate: ${candidate.name}. Position: ${candidate.recruitmentjob.title}. Email: ${candidate.email}. Summary: ${candidate.aiSummary || ''}. Skills: ${candidate.skills || ''}. Location: ${candidate.location || ''}.`;
            await SearchService.indexDocument({
                companyId,
                documentId: candidate.id,
                documentType: 'CANDIDATE',
                content,
                metadata: { name: candidate.name, job: candidate.recruitmentjob.title }
            });
        }

        // 2. Index Tasks
        const tasks = await prisma.task.findMany({
            where: { employee: { companyId } }
        });

        for (const task of tasks) {
            const content = `Task: ${task.title}. Description: ${task.description || ''}. Priority: ${task.priority}. Status: ${task.status}.`;
            await SearchService.indexDocument({
                companyId,
                documentId: task.id,
                documentType: 'TASK',
                content,
                metadata: { title: task.title, status: task.status }
            });
        }

        // 3. Index Training Courses
        const courses = await prisma.trainingCourse.findMany(); // Global for now or filter by logic if needed
        for (const course of courses) {
            const content = `Course: ${course.title}. Description: ${course.description}. Category: ${course.category || ''}. Provider: ${course.provider || ''}.`;
            await SearchService.indexDocument({
                companyId: 'GLOBAL',
                documentId: course.id,
                documentType: 'COURSE',
                content,
                metadata: { title: course.title, category: course.category }
            });
        }

        res.status(200).json({ status: 'success', message: 'Re-indexing completed' });
    } catch (error) {
        next(error);
    }
};
