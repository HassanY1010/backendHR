import express from 'express';
import {
    getEmployeeMe,
    getEmployeeTasks,
    getEmployeePerformance,
    getDailyQuestion,
    answerDailyQuestion,
    getEmployeeTrainings,
    startTraining,
    createTask,
    updateTask,
    completeTask,
    completeTraining,
    getAllEmployees,
    createEmployee,
    bulkCreateEmployees,
    updateEmployee,
    deleteEmployee,
    getNotifications,
    updateMe,
    changePassword,
    deleteTask
} from '../controllers/employee.controller.js';

import { protect, authorize } from '../middlewares/auth.middleware.js';
import { validate, authSchemas } from '../utils/validation.js';
import logger from '../utils/logger.js';

const router = express.Router();

router.use(protect);

// Employee self-service routes (must come BEFORE /:id routes)
router.get('/me', getEmployeeMe);
router.patch('/me', updateMe);
router.post('/change-password', changePassword);

// Manager/Admin routes for managing employees
router.get('/', authorize('MANAGER', 'SUPER_ADMIN'), getAllEmployees);
router.post('/', authorize('MANAGER', 'SUPER_ADMIN'), validate(authSchemas.employee), createEmployee);
router.post('/bulk', authorize('MANAGER', 'SUPER_ADMIN'), bulkCreateEmployees);
router.patch('/:id', authorize('MANAGER', 'SUPER_ADMIN'), validate(authSchemas.employee), updateEmployee);
router.delete('/:id', authorize('MANAGER', 'SUPER_ADMIN'), deleteEmployee);

// Employee-specific routes
router.get('/:userId/tasks', getEmployeeTasks);
router.post('/:userId/tasks', createTask);
router.put('/:userId/tasks/:taskId', updateTask);
router.delete('/:userId/tasks/:taskId', protect, authorize('EMPLOYEE', 'MANAGER', 'SUPER_ADMIN'), async (req, res, next) => {
    logger.info('Delete Task Request', { userId: req.user.id, targetUserId: req.params.userId, taskId: req.params.taskId });
    // Ensure employees can only delete their own tasks
    if (req.user.role === 'EMPLOYEE' && req.user.id !== req.params.userId) {
        logger.warn('Unauthorized delete attempt', { userId: req.user.id, targetUserId: req.params.userId });
        return res.status(403).json({ status: 'error', message: 'Unauthorized' });
    }
    deleteTask(req, res, next);
});
router.post('/:userId/tasks/:taskId/complete', completeTask);

router.get('/:userId/performance', getEmployeePerformance);
router.get('/:userId/daily-question', getDailyQuestion);
router.post('/:userId/daily-question/:questionId/answer', answerDailyQuestion);
router.get('/:userId/trainings', getEmployeeTrainings);
router.post('/:userId/trainings/:trainingId/start', startTraining);
router.post('/:userId/trainings/:trainingId/complete', completeTraining);
router.get('/:id/notifications', getNotifications);

export default router;
