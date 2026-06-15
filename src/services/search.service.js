import prisma from '../config/db.js';
import { aiService } from '../ai/ai-service.js';
import { extractTextFromPDF } from '../utils/pdfExtractor.js';
import logger from '../utils/logger.js';
import mammoth from 'mammoth';

export const SearchService = {
    /**
     * Indexes dynamic records (Candidates, Tasks, Courses, etc.)
     */
    indexDocument: async ({ companyId, documentId, documentType, content, metadata = {} }) => {
        try {
            // Generate embedding for the content
            const vector = await aiService.embedText(content);
            if (!vector) return;

            // Upsert in SearchIndex
            await prisma.searchIndex.upsert({
                where: { id: `${documentType}_${documentId}` }, // Use a composite deterministic ID if possible, or handle uniqueness manually
                create: {
                    id: `${documentType}_${documentId}`,
                    companyId,
                    documentId,
                    documentType,
                    content,
                    metadata: JSON.stringify(metadata),
                    vector: JSON.stringify(vector)
                },
                update: {
                    content,
                    metadata: JSON.stringify(metadata),
                    vector: JSON.stringify(vector),
                    updatedAt: new Date()
                }
            });
        } catch (error) {
            logger.error('Failed to index document', { documentId, error: error.message });
        }
    },

    /**
     * Performs a smart semantic search
     */
    smartSearch: async ({ query, companyId, limit = 5 }) => {
        try {
            const queryVector = await aiService.embedText(query);
            if (!queryVector) return [];

            // Fetch all indices for the company + global records
            const indices = await prisma.searchIndex.findMany({
                where: {
                    OR: [
                        { companyId },
                        { companyId: 'GLOBAL' }
                    ]
                }
            });

            const results = indices.map(idx => {
                const vector = JSON.parse(idx.vector);
                const similarity = aiService.cosineSimilarity(queryVector, vector);
                return {
                    ...idx,
                    metadata: JSON.parse(idx.metadata || '{}'),
                    similarity
                };
            });

            // Sort by similarity and return top N
            return results
                .filter(r => r.similarity > 0.3) // Threshold
                .sort((a, b) => b.similarity - a.similarity)
                .slice(0, limit);
        } catch (error) {
            logger.error('Smart Search Error', { error: error.message });
            return [];
        }
    },

    /**
     * Extracts text from various file formats
     */
    processFile: async (buffer, filename) => {
        const ext = filename.split('.').pop().toLowerCase();
        try {
            if (ext === 'pdf') {
                return await extractTextFromPDF(buffer);
            } else if (ext === 'docx') {
                const result = await mammoth.extractRawText({ buffer });
                return result.value;
            } else if (['txt', 'md', 'json'].includes(ext)) {
                return buffer.toString('utf-8');
            }
            return '';
        } catch (error) {
            logger.error('Error processing file', { filename, error: error.message });
            return '';
        }
    }
};
