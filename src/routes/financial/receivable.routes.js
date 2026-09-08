import { Router } from 'express';
import { authenticate, requireTenant, requireModule, requireRole } from '../../middleware/auth.middleware.js';
import * as receivableController from '../../controller/financial/receivable.controller.js';
import * as itauBoletoController from '../../controller/financial/itau/itau-boleto.controller.js';

const router = Router();

// Multi-tenant + módulo financial + roles permitidas
// (super_admin é sempre liberado pelo middleware requireRole)
router.use(
  authenticate,
  requireTenant,
  requireModule('financial'),
  requireRole('administrator', 'finance')
);

router.get('/', receivableController.findAll);
router.get('/dashboard', receivableController.dashboard);
router.post('/', receivableController.create);
router.get('/:id', receivableController.findById);
router.put('/:id', receivableController.update);
router.patch('/:id/payment', receivableController.registerPayment);
router.patch('/:id/payment/reverse', receivableController.reversePayment);
router.patch('/:id/cancel', receivableController.cancel);
router.delete('/:id/destroy', receivableController.destroy);

// ─── Boleto Itaú do título (requer também o módulo itau_integration) ──────────
router.post('/:id/itau-boleto', requireModule('itau_integration'), itauBoletoController.generateForReceivable);
router.get('/:id/itau-boleto', requireModule('itau_integration'), itauBoletoController.getForReceivable);
router.get('/:id/itau-boleto/pdf', requireModule('itau_integration'), itauBoletoController.getPdfForReceivable);

export default router;
