import { Router } from 'express';
import { authenticate, requireTenant, requireModule } from '../middleware/auth.middleware.js';
import * as leadController from '../controller/lead.controller.js';

const router = Router();

router.use(authenticate, requireTenant, requireModule('service_order'));

router.get('/', leadController.findAll);
router.post('/', leadController.create);
router.get('/:id', leadController.findById);
router.put('/:id', leadController.update);
router.post('/:id/convert', leadController.convertToCustomer);
router.delete('/:id/destroy', leadController.destroy);

export default router;
