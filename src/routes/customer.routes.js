import { Router } from 'express';
import { authenticate, requireTenant, requireModule } from '../middleware/auth.middleware.js';
import * as customerController from '../controller/customer.controller.js';

const router = Router();

router.use(authenticate, requireTenant, requireModule('service_order'));

router.get('/', customerController.findAll);
router.post('/', customerController.create);
router.get('/:id', customerController.findById);
router.put('/:id', customerController.update);
router.delete('/:id/destroy', customerController.destroy);

export default router;
