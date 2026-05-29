import * as ticketController from '../controller/ticket.controller.js';
import { authenticate, requireTenant, requireModule } from '../middleware/auth.middleware.js';
import { Router } from 'express';

const router = Router();

router.use(authenticate, requireTenant, requireModule('attendance'));

router.get('/', ticketController.findAll);
router.post('/', ticketController.create);
router.put('/:id', ticketController.update);
router.get('/:id', ticketController.findById);
router.patch('/:id/sale-items', ticketController.updateSaleItems);
router.patch('/:id/:status', ticketController.updateStatus);
router.delete('/:id/destroy', ticketController.destroy);

export default router;
