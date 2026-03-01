import express from 'express';
import {
    getNotifications,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    updateNotificationMetadata
} from '../controllers/notification.controller.js';
import { protect } from '../middlewares/auth.middleware.js';

const router = express.Router();

router.use(protect);

router.get('/', getNotifications);
router.patch('/:id/read', markAsRead);
router.patch('/:id/metadata', updateNotificationMetadata);
router.post('/read-all', markAllAsRead);
router.delete('/:id', deleteNotification);

export default router;
