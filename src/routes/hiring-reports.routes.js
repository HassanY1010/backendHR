import express from 'express';
import { protect as authenticate } from '../middlewares/auth.middleware.js';
import { getHiringTypesReport } from '../controllers/hiring-reports.controller.js';

const router = express.Router();

router.use(authenticate);

router.get('/summary', getHiringTypesReport);

export default router;
