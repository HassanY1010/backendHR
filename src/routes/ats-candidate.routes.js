import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import {
    createCandidate,
    uploadAndParseCV,
    getCandidates,
    getCandidateById,
    getCandidateCV,
    matchCandidateWithJob,
    updateCandidateStatus,
    deleteCandidate,
    updateCandidate,
    addCandidateNote,
    getCandidateNotes,
    deleteCandidateNote,
    createCandidateApplication,
    getCandidateApplications
} from '../controllers/ats-candidate.controller.js';
import { authenticateToken, authorize } from '../middlewares/auth.middleware.js';

const router = Router();

// Multer storage for CV uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = path.join(process.cwd(), 'uploads', 'resumes');
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
        const ext = path.extname(file.originalname);
        cb(null, `cv-${uniqueSuffix}${ext}`);
    }
});

const upload = multer({
    storage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
    fileFilter: (req, file, cb) => {
        const allowedExts = ['.pdf', '.doc', '.docx'];
        const ext = path.extname(file.originalname).toLowerCase();
        if (allowedExts.includes(ext)) {
            cb(null, true);
        } else {
            cb(new Error('نوع الملف غير مسموح به. يرجى رفع ملف بصيغة PDF أو Word فقط.'));
        }
    }
});

// Protect all ATS candidate routes
router.use(authenticateToken);

// Allowed HR/Admin roles for ATS management
const ATS_ROLES = ['SUPER_ADMIN', 'ADMIN', 'HR_MANAGER', 'RECRUITER', 'MANAGER'];

// 1. POST /api/candidates - Create candidate
router.post('/', authorize(...ATS_ROLES), createCandidate);

// 2. POST /api/candidates/upload-cv - Upload CV & parse
router.post('/upload-cv', authorize(...ATS_ROLES), upload.single('cv'), uploadAndParseCV);

// 3. GET /api/candidates - Search & list candidates
router.get('/', authorize(...ATS_ROLES), getCandidates);

// 4. GET /api/candidates/:id - Candidate Profile
router.get('/:id', authorize(...ATS_ROLES), getCandidateById);

// 5. PUT /api/candidates/:id - Update Candidate Profile
router.put('/:id', authorize(...ATS_ROLES), updateCandidate);

// 6. GET /api/candidates/:id/cv - Stream CV securely
router.get('/:id/cv', authorize(...ATS_ROLES), getCandidateCV);

// 7. POST /api/candidates/:id/match - Run AI matching
router.post('/:id/match', authorize(...ATS_ROLES), matchCandidateWithJob);

// 8. PUT /api/candidates/:id/status - Change candidate status/stage
router.put('/:id/status', authorize(...ATS_ROLES), updateCandidateStatus);

// 9. DELETE /api/candidates/:id - Delete candidate
router.delete('/:id', authorize('SUPER_ADMIN', 'ADMIN', 'HR_MANAGER'), deleteCandidate);

// 10. Notes Endpoints
router.post('/:id/notes', authorize(...ATS_ROLES), addCandidateNote);
router.get('/:id/notes', authorize(...ATS_ROLES), getCandidateNotes);
router.delete('/:id/notes/:noteId', authorize(...ATS_ROLES), deleteCandidateNote);

// 11. Multi-Job Applications Endpoints
router.post('/:id/applications', authorize(...ATS_ROLES), createCandidateApplication);
router.get('/:id/applications', authorize(...ATS_ROLES), getCandidateApplications);

export default router;


