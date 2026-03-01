import express from 'express';
import {
    getCourses,
    getEnrolledCourses,
    enrollInCourse,
    getCourseDetails,
    createTraining,
    getTrainingNeeds,
    approveTrainingRequest,
    getTrainingAnalytics,
    evaluateTraining,
    assignTraining,
    getAssignedTrainings,
    respondToAssignment,
    updateTraining,
    deleteTraining,
    deleteAssignment,
    updateEnrollmentProgress,
    getComprehensiveProposal
} from '../controllers/training.controller.js';
import { protect, authorize } from '../middlewares/auth.middleware.js';

const router = express.Router();

router.use(protect);

// Public (Employee + Manager)
router.get('/courses', getCourses);
router.get('/my-courses', getEnrolledCourses);
router.post('/enroll/:courseId', enrollInCourse);
router.get('/courses/:id', getCourseDetails);
router.patch('/enrollments/:enrollmentId/progress', updateEnrollmentProgress);

// Global Course Management (System Admin Only)
router.post('/', authorize('ADMIN', 'SUPER_ADMIN'), createTraining);
router.patch('/:id', authorize('MANAGER', 'ADMIN', 'SUPER_ADMIN'), updateTraining);
router.delete('/:id', authorize('MANAGER', 'ADMIN', 'SUPER_ADMIN'), deleteTraining);

// Manager Operations
router.post('/assign', authorize('MANAGER', 'ADMIN', 'SUPER_ADMIN'), assignTraining);
router.get('/assignments', authorize('MANAGER', 'ADMIN', 'SUPER_ADMIN'), getAssignedTrainings);
router.post('/assignments/:id/respond', respondToAssignment);
router.delete('/assignments/:id', authorize('MANAGER', 'ADMIN', 'SUPER_ADMIN'), deleteAssignment);
router.get('/needs', authorize('MANAGER', 'ADMIN', 'SUPER_ADMIN'), getTrainingNeeds);
router.patch('/requests/:id', authorize('MANAGER', 'ADMIN', 'SUPER_ADMIN'), approveTrainingRequest);
router.get('/analytics', authorize('MANAGER', 'ADMIN', 'SUPER_ADMIN'), getTrainingAnalytics);
router.post('/evaluate/:id', authorize('MANAGER', 'ADMIN', 'SUPER_ADMIN'), evaluateTraining);
router.get('/comprehensive-proposal', authorize('MANAGER', 'ADMIN', 'SUPER_ADMIN'), getComprehensiveProposal);

export default router;
