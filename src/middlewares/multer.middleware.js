import multer from 'multer';

// Storage configuration for all uploads - keep in memory for Supabase
const storage = multer.memoryStorage();

// File filter for resumes (PDF, DOC, DOCX)
const resumeFileFilter = (req, file, cb) => {
    const allowedMimes = [
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ];

    if (allowedMimes.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error('Invalid file type. Only PDF, DOC, and DOCX files are allowed.'), false);
    }
};

// File filter for videos (MP4, WebM)
const videoFileFilter = (req, file, cb) => {
    const allowedMimes = ['video/mp4', 'video/webm', 'video/x-matroska'];

    if (allowedMimes.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error('Invalid file type. Only MP4 and WebM videos are allowed.'), false);
    }
};

// Multer instances
export const uploadResume = multer({
    storage: storage,
    fileFilter: resumeFileFilter,
    limits: {
        fileSize: 10 * 1024 * 1024 // 10MB limit
    }
}).single('resume');

export const uploadVideo = multer({
    storage: storage,
    fileFilter: videoFileFilter,
    limits: {
        fileSize: 100 * 1024 * 1024 // 100MB limit
    }
}).single('video');

export const uploadAttachment = multer({
    storage: storage,
    limits: {
        fileSize: 20 * 1024 * 1024 // 20MB limit
    }
}).single('file');
