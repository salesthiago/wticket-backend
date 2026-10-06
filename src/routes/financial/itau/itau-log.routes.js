import { Router } from 'express';
import { authenticate, requireTenant, requireModule, requireRole } from '../../../middleware/auth.middleware.js';
import * as logController from '../../../controller/financial/itau/itau-log.controller.js';

const router = Router();

router.use(
  authenticate,
  requireTenant,
  requireModule('financial'),
  requireRole('administrator', 'company_admin', 'finance')
);

router.get('/', logController.list);

export default router;
