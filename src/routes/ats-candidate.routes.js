import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import {
    createCandidate,
    uploadAndParseCV,
    getCandidates,
    getCandidateById,
    matchCandidateWithJob,
    updateCandidateStatus,
    deleteCandidate
} from '../controllers/ats-candidate.controller.js';
import { authenticateToken } from '../middlewares/auth.middleware.js';

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
    limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

// Protect all ATS candidate routes
router.use(authenticateToken);

// 1. POST /api/candidates - Create candidate
router.post('/', createCandidate);

// 2. POST /api/candidates/upload-cv - Upload CV & parse
router.post('/upload-cv', upload.single('cv'), uploadAndParseCV);

// 3. GET /api/candidates - Search & list candidates
router.get('/', getCandidates);

// 4. GET /api/candidates/:id - Candidate Profile
router.get('/:id', getCandidateById);

// 5. POST /api/candidates/:id/match - Run AI matching
router.post('/:id/match', matchCandidateWithJob);

// 6. PUT /api/candidates/:id/status - Change candidate status/stage
router.put('/:id/status', updateCandidateStatus);

// 7. DELETE /api/candidates/:id - Delete candidate
router.delete('/:id', deleteCandidate);

export default router;
