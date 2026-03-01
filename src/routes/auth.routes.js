import express from 'express';
import { login, register, logout, forgotPassword, resetPassword, refresh } from '../controllers/auth.controller.js';

import { protect } from '../middlewares/auth.middleware.js';

import { validate, authSchemas } from '../utils/validation.js';

const router = express.Router();

router.post('/login', validate(authSchemas.login), login);
router.post('/employee/login', validate(authSchemas.login), login);
router.post('/manager/login', validate(authSchemas.login), login);
router.post('/admin/login', validate(authSchemas.login), login);

router.post('/register', validate(authSchemas.register), register);
router.post('/signup-company', validate(authSchemas.register), register);
router.post('/manager/create-employee', validate(authSchemas.register), register);
router.post('/admin/create-company', validate(authSchemas.register), register);
router.post('/admin/create-manager', validate(authSchemas.register), register);

router.post('/logout', protect, logout);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);
router.post('/refresh', refresh);

export default router;
