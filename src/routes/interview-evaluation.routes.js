/**
 * Interview Evaluation Routes
 * ============================
 * Clear endpoint semantics:
 * - /api/interviews/:interviewId/evaluation (Canonical route)
 * - /api/interview-evaluations/:interviewId (Backward-compatible alias)
 */

import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import os from 'os';
import {
    transcribeAudio,
    evaluateInterview,
    getEvaluation,
    getEvaluationVersions,
    getCompanyEvaluations,
    updateTranscript,
    deleteEvaluation
} from '../controllers/interview-evaluation.controller.js';
import { protect, authorize, requireCompanyContext } from '../middlewares/auth.middleware.js';
import { aiJdLimiter } from '../middlewares/rate-limit.middleware.js';

const router = Router();

// ─── Multer for secure audio/video STT upload ─────────────────────────────────
const sttStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, os.tmpdir());
    },
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase() || '.webm';
        cb(null, `stt-${Date.now()}-${Math.random().toString(36).substr(2, 9)}${ext}`);
    }
});

const sttUpload = multer({
    storage: sttStorage,
    limits: { fileSize: 25 * 1024 * 1024 }, // 25MB Whisper limit
    fileFilter: (req, file, cb) => {
        const allowedMimes = [
            'audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/webm',
            'audio/ogg', 'audio/flac', 'audio/m4a', 'audio/mp4', 'audio/x-m4a',
            'video/mp4', 'video/webm', 'video/mpeg', 'video/quicktime'
        ];
        const allowedExts = ['.mp3', '.mp4', '.wav', '.webm', '.ogg', '.flac', '.m4a', '.mov', '.mpeg'];
        const ext = path.extname(file.originalname).toLowerCase();

        if (allowedMimes.includes(file.mimetype) || allowedExts.includes(ext)) {
            cb(null, true);
        } else {
            cb(new Error('Unsupported audio/video format. Supported formats: MP3, MP4, WAV, WebM, OGG, FLAC, M4A, MOV.'));
        }
    }
});

// ─── Protected Routes Middleware ──────────────────────────────────────────────
router.use(protect);
router.use(requireCompanyContext);

const EVAL_ROLES = ['SUPER_ADMIN', 'ADMIN', 'HR_MANAGER', 'RECRUITER', 'MANAGER'];
const ADMIN_ROLES = ['SUPER_ADMIN', 'ADMIN', 'HR_MANAGER'];

// 1. POST /api/interview-evaluations/transcribe
router.post(
    '/transcribe',
    authorize(...EVAL_ROLES),
    aiJdLimiter,
    sttUpload.single('audio'),
    transcribeAudio
);

// 2. GET /api/interview-evaluations (Company-wide list)
router.get(
    '/',
    authorize(...EVAL_ROLES),
    getCompanyEvaluations
);

// 3. POST /api/interview-evaluations/:interviewId/evaluate
router.post(
    '/:interviewId/evaluate',
    authorize(...EVAL_ROLES),
    aiJdLimiter,
    evaluateInterview
);

// 4. GET /api/interview-evaluations/:interviewId (Get active evaluation for interview)
router.get(
    '/:interviewId',
    authorize(...EVAL_ROLES),
    getEvaluation
);

// 5. GET /api/interview-evaluations/:interviewId/versions
router.get(
    '/:interviewId/versions',
    authorize(...EVAL_ROLES),
    getEvaluationVersions
);

// 6. PATCH /api/interview-evaluations/:interviewId/transcript
router.patch(
    '/:interviewId/transcript',
    authorize(...EVAL_ROLES),
    updateTranscript
);

// 7. DELETE /api/interview-evaluations/:interviewId (Archive active evaluation)
router.delete(
    '/:interviewId',
    authorize(...ADMIN_ROLES),
    deleteEvaluation
);

export default router;
