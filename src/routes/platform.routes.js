import { Router } from 'express';
import { requireSuperAdmin } from '../middleware/auth.middleware.js';
import * as platformLeadController from '../controller/platform/platform-lead.controller.js';
import * as platformBillingController from '../controller/platform/platform-billing.controller.js';

// Painel da plataforma (super_admin): leads de prospecção próprios e
// financeiro das empresas assinantes. `authenticate` já roda em routes/index.js.
const router = Router();

router.use(requireSuperAdmin);

// Leads (mantidas ANTES do '/leads/:id' para não colidir)
router.get('/leads/dashboard', platformLeadController.dashboard);
router.get('/leads/segments', platformLeadController.segments);
router.post('/leads/import', platformLeadController.importRows);
router.get('/leads', platformLeadController.findAll);
router.post('/leads', platformLeadController.create);
router.get('/leads/:id', platformLeadController.findById);
router.put('/leads/:id', platformLeadController.update);
router.delete('/leads/:id', platformLeadController.remove);

// Financeiro
router.get('/billing/overview', platformBillingController.overview);
router.get('/billing/payments', platformBillingController.listPayments);
router.post('/billing/charges', platformBillingController.createCharge);
router.post('/billing/payments/:id/mark-paid', platformBillingController.markPaid);
router.post('/billing/payments/:id/cancel', platformBillingController.cancel);
router.post('/billing/payments/:id/refund', platformBillingController.refund);

export default router;
