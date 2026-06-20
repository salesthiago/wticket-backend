import { Router } from 'express';
import { authenticate, requireTenant, requireModule } from '../../middleware/auth.middleware.js';
import * as nfseController from '../../controller/nfse/nfse.controller.js';

const router = Router();

router.use(authenticate, requireTenant, requireModule('nfse'));

router.get('/', nfseController.findAll);
router.post('/', nfseController.issue);
router.post('/from-service-order/:serviceOrderId', nfseController.issueFromServiceOrder);

router.get('/logs', nfseController.findLogs);

router.get('/:id', nfseController.findById);
router.get('/:id/xml', nfseController.getXml); // ?type=dps|nfse
router.get('/:id/pdf', nfseController.getPdf);
router.delete('/:id/destroy', nfseController.destroy);

export default router;
