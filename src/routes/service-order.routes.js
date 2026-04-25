import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware.js';
import * as serviceOrderController from '../controller/service-order.controller.js';

const router = Router();

router.get('/', authenticate, serviceOrderController.findAll);
router.get('/dashboard', authenticate, serviceOrderController.dashboard);
router.get('/number/:orderNumber', authenticate, serviceOrderController.findByOrderNumber);
router.get('/customer/:customerId', authenticate, serviceOrderController.findByCustomer);
router.get('/:id', authenticate, serviceOrderController.findById);
router.post('/', authenticate, serviceOrderController.create);
router.put('/:id', authenticate, serviceOrderController.update);
router.patch('/:id/status', authenticate, serviceOrderController.updateStatus);
router.patch('/:id/diagnosis', authenticate, serviceOrderController.addDiagnosis);
router.delete('/:id/destroy', authenticate, serviceOrderController.destroy);

export default router;
