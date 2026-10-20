import { Router } from 'express';
import { authenticate, requireTenant, requireModule, requireRole } from '../middleware/auth.middleware.js';
import * as apiKeyController from '../controller/api-key.controller.js';

const router = Router();

router.use(
  authenticate,
  requireTenant,
  requireModule('attendance'),
  requireModule('service_order'),
  requireRole('administrator', 'company_admin')
);

router.get('/', apiKeyController.findAll);
router.post('/', apiKeyController.create);
router.delete('/:id', apiKeyController.revoke);

export default router;
