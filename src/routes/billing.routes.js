import { Router } from 'express';
import * as paymentController from '../controller/billing/payment.controller.js';
import * as paymentSettingsController from '../controller/billing/payment-settings.controller.js';
import { authenticate, requireSuperAdmin } from '../middleware/auth.middleware.js';
import { uploadItauCertPem, uploadItauKeyPem } from '../middleware/upload.middleware.js';

const router = Router();

// Webhooks públicos — autenticados pelo próprio provedor (query secret / HMAC),
// sem JWT. Mantidos ANTES do '/:id' para não colidir com a rota de status.
router.post('/webhook', paymentController.webhook);            // AbacatePay
router.post('/webhook/itau', paymentController.itauWebhook);   // Itaú (billing)

// Configuração dos provedores de pagamento (super-admin).
router.get('/settings', authenticate, requireSuperAdmin, paymentSettingsController.get);
router.put('/settings', authenticate, requireSuperAdmin, paymentSettingsController.update);
router.post(
  '/settings/itau/certificate',
  authenticate, requireSuperAdmin, uploadItauCertPem,
  paymentSettingsController.uploadCertificate
);
router.post(
  '/settings/itau/private-key',
  authenticate, requireSuperAdmin, uploadItauKeyPem,
  paymentSettingsController.uploadPrivateKey
);

router.post('/checkout', authenticate, paymentController.checkout);

// Mantidas ANTES do '/:id' para não colidir com a rota de status por id.
router.get('/status', authenticate, paymentController.getMyStatus);
router.get('/methods', authenticate, paymentController.getMethods);

router.get('/:id', authenticate, paymentController.getStatus);

export default router;
