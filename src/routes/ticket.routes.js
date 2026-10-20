import * as ticketController from '../controller/ticket.controller.js';
import * as uploadController from '../controller/upload.controller.js';
import { authenticate, requireTenant, requireModule } from '../middleware/auth.middleware.js';
import { uploadEditorImage, uploadTicketAttachment } from '../middleware/upload.middleware.js';
import { Router } from 'express';

const router = Router();

router.post('/upload-image', authenticate, uploadEditorImage, uploadController.uploadEditorImage);
router.get('/', authenticate, ticketController.findAll);
router.post('/', authenticate, ticketController.create);
router.get('/:id', authenticate, ticketController.findById);
router.put('/:id', authenticate, ticketController.update);
router.patch('/:id/content', authenticate, ticketController.updateContent);
router.get('/:id/attachments', authenticate, ticketController.getAttachments);
router.post('/:id/attachments', authenticate, uploadTicketAttachment, ticketController.addAttachment);
router.delete('/:id/attachments/:attachmentId', authenticate, ticketController.deleteAttachment);
router.patch('/:id/status', authenticate, ticketController.updateStatus);
router.patch('/:id/assign', authenticate, ticketController.assignTicket);
router.post('/:id/responses', authenticate, ticketController.addResponse);
router.delete('/:id/responses/:responseId', authenticate, ticketController.deleteResponse);
router.patch('/:id/sale-items', authenticate, ticketController.updateSaleItems);
router.delete('/:id/destroy', authenticate, ticketController.destroy);

export default router;
