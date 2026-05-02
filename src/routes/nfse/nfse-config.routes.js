import { Router } from 'express';
import { authenticate, requireTenant, requireModule } from '../../middleware/auth.middleware.js';
import { uploadNfseCertificate } from '../../middleware/upload.middleware.js';
import * as configController from '../../controller/nfse/nfse-config.controller.js';

const router = Router();

router.use(authenticate, requireTenant, requireModule('nfse'));

// Tabela auxiliar (não depende da empresa)
router.get('/municipalities', configController.getMunicipalitiesList);

// Configuração da empresa
router.get('/', configController.get);
router.put('/', configController.upsert);
router.get('/endpoint', configController.resolveEndpointForCompany);

// Certificado digital
router.post('/certificate', uploadNfseCertificate, configController.uploadCertificate);
router.get('/certificate', configController.getCertificateInfo);
router.delete('/certificate', configController.removeCertificate);

export default router;
