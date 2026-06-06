import { Router } from 'express';
import * as companyController from '../controller/company.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';
import { uploadCompanyLogo } from '../middleware/upload.middleware.js';

const router = Router();

router.post('/register', companyController.register);

router.get('/', authenticate, companyController.findAll);
router.get('/:id', authenticate, companyController.findById);
router.put('/:id', authenticate, companyController.update);
router.patch('/:id/status', authenticate, companyController.setStatus);
router.post('/:id/modules', authenticate, companyController.addModule);
router.delete('/:id/modules/:code', authenticate, companyController.removeModule);
router.patch('/:id/modules/:code', authenticate, companyController.setModuleSubscription);

// Storage S3 (config por empresa)
router.get('/:id/storage', authenticate, companyController.getStorageConfig);
router.put('/:id/storage', authenticate, companyController.updateStorageConfig);
router.delete('/:id/storage', authenticate, companyController.deleteStorageConfig);
router.post('/:id/storage/test', authenticate, companyController.testStorageConnection);

// Logo da empresa
router.post('/:id/logo', authenticate, uploadCompanyLogo, companyController.uploadLogo);
router.delete('/:id/logo', authenticate, companyController.deleteLogo);

export default router;
