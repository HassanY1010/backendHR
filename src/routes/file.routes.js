import express from 'express';
import { protect } from '../middlewares/auth.middleware.js';
import { uploadAttachment } from '../middlewares/multer.middleware.js';
import { uploadFile, deleteFile } from '../controllers/file.controller.js';

const router = express.Router();

router.use(protect);

router.post('/upload', uploadAttachment, uploadFile);
router.delete('/:key', deleteFile);

export default router;
