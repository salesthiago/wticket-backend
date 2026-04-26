import { Router } from 'express';
import * as companyController from '../controller/company.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';

const router = Router();

router.post('/register', companyController.register);

router.get('/', authenticate, companyController.findAll);
router.get('/:id', authenticate, companyController.findById);
router.put('/:id', authenticate, companyController.update);
router.patch('/:id/status', authenticate, companyController.setStatus);
router.post('/:id/modules', authenticate, companyController.addModule);
router.delete('/:id/modules/:code', authenticate, companyController.removeModule);
router.patch('/:id/modules/:code', authenticate, companyController.setModuleSubscription);

export default router;
