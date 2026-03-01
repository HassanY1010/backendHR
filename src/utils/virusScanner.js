import NodeClam from 'clamscan';
import fs from 'fs';
import logger from './logger.js';

let clamScanner = null;
let isInitialized = false;

/**
 * Initialize ClamAV scanner
 * Only runs in production environment
 */
export const initClamAV = async () => {
    // Skip in development
    if (process.env.NODE_ENV !== 'production') {
        logger.info('⚠️ ClamAV disabled in development mode');
        return null;
    }

    if (isInitialized && clamScanner) {
        return clamScanner;
    }

    try {
        const clamscan = await new NodeClam().init({
            removeInfected: true, // Automatically remove infected files
            quarantineInfected: false,
            scanLog: null,
            debugMode: false,
            clamdscan: {
                host: process.env.CLAMAV_HOST,
                port: process.env.CLAMAV_PORT || 3310,
                timeout: 60000,
                localFallback: true,
            },
            preference: 'clamdscan'
        });

        clamScanner = clamscan;
        isInitialized = true;
        logger.info('✅ ClamAV initialized successfully');
        return clamscan;
    } catch (error) {
        logger.error('❌ ClamAV initialization failed', { error: error.message });
        logger.error('⚠️ File uploads will proceed WITHOUT virus scanning!');
        return null;
    }
};

/**
 * Scan a file for viruses
 * @param {string} filePath - Absolute path to file
 * @returns {Promise<{isInfected: boolean, viruses: string[]}>}
 */
export const scanFile = async (filePath) => {
    // Skip scanning in development
    if (process.env.NODE_ENV !== 'production') {
        return { isInfected: false, viruses: [] };
    }

    // Check if file exists
    if (!fs.existsSync(filePath)) {
        throw new Error('File not found for virus scanning');
    }

    // Initialize scanner if not already done
    if (!clamScanner) {
        clamScanner = await initClamAV();
    }

    // If ClamAV failed to initialize, log warning and allow upload
    if (!clamScanner) {
        logger.warn('⚠️ ClamAV not available - file uploaded without scanning', { filePath });
        return { isInfected: false, viruses: [] };
    }

    try {
        const { isInfected, viruses } = await clamScanner.isInfected(filePath);

        if (isInfected) {
            logger.error('🦠 VIRUS DETECTED', { filePath, viruses });

            // Delete infected file
            try {
                fs.unlinkSync(filePath);
                logger.info('🗑️ Infected file deleted', { filePath });
            } catch (deleteError) {
                logger.error('Failed to delete infected file', { error: deleteError.message });
            }
        }

        return { isInfected, viruses };
    } catch (error) {
        logger.error('Error during virus scan', { error: error.message });
        // On scan error, be cautious and reject the file
        return { isInfected: true, viruses: ['SCAN_ERROR'] };
    }
};

/**
 * Express middleware for virus scanning
 * Use AFTER multer middleware
 */
export const virusScanMiddleware = async (req, res, next) => {
    // Skip if no file uploaded
    if (!req.file) {
        return next();
    }

    try {
        const { isInfected, viruses } = await scanFile(req.file.path);

        if (isInfected) {
            const error = new Error('ملف مصاب بفيروس. تم رفض التحميل من أجل سلامتك.');
            error.statusCode = 400;
            error.viruses = viruses;
            return next(error);
        }

        // File is clean, proceed
        next();
    } catch (error) {
        logger.error('Virus scan middleware error', { error: error.message });
        const err = new Error('فشل فحص الملف. يرجى المحاولة مرة أخرى.');
        err.statusCode = 500;
        next(err);
    }
};

export default {
    initClamAV,
    scanFile,
    virusScanMiddleware
};
