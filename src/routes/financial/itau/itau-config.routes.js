import { Router } from 'express';
import { authenticate, requireTenant, requireModule, requireRole } from '../../../middleware/auth.middleware.js';
import { uploadItauCertPem, uploadItauKeyPem } from '../../../middleware/upload.middleware.js';
import * as configController from '../../../controller/financial/itau/itau-config.controller.js';

const router = Router();

router.use(
  authenticate,
  requireTenant,
  requireModule('financial'),
  requireRole('administrator', 'company_admin', 'finance')
);

router.get('/', configController.get);
router.put('/', configController.upsert);
router.get('/status', configController.status);
router.post('/test-connection', configController.testConnection);

router.post('/certificate', uploadItauCertPem, configController.uploadCertificate);
router.delete('/certificate', configController.removeCertificate);
router.post('/private-key', uploadItauKeyPem, configController.uploadPrivateKey);
router.delete('/private-key', configController.removePrivateKey);

export default router;
