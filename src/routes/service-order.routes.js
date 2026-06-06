import { Router } from 'express';
import { authenticate, requireTenant, requireModule } from '../middleware/auth.middleware.js';
import { uploadServiceOrderPhoto } from '../middleware/upload.middleware.js';
import * as serviceOrderController from '../controller/service-order.controller.js';

const router = Router();

router.use(authenticate, requireTenant, requireModule('service_order'));

router.get('/', serviceOrderController.findAll);
router.get('/dashboard', serviceOrderController.dashboard);
router.get('/number/:orderNumber', serviceOrderController.findByOrderNumber);
router.get('/customer/:customerId', serviceOrderController.findByCustomer);
router.get('/:id/pdf', serviceOrderController.exportPdf);
router.get('/:id/photos', serviceOrderController.getPhotos);
router.get('/:id/photos/:photoId/url', serviceOrderController.getPhotoUrl);
router.post('/:id/photos', uploadServiceOrderPhoto, serviceOrderController.addPhoto);
router.delete('/:id/photos/:photoId', serviceOrderController.deletePhoto);
router.get('/:id', serviceOrderController.findById);
router.post('/', serviceOrderController.create);
router.put('/:id', serviceOrderController.update);
router.patch('/:id/status', serviceOrderController.updateStatus);
router.patch('/:id/diagnosis', serviceOrderController.addDiagnosis);
router.post('/:id/invoice', serviceOrderController.invoice);
router.get('/:id/receivables', serviceOrderController.listReceivables);
router.delete('/:id/destroy', serviceOrderController.destroy);

export default router;
