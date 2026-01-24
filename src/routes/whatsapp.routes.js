import { Router } from 'express';
import * as whatsappController from '../controller/whatsapp.controller.js';
import { authenticate } from "../middleware/auth.middleware.js";

const router = Router();

router.post('/sessions', authenticate, whatsappController.createSession);
router.get('/sessions/:sessionName/qrcode', authenticate, whatsappController.getQRCode);
router.get('/sessions/:sessionName/status', authenticate, whatsappController.getStatus);
router.get('/sessions/:sessionName', authenticate, whatsappController.getSession);
router.put('/sessions/:sessionName', authenticate, whatsappController.updateSession);
router.post('/sessions/close', authenticate, whatsappController.closeSession);
router.get('/sessions', authenticate, whatsappController.listSessions);
router.delete('/sessions/:sessionName', authenticate, whatsappController.destroySession);
router.post('/send-message', authenticate, whatsappController.sendMessage);
router.post('/sync/contacts', authenticate, whatsappController.syncContacts);
router.get('/sync/status/:sessionName', authenticate, whatsappController.syncStatus);

export default router;