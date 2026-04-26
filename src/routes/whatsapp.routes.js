import { Router } from 'express';
import * as whatsappController from '../controller/whatsapp.controller.js';
import { authenticate, requireTenant, requireModule } from '../middleware/auth.middleware.js';

const router = Router();

router.use(authenticate, requireTenant, requireModule('attendance'));

router.post('/sessions', whatsappController.createSession);
router.get('/sessions/:sessionName/qrcode', whatsappController.getQRCode);
router.get('/sessions/:sessionName/status', whatsappController.getStatus);
router.get('/sessions/:sessionName', whatsappController.getSession);
router.put('/sessions/:sessionName', whatsappController.updateSession);
router.post('/sessions/close', whatsappController.closeSession);
router.get('/sessions', whatsappController.listSessions);
router.delete('/sessions/:sessionName', whatsappController.destroySession);
router.post('/send-message', whatsappController.sendMessage);
router.post('/sync/contacts', whatsappController.syncContacts);
router.get('/sync/status/:sessionName', whatsappController.syncStatus);

// Session Products
router.get('/sessions/:sessionName/products', whatsappController.getSessionProducts);
router.post('/sessions/:sessionName/products', whatsappController.addSessionProduct);
router.delete('/sessions/:sessionName/products/:productId', whatsappController.removeSessionProduct);

export default router;
