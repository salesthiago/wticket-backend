import { Router } from 'express';
import { authenticate, requireTenant, requireModule } from '../middleware/auth.middleware.js';
import { uploadProjectDocument } from '../middleware/upload.middleware.js';
import * as controller from '../controller/project.controller.js';

const router = Router();

router.use(authenticate, requireTenant, requireModule('attendance'));

router.get('/', controller.findAll);
router.post('/', controller.create);
router.get('/:id', controller.findById);
router.put('/:id', controller.update);
router.get('/:id/tickets', controller.findTickets);
router.get('/:id/export/excel', controller.exportExcel);
router.get('/:id/documents', controller.getDocuments);
router.get('/:id/documents/:documentId/url', controller.getDocumentUrl);
router.post('/:id/documents', uploadProjectDocument, controller.addDocument);
router.delete('/:id/documents/:documentId', controller.deleteDocument);
router.delete('/:id/destroy', controller.destroy);

export default router;
