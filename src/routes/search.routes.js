import express from 'express';
import { smartSearch, reindexData } from '../controllers/search.controller.js';
import { protect, authorize } from '../middlewares/auth.middleware.js';

const router = express.Router();

router.use(protect);

router.post('/', smartSearch);
router.post('/reindex', authorize('ADMIN', 'SUPER_ADMIN', 'MANAGER'), reindexData);

export default router;
