import express from 'express';
import { protect, authorize } from '../middlewares/auth.middleware.js';
import * as projectsController from '../controllers/projects.controller.js';

const router = express.Router();

router.use(protect);
router.use(authorize('MANAGER', 'ADMIN', 'OWNER'));

router.route('/')
    .get(projectsController.getProjects)
    .post(projectsController.createProject);

router.route('/:id')
    .get(projectsController.getProject)
    .patch(projectsController.updateProject)
    .delete(projectsController.deleteProject);

router.post('/:id/generate-risk-analysis', projectsController.generateAiRiskAnalysis);

export default router;
