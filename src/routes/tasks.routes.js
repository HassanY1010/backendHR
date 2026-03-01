import express from 'express';
import { protect, authorize } from '../middlewares/auth.middleware.js';
import * as tasksController from '../controllers/tasks.controller.js';
import { validate, authSchemas } from '../utils/validation.js';

// Reusing schemas or adding specific ones
const router = express.Router();

router.use(protect);
router.use(authorize('MANAGER', 'ADMIN', 'OWNER', 'EMPLOYEE'));

router.route('/')
    .get(tasksController.getTasks)
    .post(validate(authSchemas.createTask), tasksController.createTask);

router.route('/:id')
    .get(tasksController.getTask)
    .patch(validate(authSchemas.updateTask), tasksController.updateTask)
    .delete(tasksController.deleteTask);

router.post('/generate', tasksController.generateTasks);

export default router;
