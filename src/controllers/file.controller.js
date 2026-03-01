import path from 'path';
import logger from '../utils/logger.js';
import { uploadFileToSupabase } from '../utils/supabase.js';

export const uploadFile = async (req, res, next) => {
    try {
        if (!req.file) {
            const error = new Error('Please upload a file');
            error.statusCode = 400;
            throw error;
        }

        // Fix UTF-8 encoding for Arabic/non-ASCII filenames
        let decodedFilename = req.file.originalname;
        try {
            decodedFilename = Buffer.from(req.file.originalname, 'latin1').toString('utf8');
        } catch (encodingError) {
            logger.warn('Filename encoding conversion failed, using original', { error: encodingError.message });
        }

        const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1E9)}`;
        const ext = path.extname(decodedFilename);
        const fileNameToSave = `attachments/attachment-${uniqueSuffix}${ext}`;

        const fileUrl = await uploadFileToSupabase(req.file.buffer, fileNameToSave, req.file.mimetype);

        res.status(200).json({
            status: 'success',
            data: {
                name: decodedFilename,
                url: fileUrl,
                key: fileNameToSave,
                mimetype: req.file.mimetype,
                size: req.file.size
            }
        });
    } catch (error) {
        next(error);
    }
};

export const deleteFile = async (req, res, next) => {
    // Basic implementation for now
    res.status(200).json({ status: 'success', message: 'File deletion logic would go here' });
};
