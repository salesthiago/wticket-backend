import * as ticketController from '../controller/ticket.controller.js';
import { authenticate, requireTenant, requireModule } from '../middleware/auth.middleware.js';
import { Router } from 'express';

const router = Router();

router.get('/', authenticate, ticketController.findAll);
router.post('/', authenticate, ticketController.create);
router.get('/:id', authenticate, ticketController.findById);
router.put('/:id', authenticate, ticketController.update);
router.patch('/:id/status', authenticate, ticketController.updateStatus);
router.patch('/:id/assign', authenticate, ticketController.assignTicket);
router.post('/:id/responses', authenticate, ticketController.addResponse);
router.delete('/:id/responses/:responseId', authenticate, ticketController.deleteResponse);
router.patch('/:id/sale-items', authenticate, ticketController.updateSaleItems);
router.delete('/:id/destroy', authenticate, ticketController.destroy);

export default router;
