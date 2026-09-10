import { Router } from 'express';
import { authenticate, requireTenant, requireModule, requireRole } from '../../../middleware/auth.middleware.js';
import * as boletoController from '../../../controller/financial/itau/itau-boleto.controller.js';

const router = Router();

router.use(
  authenticate,
  requireTenant,
  requireModule('financial'),
  requireRole('administrator', 'company_admin', 'finance')
);

router.get('/', boletoController.list);
router.get('/:id', boletoController.findById);
router.get('/:id/pdf', boletoController.getPdfById);
router.post('/:id/refresh', boletoController.refreshStatus);
router.patch('/:id/cancel', boletoController.cancel);

export default router;
