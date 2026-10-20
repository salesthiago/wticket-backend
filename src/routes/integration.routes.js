import { Router } from 'express';
import { authenticateApiKey } from '../middleware/api-key.middleware.js';
import { uploadIntegrationPhotos } from '../middleware/upload.middleware.js';
import * as integrationController from '../controller/integration.controller.js';

// Rotas públicas de integração — autenticadas pela chave de API da empresa
// (header x-api-key), não por JWT. Montadas antes do gate global em routes/index.js.
const router = Router();

router.use(authenticateApiKey('attendance', 'service_order'));

router.post('/leads', uploadIntegrationPhotos, integrationController.createLead);
router.get('/leads/:externalId', integrationController.findLeadByExternalId);

export default router;
