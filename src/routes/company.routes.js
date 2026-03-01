import express from 'express';
import { getAllCompanies, createCompany, getCompanyById, updateCompany, deleteCompany, updateMyCompany, getMyCompany } from '../controllers/company.controller.js';
import { protect, authorize } from '../middlewares/auth.middleware.js';

const router = express.Router();

router.use(protect);
router.get('/', authorize('SUPER_ADMIN'), getAllCompanies);
router.get('/my-company', authorize('MANAGER', 'SUPER_ADMIN'), getMyCompany);
router.patch('/my-company', authorize('MANAGER', 'SUPER_ADMIN'), updateMyCompany);
router.get('/:id', authorize('SUPER_ADMIN'), getCompanyById);
router.post('/', authorize('SUPER_ADMIN'), createCompany);
router.put('/:id', authorize('SUPER_ADMIN'), updateCompany);
router.delete('/:id', authorize('SUPER_ADMIN'), deleteCompany);

export default router;
