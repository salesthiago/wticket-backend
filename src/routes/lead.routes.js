import { Router } from 'express';
import { authenticate, requireTenant, requireModule } from '../middleware/auth.middleware.js';
import * as leadController from '../controller/lead.controller.js';

const router = Router();

// Leads pertencem ao Atendimento, mas o orçamento é uma OS — a empresa precisa
// dos dois módulos ativos.
router.use(authenticate, requireTenant, requireModule('attendance'), requireModule('service_order'));

router.get('/', leadController.findAll);
router.post('/', leadController.create);
router.get('/:id', leadController.findById);
router.get('/:id/service-orders', leadController.findServiceOrders);
router.put('/:id', leadController.update);
router.post('/:id/convert', leadController.convertToCustomer);
router.delete('/:id/destroy', leadController.destroy);

export default router;
