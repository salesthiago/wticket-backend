import { Router } from 'express';
import * as paymentController from '../controller/billing/payment.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';

const router = Router();

// Webhook público — autenticado pelo query param ?webhookSecret=... (sem JWT).
// Mantido ANTES do '/:id' para não colidir com a rota de status.
router.post('/webhook', paymentController.webhook);

router.post('/checkout', authenticate, paymentController.checkout);
router.get('/:id', authenticate, paymentController.getStatus);

export default router;
